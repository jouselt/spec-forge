/**
 * Answer to section mapping: a checked-in table, derived by reading the eleven
 * sibling specs in `portfolio-projects`. No model decides where an answer goes.
 *
 * Section naming. This app emits `Target Signal`. The eleven sibling specs spell
 * it `Target Recruiter Signal` and keep it, because those specs present Joe's own
 * work to a hiring reader. This tool generates specs for arbitrary projects, so
 * its default cannot assume that audience. Both spellings are accepted on the way
 * in through `canonicalSectionName`, so a validator and the import path take
 * either one; the sibling specs are never edited.
 *
 * The registry below is also the skeleton each template fills. A section marked
 * `required` is always emitted and becomes a `{{MISSING: ...}}` gap when no
 * mapped answer is present; an optional section appears only when at least one of
 * its answers is present.
 */

import { AnswerId, Block, Question } from './question-graph';
import { BASE_STEPS } from './steps';
import { TRIGGERS } from './triggers';

export type SpecFile = Block['file'];

export interface SectionSpec {
  /** The heading emitted for this section. */
  readonly name: string;
  readonly file: SpecFile;
  /** Always emitted, as a gap when no mapped answer is present. */
  readonly required: boolean;
}

/** `proposal.md`, in emit order. The six shared sections come first. */
export const PROPOSAL_SECTIONS: readonly SectionSpec[] = [
  { name: 'Problem', file: 'proposal', required: true },
  { name: 'Goal', file: 'proposal', required: true },
  { name: 'Target Signal', file: 'proposal', required: true },
  { name: 'Constraints Measured Up Front', file: 'proposal', required: true },
  { name: 'Tech Stack', file: 'proposal', required: true },
  { name: 'Core Features', file: 'proposal', required: true },
  { name: 'Scope Boundary', file: 'proposal', required: true },
  { name: 'Timeline', file: 'proposal', required: true },
  { name: 'Acceptance Criteria', file: 'proposal', required: true },
  { name: 'Risks', file: 'proposal', required: true },
];

/** `design.md`, in emit order. */
export const DESIGN_SECTIONS: readonly SectionSpec[] = [
  { name: 'Architecture', file: 'design', required: true },
  { name: 'Package layout', file: 'design', required: true },
  { name: 'Data model', file: 'design', required: true },
  { name: 'Provider seams', file: 'design', required: true },
  { name: 'Validation and Provenance', file: 'design', required: true },
  { name: 'Persistence', file: 'design', required: true },
  // Only meaningful when an adaptive model question was answered.
  { name: 'Capability handling', file: 'design', required: false },
  { name: 'Trade-offs Considered', file: 'design', required: true },
  { name: 'What This Proves', file: 'design', required: true },
  { name: 'Acceptance criteria (design-verifiable)', file: 'design', required: true },
  { name: 'Open Questions', file: 'design', required: true },
];

/** `tasks.md`, in emit order. Phases are structural; the last section closes the file. */
export const TASKS_SECTIONS: readonly SectionSpec[] = [
  { name: 'Phase 1: Contracts and scaffold', file: 'tasks', required: true },
  { name: 'Phase 2: Core implementation', file: 'tasks', required: true },
  { name: 'Phase 3: Constraints and measurement', file: 'tasks', required: true },
  { name: 'Phase 4: Acceptance and verification', file: 'tasks', required: true },
  { name: 'Phase 5: Hardening and ship', file: 'tasks', required: true },
  { name: 'Definition of Done', file: 'tasks', required: true },
];

export const ALL_SECTIONS: readonly SectionSpec[] = [
  ...PROPOSAL_SECTIONS,
  ...DESIGN_SECTIONS,
  ...TASKS_SECTIONS,
];

/**
 * Heading drift: the corpus carries the older spelling. Only the spellings the
 * eleven specs actually use are listed, so the table stays a measurement.
 */
export const SECTION_ALIASES: Readonly<Record<string, string>> = {
  'Target Recruiter Signal': 'Target Signal',
};

export function sectionsFor(file: SpecFile): readonly SectionSpec[] {
  return ALL_SECTIONS.filter((section) => section.file === file);
}

export function sectionNamesFor(file: SpecFile): string[] {
  return sectionsFor(file).map((section) => section.name);
}

/** Every section name, in registry order, with duplicates dropped. */
export function allSectionNames(): string[] {
  const names: string[] = [];
  for (const section of ALL_SECTIONS) {
    if (!names.includes(section.name)) {
      names.push(section.name);
    }
  }
  return names;
}

/**
 * The app's own name for a heading, or null when the heading belongs to neither
 * registry. Accepts both spellings, ignoring case and a trailing qualifier:
 * `Tech Stack (Angular/NestJS)` and `Target Recruiter Signal` both resolve.
 */
export function canonicalSectionName(name: string): string | null {
  const collapsed = name.replace(/\s+/g, ' ').trim();
  const withoutQualifier = collapsed.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const aliased = SECTION_ALIASES[withoutQualifier] ?? withoutQualifier;
  const names = allSectionNames();

  return (
    names.find((known) => known === aliased) ??
    names.find((known) => known.toLowerCase() === aliased.toLowerCase()) ??
    null
  );
}

export function isKnownSection(file: SpecFile, name: string): boolean {
  return sectionNamesFor(file).includes(name);
}

/** Every question the interview can ask: the nine base steps plus the adaptive ones. */
export function allQuestions(): Question[] {
  return [...BASE_STEPS, ...TRIGGERS.flatMap((trigger) => trigger.questions)];
}

/** Every answer id the graph can produce, in graph order. */
export function answerIds(): AnswerId[] {
  return allQuestions().map((question) => question.id);
}

