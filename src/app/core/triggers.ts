/**
 * Pure trigger system: detects when answers mention keywords and fires adaptive questions.
 * No dependencies on Angular, IndexedDB, or WebLLM.
 * Deterministic: same input → byte-identical output every run.
 */

import { Answer, Question, Trigger, TriggerTrace } from './question-graph';
import { BASE_STEPS } from './steps';

// Normalize text for pattern matching: lowercase, collapse whitespace, strip punctuation
export function normalize(text: string): string {
  return text
    .toLowerCase()
    // Strip punctuation first, then collapse: removing a separator leaves a gap,
    // so collapsing first would leave a double space behind.
    .replace(/[^\w\s-]/g, '') // strip punctuation except hyphens
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

/**
 * Checked-in trigger table: at least 10 domain triggers
 * Each trigger:
 * - id: unique identifier
 * - patterns: RegExp[] for keyword matching (case-insensitive)
 * - questions: adaptive Question[] objects (ordered by priority)
 * - maxQuestions: cap per trigger (≤ 3)
 * - reasonTemplate: explanation shown to user (e.g., "Asked because you mentioned {phrase} in step {step}")
 */
export const TRIGGERS: Trigger[] = [
  {
    id: 'local_model',
    patterns: [
      /\b(ollama|local model|local inference|on-device|self-hosted)\b/i,
    ],
    maxQuestions: 3,
    reasonTemplate: 'Asked because you mentioned {phrase} in step {step}',
    questions: [
      {
        id: 'a.ctx_window',
        step: 0, // will be set by evaluateTriggers
        prompt: 'What is the model context window (input + output tokens)?',
        help: 'E.g., "4096", "8K tokens". This determines if model shaping fits.',
        kind: 'text',
        required: false,
        adaptive: { triggerId: 'local_model', priority: 1 },
      },
      {
        id: 'a.vram_gb',
        step: 0,
        prompt: 'How much VRAM (GB) is available on your hardware?',
        help: 'E.g., "8", "16", "32". Larger models need more.',
        kind: 'number',
        required: false,
        adaptive: { triggerId: 'local_model', priority: 2 },
      },
      {
        id: 'a.wasm_fallback',
        step: 0,
        prompt: 'Is a WASM fallback acceptable if WebGPU is unavailable?',
        help: 'WASM is 5-20x slower but works everywhere. Yes or No.',
        kind: 'choice',
        required: false,
        adaptive: { triggerId: 'local_model', priority: 3 },
      },
    ],
  },
  {
    id: 'corpus',
    patterns: [/\b(corpus|document|knowledge base|dataset|training data)\b/i],
    maxQuestions: 2,
    reasonTemplate: 'Asked because you mentioned {phrase} in step {step}',
    questions: [
      {
        id: 'a.doc_count',
        step: 0,
        prompt: 'How many documents or records in the corpus?',
        help: 'E.g., "1000", "1M", "1B".',
        kind: 'text',
        required: false,
        adaptive: { triggerId: 'corpus', priority: 1 },
      },
      {
        id: 'a.avg_doc_words',
        step: 0,
        prompt: 'Average words per document?',
        help: 'E.g., "500", "2000", "10000".',
        kind: 'number',
        required: false,
        adaptive: { triggerId: 'corpus', priority: 2 },
      },
    ],
  },
  {
    id: 'vector_db',
    patterns: [/\b(vector|embedding|pgvector|weaviate|pinecone|qdrant)\b/i],
    maxQuestions: 2,
    reasonTemplate: 'Asked because you mentioned {phrase} in step {step}',
    questions: [
      {
        id: 'a.embedding_dim',
        step: 0,
        prompt: 'Embedding dimension?',
        help: 'E.g., "384", "768", "1536".',
        kind: 'number',
        required: false,
        adaptive: { triggerId: 'vector_db', priority: 1 },
      },
      {
        id: 'a.vector_count',
        step: 0,
        prompt: 'Approximate number of vectors?',
        help: 'E.g., "10K", "1M", "100M".',
        kind: 'text',
        required: false,
        adaptive: { triggerId: 'vector_db', priority: 2 },
      },
    ],
  },
  {
    id: 'realtime',
    patterns: [/\b(real-?time|live|stream|websocket|polling|latency)\b/i],
    maxQuestions: 2,
    reasonTemplate: 'Asked because you mentioned {phrase} in step {step}',
    questions: [
      {
        id: 'a.p99_latency',
        step: 0,
        prompt: 'P99 latency target (milliseconds)?',
        help: 'E.g., "100", "500", "1000".',
        kind: 'number',
        required: false,
        adaptive: { triggerId: 'realtime', priority: 1 },
      },
      {
        id: 'a.throughput_qps',
        step: 0,
        prompt: 'Throughput target (queries per second)?',
        help: 'E.g., "1000", "100K", "1M".',
        kind: 'text',
        required: false,
        adaptive: { triggerId: 'realtime', priority: 2 },
      },
    ],
  },
  {
    id: 'payments',
    patterns: [/\b(payment|stripe|billing|transaction|credit card|checkout)\b/i],
    maxQuestions: 3,
    reasonTemplate: 'Asked because you mentioned {phrase} in step {step}',
    questions: [
      {
        id: 'a.payment_processor',
        step: 0,
        prompt: 'Which payment processor?',
        help: 'E.g., "Stripe", "PayPal", "Square", "custom".',
        kind: 'choice',
        required: false,
        adaptive: { triggerId: 'payments', priority: 1 },
      },
      {
        id: 'a.pci_compliance',
        step: 0,
        prompt: 'PCI compliance requirements?',
        help: 'Yes (full scope) or No (processor handles it).',
        kind: 'choice',
        required: false,
        adaptive: { triggerId: 'payments', priority: 2 },
      },
      {
        id: 'a.currency_support',
        step: 0,
        prompt: 'Multi-currency support required?',
        help: 'List supported currencies or "single currency".',
        kind: 'text',
        required: false,
        adaptive: { triggerId: 'payments', priority: 3 },
      },
    ],
  },
  {
    id: 'auth',
    patterns: [/\b(authentication|oauth|saml|ldap|sso|password|mfa|login)\b/i],
    maxQuestions: 2,
    reasonTemplate: 'Asked because you mentioned {phrase} in step {step}',
    questions: [
      {
        id: 'a.auth_method',
        step: 0,
        prompt: 'Primary authentication method?',
        help: 'E.g., "OAuth2", "JWT", "Session", "SAML".',
        kind: 'choice',
        required: false,
        adaptive: { triggerId: 'auth', priority: 1 },
      },
      {
        id: 'a.mfa_required',
        step: 0,
        prompt: 'Multi-factor authentication required?',
        help: 'Yes or No.',
        kind: 'choice',
        required: false,
        adaptive: { triggerId: 'auth', priority: 2 },
      },
    ],
  },
  {
    id: 'browser_ai',
    patterns: [/\b(browser|client-side|webgpu|wasm|web llm|inference)\b/i],
    maxQuestions: 2,
    reasonTemplate: 'Asked because you mentioned {phrase} in step {step}',
    questions: [
      {
        id: 'a.model_size',
        step: 0,
        prompt: 'Target model size class?',
        help: 'E.g., "1B", "3B", "7B", "13B parameters".',
        kind: 'text',
        required: false,
        adaptive: { triggerId: 'browser_ai', priority: 1 },
      },
      {
        id: 'a.gpu_requirement',
        step: 0,
        prompt: 'GPU required or optional?',
        help: 'Required or Optional (WASM fallback).',
        kind: 'choice',
        required: false,
        adaptive: { triggerId: 'browser_ai', priority: 2 },
      },
    ],
  },
  {
    id: 'nixos_deploy',
    patterns: [/\b(nix|nixos|flakes?|home manager|declarative)\b/i],
    maxQuestions: 2,
    reasonTemplate: 'Asked because you mentioned {phrase} in step {step}',
    questions: [
      {
        id: 'a.nix_lang',
        step: 0,
        prompt: 'Will you maintain Nix expressions or let the team?',
        help: 'Self-maintained or team-maintained.',
        kind: 'choice',
        required: false,
        adaptive: { triggerId: 'nixos_deploy', priority: 1 },
      },
      {
        id: 'a.flakes_usage',
        step: 0,
        prompt: 'Will you use Nix Flakes?',
        help: 'Yes or No (classic Nix).',
        kind: 'choice',
        required: false,
        adaptive: { triggerId: 'nixos_deploy', priority: 2 },
      },
    ],
  },
  {
    id: 'angular',
    // normalize() strips punctuation, so `@angular/core` becomes `angularcore`.
    // Match the prefix instead of a whole word, and drop the `@angular` variant
    // because the `@` can never survive normalization.
    patterns: [/\b(angular\w*|ng-|rxjs)\b/i],
    maxQuestions: 2,
    reasonTemplate: 'Asked because you mentioned {phrase} in step {step}',
    questions: [
      {
        id: 'a.angular_version',
        step: 0,
        prompt: 'Target Angular version?',
        help: 'E.g., "18", "19", "20", "latest".',
        kind: 'text',
        required: false,
        adaptive: { triggerId: 'angular', priority: 1 },
      },
      {
        id: 'a.standalone_components',
        step: 0,
        prompt: 'Standalone components or modules?',
        help: 'Standalone or Modules.',
        kind: 'choice',
        required: false,
        adaptive: { triggerId: 'angular', priority: 2 },
      },
    ],
  },
  {
    id: 'nestjs',
    patterns: [/\b(nestjs|nest|@nestjs|express|fastify)\b/i],
    maxQuestions: 2,
    reasonTemplate: 'Asked because you mentioned {phrase} in step {step}',
    questions: [
      {
        id: 'a.nestjs_version',
        step: 0,
        prompt: 'Target NestJS version?',
        help: 'E.g., "10", "11", "12", "latest".',
        kind: 'text',
        required: false,
        adaptive: { triggerId: 'nestjs', priority: 1 },
      },
      {
        id: 'a.http_framework',
        step: 0,
        prompt: 'HTTP framework?',
        help: 'Express, Fastify, or auto-detect.',
        kind: 'choice',
        required: false,
        adaptive: { triggerId: 'nestjs', priority: 2 },
      },
    ],
  },
];

export interface EvaluateTriggersResult {
  questions: Question[];
  traces: TriggerTrace[];
}

/**
 * Pure trigger evaluation: returns new adaptive questions and traces.
 * Deterministic: same input → byte-identical output.
 *
 * Algorithm:
 * 1. For each answer, normalize its text and check against all trigger patterns
 * 2. Collect matching triggers with trace info (triggerId, matchedPhrase, becauseAnswerId)
 * 3. Extract questions from matching triggers, respecting:
 *    - maxQuestions per trigger (dedup by answerId match)
 *    - 12 global cap on total follow-ups
 *    - Priority ordering within each trigger
 * 4. Sort adaptive questions after the step that triggered them
 * 5. Return questions + traces
 */
export function evaluateTriggers(answers: Answer[]): EvaluateTriggersResult {
  const traces: TriggerTrace[] = [];
  const firedTriggers = new Map<
    string,
    { triggerStep: number; triggerOrder: number; phrases: string[] }
  >();

  let triggerFireOrder = 0;

  // Step 1-2: Find all fired triggers and their matched phrases
  for (const answer of answers) {
    const normalized = normalize(answer.text);

    for (const trigger of TRIGGERS) {
      for (const pattern of trigger.patterns) {
        const match = pattern.exec(normalized);
        if (match) {
          const matchedPhrase = match[0];

          traces.push({
            triggerId: trigger.id,
            becauseAnswerId: answer.id,
            matchedPhrase,
            matchedAt: answer.editedAt ?? answer.askedAt,
          });

          if (!firedTriggers.has(trigger.id)) {
            const baseStep = BASE_STEPS.find((q) => q.id === answer.questionId);
            firedTriggers.set(trigger.id, {
              triggerStep: baseStep?.step ?? 10, // default to 10 (after all base steps) for adaptive answers
              triggerOrder: triggerFireOrder++,
              phrases: [],
            });
          }
          const entry = firedTriggers.get(trigger.id)!;
          if (!entry.phrases.includes(matchedPhrase)) {
            entry.phrases.push(matchedPhrase);
          }
          break; // one match per trigger per answer
        }
      }
    }
  }

  // Step 3: Extract questions respecting per-trigger and global caps
  const questions: Question[] = [];
  const totalBudget = 12;
  let totalUsed = 0;
  const questionsUsedByStep = new Map<number, number>();

  // Order triggers by first fire (determinism): step first, then fire order
  const sortedTriggers = Array.from(firedTriggers.entries())
    .sort((a, b) => {
      const stepDiff = a[1].triggerStep - b[1].triggerStep;
      if (stepDiff !== 0) return stepDiff;
      return a[1].triggerOrder - b[1].triggerOrder;
    });

  for (const [triggerId, { triggerStep }] of sortedTriggers) {
    if (totalUsed >= totalBudget) break;

    const trigger = TRIGGERS.find((t) => t.id === triggerId);
    if (!trigger) continue;

    const budget = Math.min(trigger.maxQuestions, totalBudget - totalUsed);
    const triggerQuestions = trigger.questions.slice(0, budget);

    // Assign steps to this trigger's questions
    for (const q of triggerQuestions) {
      if (totalUsed >= totalBudget) break;
      const stepOffset = (questionsUsedByStep.get(triggerStep) ?? 0) + 1;
      questionsUsedByStep.set(triggerStep, stepOffset);
      questions.push({
        ...q,
        step: triggerStep + stepOffset / (totalBudget + 1),
      });
      totalUsed++;
    }
  }

  return { questions, traces };
}
