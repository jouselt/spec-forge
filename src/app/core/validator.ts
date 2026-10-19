/**
 * Structure validation for the three generated files.
 *
 * Two severities, because two different things are being said. `block` means the
 * file is not a spec yet: a required section is missing, a placeholder survived,
 * or `tasks.md` is not shaped like a task list. `warn` means the file is a spec
 * but a person should look: an acceptance criterion nobody could check, or a task
 * list far outside the range the existing specs occupy.
 *
 * Nothing here deletes anything. A criterion without a number is flagged and left
 * exactly where the user put it.
 */

import { Block, GeneratedDoc } from './question-graph';
import { SpecFile, canonicalSectionName, sectionsFor } from './mapping';

export type Severity = 'block' | 'warn';

export type ValidationCode =
  | 'missing-required-section'
  | 'placeholder-survives'
  | 'tasks-too-few-phases'
  | 'tasks-item-not-checkbox'
  | 'tasks-item-untagged'
  | 'tasks-missing-definition-of-done'
  | 'acceptance-criterion-shape'
  | 'tasks-item-count';

export interface ValidationFinding {
  readonly file: SpecFile;
  readonly code: ValidationCode;
  readonly severity: Severity;
  readonly section?: string;
  readonly blockId?: string;
  readonly detail: string;
}

/** The file that closes `tasks.md`. */
export const DEFINITION_OF_DONE = 'Definition of Done';

/** The range the three deepest existing specs occupy, widened at both ends. */
export const TASK_ITEM_RANGE = { min: 40, max: 90 } as const;

/** Phases a task list needs before it can call itself a plan. */
export const MINIMUM_PHASES = 3;

