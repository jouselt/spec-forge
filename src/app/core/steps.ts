/**
 * Base question definitions for the nine steps of the spec-forge interview.
 * Order matters: constraints before stack, proof before features.
 */

import { Question } from './question-graph';

export const BASE_STEPS: Question[] = [
  {
    id: 'q.idea',
    step: 1,
    prompt: 'What is the idea? One paragraph.',
    help: 'One paragraph. State what it is and who it is for, plainly enough that someone who has never seen it gets it on a first read.',
    kind: 'longtext',
    required: true,
  },
  {
    id: 'q.problem',
    step: 2,
    prompt: 'What problem does it solve, and who has it?',
    help: 'Be specific about who, not vague. "Developers building real-time dashboards" not "people".',
    kind: 'longtext',
    required: true,
  },
  {
    id: 'q.workaround',
    step: 3,
    prompt: 'What do those people do today instead?',
    help: 'Their current manual workaround or tool. This frames the honest baseline.',
    kind: 'longtext',
    required: true,
  },
  {
    id: 'q.goal',
    step: 4,
    prompt: 'What is the goal, and what are the non-goals?',
    help: 'State what you will not do. Non-goals become Scope Boundary.',
    kind: 'longtext',
    required: true,
  },
  {
    id: 'q.proof',
    step: 5,
    prompt: 'What proves it worked? Name a metric or an observable behavior.',
    help: 'Examples: "Loads in under 2s" or "5 of 5 unanswerable questions return an abstain". Not "it works".',
    kind: 'text',
    required: true,
    validate: (text: string): string | null => {
      const normalized = text.toLowerCase().trim();
      if (normalized.length < 12) {
        return 'Answer must be at least 12 characters. Name a number, a unit, or an observable behavior.';
      }
      // Reject purely vague answers
      if (/^\b(works|it works|good|fast|better|success|done)\b$/i.test(normalized)) {
        return 'Name a number or an observable behavior. "Loads in under 2s" or "5 of 5 items process without errors". "It works" cannot be tested.';
      }
      return null;
    },
  },
  {
    id: 'q.constraints',
    step: 6,
    prompt: 'Which constraints can you measure before starting?',
    help: 'Table of measurable numbers with units, e.g., "P99 latency < 100ms", "Support 10M users". Or "none measured yet".',
    kind: 'table',
    required: true,
  },
  {
    id: 'q.stack',
    step: 7,
    prompt: 'Stack: framework, language, storage, deployment.',
    help: 'List each choice, e.g., "React 19", "Node.js", "PostgreSQL", "Docker on Kubernetes".',
    kind: 'list',
    required: true,
  },
  {
    id: 'q.scope_out',
    step: 8,
    prompt: 'What is explicitly out of scope?',
    help: 'List what you will not do. This prevents scope creep.',
    kind: 'list',
    required: true,
  },
  {
    id: 'q.risk',
    step: 9,
    prompt: 'Biggest risk, and what you would build first instead.',
    help: 'State the risk plainly, then the minimum thing you would ship first to validate it.',
    kind: 'longtext',
    required: true,
  },
];

/** Validate that base steps are correctly defined */
export function validateBaseSteps(): string[] {
  const errors: string[] = [];

  if (BASE_STEPS.length !== 9) {
    errors.push(`Expected 9 base steps, got ${BASE_STEPS.length}`);
  }

  const ids = new Set<string>();
  for (const q of BASE_STEPS) {
    if (!q.required) {
      errors.push(`Base step ${q.id} must be required: true`);
    }
    if (ids.has(q.id)) {
      errors.push(`Duplicate step id: ${q.id}`);
    }
    ids.add(q.id);
  }

  return errors;
}