export function questionById(id: AnswerId): Question | null {
  return allQuestions().find((question) => question.id === id) ?? null;
}

export interface AnswerTargets {
  readonly proposal: readonly string[];
  readonly design: readonly string[];
  readonly tasks: readonly string[];
}

/**
 * The mapping. Base rows come from the section structure shared by the eleven
 * specs. The adaptive rows come from the same reading: every follow-up asks for a
 * measured number, so it lands in the constraints section of `proposal.md`, in
 * the data model of `design.md` and in the measurement phase of `tasks.md`; the
 * model and hardware follow-ups additionally feed the provider and capability
 * sections of `design.md`, which is where spec 11 puts them.
 *
 * Two base rows are worth calling out, because the corpus has sections with no
 * dedicated question:
 * - `Timeline` has no step, as `design.md` states. It is reached from `q.risk`,
 *   the answer that says what to build first, and its frames say plainly that no
 *   dates are collected rather than inventing weeks.
 * - `Acceptance Criteria` has no step either. It is assembled from `q.proof` and
 *   the measured constraints, which is what the design describes.
 */
export const MAP: Readonly<Record<AnswerId, AnswerTargets>> = {
  'q.idea': {
    proposal: ['Goal', 'Core Features'],
    design: ['Architecture'],
    tasks: ['Phase 1: Contracts and scaffold', 'Phase 2: Core implementation'],
  },
  'q.problem': {
    proposal: ['Problem'],
    design: ['Architecture'],
    tasks: ['Phase 2: Core implementation'],
  },
  'q.workaround': {
    proposal: ['Problem'],
    design: ['Architecture'],
    tasks: ['Phase 2: Core implementation'],
  },
  'q.goal': {
    proposal: ['Goal', 'Core Features', 'Scope Boundary'],
    design: ['What This Proves', 'Trade-offs Considered'],
    tasks: ['Phase 2: Core implementation'],
  },
  'q.proof': {
    proposal: ['Target Signal', 'Acceptance Criteria'],
    design: ['Validation and Provenance', 'What This Proves', 'Acceptance criteria (design-verifiable)'],
    tasks: ['Phase 4: Acceptance and verification', 'Definition of Done'],
  },
  'q.constraints': {
    proposal: ['Constraints Measured Up Front', 'Acceptance Criteria'],
    design: ['Data model', 'Validation and Provenance', 'Acceptance criteria (design-verifiable)'],
    tasks: ['Phase 3: Constraints and measurement', 'Phase 4: Acceptance and verification', 'Definition of Done'],
  },
  'q.stack': {
    proposal: ['Tech Stack'],
    design: ['Architecture', 'Package layout', 'Data model', 'Provider seams', 'Persistence'],
    tasks: ['Phase 1: Contracts and scaffold', 'Phase 5: Hardening and ship'],
  },
  'q.scope_out': {
    proposal: ['Scope Boundary'],
    design: ['Trade-offs Considered'],
    tasks: ['Phase 2: Core implementation'],
  },
  'q.risk': {
    proposal: ['Timeline', 'Risks'],
    design: ['Trade-offs Considered', 'Open Questions'],
    tasks: ['Phase 5: Hardening and ship'],
  },

  // Hardware and model follow-ups: constraints in proposal.md, the data model and
  // capability sections in design.md. Spec 11 is the source for both.
  'a.ctx_window': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Data model', 'Provider seams', 'Capability handling'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.vram_gb': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Data model', 'Provider seams', 'Capability handling'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.wasm_fallback': {
    proposal: ['Constraints Measured Up Front', 'Tech Stack'],
    design: ['Provider seams', 'Capability handling'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.model_size': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Data model', 'Provider seams', 'Capability handling'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.gpu_requirement': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Provider seams', 'Capability handling'],
    tasks: ['Phase 3: Constraints and measurement'],
  },

  // Corpus and retrieval follow-ups.
  'a.doc_count': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Data model'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.avg_doc_words': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Data model'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.embedding_dim': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Data model'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.vector_count': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Data model'],
    tasks: ['Phase 3: Constraints and measurement'],
  },

  // Latency and throughput follow-ups.
  'a.p99_latency': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Data model'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.throughput_qps': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Data model'],
    tasks: ['Phase 3: Constraints and measurement'],
  },

  // Domain follow-ups: payments, auth, deployment and framework choices. Each one
  // is a measurable requirement, so each lands in the constraints section.
  'a.payment_processor': {
    proposal: ['Constraints Measured Up Front', 'Tech Stack'],
    design: ['Data model'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.pci_compliance': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Data model'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.currency_support': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Data model'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.auth_method': {
    proposal: ['Constraints Measured Up Front', 'Tech Stack'],
    design: ['Provider seams'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.mfa_required': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Provider seams'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.nix_lang': {
    proposal: ['Constraints Measured Up Front', 'Tech Stack'],
    design: ['Package layout'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.flakes_usage': {
    proposal: ['Constraints Measured Up Front', 'Tech Stack'],
    design: ['Package layout'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.angular_version': {
    proposal: ['Constraints Measured Up Front', 'Tech Stack'],
    design: ['Package layout'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.standalone_components': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Package layout'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.nestjs_version': {
    proposal: ['Constraints Measured Up Front', 'Tech Stack'],
    design: ['Package layout'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
  'a.http_framework': {
    proposal: ['Constraints Measured Up Front'],
    design: ['Package layout'],
    tasks: ['Phase 3: Constraints and measurement'],
  },
};

/** The targets for one answer, or an empty set when the id is unmapped. */
export function targetsFor(id: AnswerId): AnswerTargets {
  return MAP[id] ?? { proposal: [], design: [], tasks: [] };
}
