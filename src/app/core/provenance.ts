/**
 * Block tagging helpers: the provenance layer that turns rendered text into a
 * `Block`.
 *
 * The types themselves (`Origin`, `Block`, `ReviewState`, `narrowOrigin`,
 * `isSourced`, `isBlockExportReady`) live in `question-graph.ts` and are tested
 * there. This module only builds and inspects them, so every producer of text in
 * the app tags a block the same way.
 *
 * Two invariants matter downstream:
 * - a block either names the answers it came from, or is explicitly `missing`;
 * - a template run produces no `model` origin, which is what makes the export
 *   gate a real gate rather than a decoration.
 */

import { AnswerId, Block, Origin, OriginKind, ReviewState } from './question-graph';

export interface BlockInput {
  readonly file: Block['file'];
  readonly section: string;
  readonly ord: number;
  readonly text: string;
  readonly origin: Origin;
  readonly review?: ReviewState;
  readonly locked?: boolean;
}

/** Section headings become ids: `proposal:constraints-measured-up-front:p0`. */
export function sectionSlug(section: string): string {
  return section
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Stable block id: file, section slug and position, e.g. `proposal:goal:p0`. */
export function blockId(file: Block['file'], section: string, ord: number): string {
  return `${file}:${sectionSlug(section)}:p${ord}`;
}

/** Text a template frame produced from the named answers. Sourced. */
export function templateOrigin(frame: string, inputs: AnswerId[]): Origin {
  return { kind: 'template', frame, inputs: [...inputs] };
}

/** Text carried from an answer without a frame. Sourced. */
export function answerOrigin(answerIds: AnswerId[], frame: string): Origin {
  return { kind: 'answer', answerIds: [...answerIds], frame };
}

/** A gap: the placeholder names the question that would fill the section. */
export function missingOrigin(question: string): Origin {
  return { kind: 'missing', placeholder: question };
}

/** Build a block, defaulting the review state and the lock. */
export function tagBlock(input: BlockInput): Block {
  return {
    id: blockId(input.file, input.section, input.ord),
    file: input.file,
    section: input.section,
    ord: input.ord,
    text: input.text,
    origin: input.origin,
    review: input.review ?? 'unreviewed',
    locked: input.locked ?? false,
  };
}

/** A block rendered from a template frame, naming the answers it used. */
export function templateBlock(input: {
  file: Block['file'];
  section: string;
  ord: number;
  frame: string;
  inputs: AnswerId[];
  text: string;
}): Block {
  return tagBlock({ ...input, origin: templateOrigin(input.frame, input.inputs) });
}

/** `{{MISSING: <question>}}`, the only text a gap may carry. */
export function placeholderFor(question: string): string {
  return `{{MISSING: ${question}}}`;
}

/** The question inside a placeholder, or null when the text is not one. */
export function parsePlaceholder(text: string): string | null {
  const match = /^\{\{MISSING:\s*([\s\S]+?)\}\}$/.exec(text.trim());
  return match ? match[1].trim() : null;
}

export function isPlaceholder(text: string): boolean {
  return parsePlaceholder(text) !== null;
}

/** A gap block. It carries no prose, only the placeholder. */
export function missingBlock(input: {
  file: Block['file'];
  section: string;
  ord: number;
  question: string;
}): Block {
  return tagBlock({
    file: input.file,
    section: input.section,
    ord: input.ord,
    text: placeholderFor(input.question),
    origin: missingOrigin(input.question),
  });
}

/**
 * The answers a block names. Empty for a gap, which is the point: a gap names a
 * question, not an answer.
 */
export function sourceAnswerIds(origin: Origin): AnswerId[] {
  switch (origin.kind) {
    case 'answer':
      return origin.answerIds;
    case 'template':
      return origin.inputs;
    case 'model':
      return origin.basedOn;
    case 'edited':
      return origin.derivedFrom ? sourceAnswerIds(origin.derivedFrom) : [];
    default:
      return [];
  }
}

/** Counts per origin kind, with every kind present so a panel can render a row each. */
export function countByOriginKind(blocks: Block[]): Record<OriginKind, number> {
  const counts: Record<OriginKind, number> = {
    answer: 0,
    template: 0,
    model: 0,
    imported: 0,
    edited: 0,
    missing: 0,
  };

  for (const block of blocks) {
    counts[block.origin.kind] += 1;
  }

  return counts;
}

/** True when any block was inferred by a model. A template run must be false. */
export function hasModelOrigin(blocks: Block[]): boolean {
  return blocks.some((block) => block.origin.kind === 'model');
}

/** Blocks whose text is a surviving placeholder. The export gate looks for these. */
export function gapBlocks(blocks: Block[]): Block[] {
  return blocks.filter((block) => block.origin.kind === 'missing');
}