const PLACEHOLDER = /\{\{MISSING:/;
const CHECKBOX_ITEM = /^[-*] \[[ xX]\] /;
const LIST_ITEM = /^[-*] /;
const TAG = /\[(G|E|M)\]/;

const NUMBER = /\d/;

const UNIT =
  /\b(ms|milliseconds?|s|secs?|seconds?|m|mins?|minutes?|h|hours?|days?|weeks?|months?|kB|KB|MB|GB|px|rem|%|tokens?|req\/s|rps|fps|mbps|requests?)\b/i;

const NAMED_IDENTIFIER = /`[^`]+`|"[^"]+"|\b[a-z]+[A-Z]\w*\b|\b[A-Z]\w*[A-Z]\w*\b|\b\w+[._]\w+\b/;

const COMPARISON =
  /(<=|>=|===|==|<|>|\bat least\b|\bat most\b|\bunder\b|\bover\b|\bwithin\b|\bno more than\b|\bno fewer than\b|\bfewer than\b|\bmore than\b|\bless than\b|\bgreater than\b)/i;

/**
 * Does this acceptance criterion name something a machine or a person could
 * check? A number, a unit, a named identifier, or a comparison. Prose that has
 * none of those is a wish, not a criterion.
 */
export function hasCheckableShape(text: string): boolean {
  return NUMBER.test(text) || UNIT.test(text) || NAMED_IDENTIFIER.test(text) || COMPARISON.test(text);
}

/** Is this block a list item, as `tasks.md` writes them? */
export function isListItem(block: Block): boolean {
  return LIST_ITEM.test(block.text.trim());
}

/** Is this block a checkbox item? */
export function isCheckboxItem(block: Block): boolean {
  return CHECKBOX_ITEM.test(block.text.trim());
}

/** Does this block carry its `[G]`, `[E]` or `[M]` tag? */
export function isTagged(block: Block): boolean {
  return TAG.test(block.text);
}

function canonical(section: string): string {
  return canonicalSectionName(section) ?? section;
}

function validateStructure(doc: GeneratedDoc): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const present = new Set(doc.blocks.map((block) => canonical(block.section)));

  for (const section of sectionsFor(doc.file)) {
    if (section.required && !present.has(canonical(section.name))) {
      findings.push({
        file: doc.file,
        code: 'missing-required-section',
        severity: 'block',
        section: section.name,
        detail: `${doc.file}.md has no ${section.name} section`,
      });
    }
  }

  return findings;
}

function validatePlaceholders(doc: GeneratedDoc): ValidationFinding[] {
  return doc.blocks
    .filter((block) => PLACEHOLDER.test(block.text))
    .map((block) => ({
      file: doc.file,
      code: 'placeholder-survives' as const,
      severity: 'block' as const,
      section: block.section,
      blockId: block.id,
      detail: `${block.section} still holds a gap: ${block.text.trim()}`,
    }));
}

function validateAcceptanceCriteria(doc: GeneratedDoc): ValidationFinding[] {
  const sections = new Set(
    ['Acceptance Criteria', 'Acceptance criteria (design-verifiable)'].map(canonical),
  );

  return doc.blocks
    .filter((block) => sections.has(canonical(block.section)) && isListItem(block))
    .filter((block) => !hasCheckableShape(block.text))
    .map((block) => ({
      file: doc.file,
      code: 'acceptance-criterion-shape' as const,
      severity: 'warn' as const,
      section: block.section,
      blockId: block.id,
      detail: `No number, unit, identifier or comparison in: ${block.text.trim()}`,
    }));
}

function validateTasks(doc: GeneratedDoc): ValidationFinding[] {
  if (doc.file !== 'tasks') {
    return [];
  }

  const findings: ValidationFinding[] = [];
  const phases = doc.blocks.filter((block) => canonical(block.section).startsWith('Phase '));
  const phaseNames = new Set(phases.map((block) => canonical(block.section)));
  const items = doc.blocks.filter(isListItem);

  if (phaseNames.size < MINIMUM_PHASES) {
    findings.push({
      file: 'tasks',
      code: 'tasks-too-few-phases',
      severity: 'block',
      detail: `${phaseNames.size} phases, and a task list needs at least ${MINIMUM_PHASES}`,
    });
  }

  for (const block of items) {
    if (!isCheckboxItem(block)) {
      findings.push({
        file: 'tasks',
        code: 'tasks-item-not-checkbox',
        severity: 'block',
        section: block.section,
        blockId: block.id,
        detail: `Not a checkbox item: ${block.text.trim()}`,
      });
    }

    if (!isTagged(block)) {
      findings.push({
        file: 'tasks',
        code: 'tasks-item-untagged',
        severity: 'block',
        section: block.section,
        blockId: block.id,
        detail: `No [G], [E] or [M] tag: ${block.text.trim()}`,
      });
    }
  }

  const lastSection = doc.blocks.length
    ? canonical(doc.blocks[doc.blocks.length - 1].section)
    : '';

  if (lastSection !== DEFINITION_OF_DONE) {
    findings.push({
      file: 'tasks',
      code: 'tasks-missing-definition-of-done',
      severity: 'block',
      detail: `tasks.md ends with ${lastSection || 'nothing'} instead of ${DEFINITION_OF_DONE}`,
    });
  }

  if (items.length < TASK_ITEM_RANGE.min || items.length > TASK_ITEM_RANGE.max) {
    findings.push({
      file: 'tasks',
      code: 'tasks-item-count',
      severity: 'warn',
      detail: `${items.length} items, outside ${TASK_ITEM_RANGE.min} to ${TASK_ITEM_RANGE.max}: the spec is probably ${
        items.length < TASK_ITEM_RANGE.min ? 'too thin' : 'too granular'
      }`,
    });
  }

  return findings;
}

/** Every finding for one document. */
export function validateDoc(doc: GeneratedDoc): ValidationFinding[] {
  return [
    ...validateStructure(doc),
    ...validatePlaceholders(doc),
    ...validateAcceptanceCriteria(doc),
    ...validateTasks(doc),
  ];
}

/** Every finding across the generated documents. */
export function validate(docs: readonly GeneratedDoc[]): ValidationFinding[] {
  return docs.flatMap(validateDoc);
}

/** The blocking findings only. */
export function blockingFindings(findings: readonly ValidationFinding[]): ValidationFinding[] {
  return findings.filter((finding) => finding.severity === 'block');
}
