/**
 * What a regeneration would change, one section at a time.
 *
 * Regenerating is the one action that can destroy work a person did, so it never
 * applies itself: the candidate is diffed against what is on screen, a person takes
 * or leaves each section, and only then does the text change. A locked section is
 * reported as unchanged and is never applied, no matter what was accepted, because
 * a lock is a refusal and not a default answer.
 */

import { Block, GeneratedDoc } from './question-graph';
import { SpecFile } from './mapping';

export type LineChange = 'same' | 'added' | 'removed';

export interface DiffLine {
  readonly kind: LineChange;
  readonly text: string;
}

export interface SectionDiff {
  readonly file: SpecFile;
  readonly section: string;
  /** Text differs and the section is not locked, so accepting it would change it. */
  readonly changed: boolean;
  /** The section holds a locked block: it can be seen but never applied. */
  readonly locked: boolean;
  readonly before: string;
  readonly after: string;
  readonly lines: readonly DiffLine[];
}

/** The key a decision is expressed in. One section of one file. */
export function sectionKey(file: SpecFile, section: string): string {
  return `${file}:${section}`;
}

/**
 * The longest common subsequence of two line lists, as a diff.
 *
 * A table, not a clever algorithm: a section is a handful of lines and the cost of
 * being wrong here is text a person wrote. O(n*m) on lines within one section is
 * nothing.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const left = before.split('\n');
  const right = after.split('\n');
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0),
  );

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        left[i] === right[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      lines.push({ kind: 'same', text: left[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      lines.push({ kind: 'removed', text: left[i] });
      i += 1;
    } else {
      lines.push({ kind: 'added', text: right[j] });
      j += 1;
    }
  }

  while (i < left.length) {
    lines.push({ kind: 'removed', text: left[i] });
    i += 1;
  }

  while (j < right.length) {
    lines.push({ kind: 'added', text: right[j] });
    j += 1;
  }

  return lines;
}

/** The sections of a document keyed by name, with their blocks in order. */
function sectionsOf(doc: GeneratedDoc | undefined): Map<string, Block[]> {
  const map = new Map<string, Block[]>();

  for (const block of doc?.blocks ?? []) {
    const existing = map.get(block.section);

    if (existing) {
      existing.push(block);
    } else {
      map.set(block.section, [block]);
    }
  }

  return map;
}

/** How a section reads in the file: its blocks, one blank line apart. */
function textOf(blocks: readonly Block[]): string {
  return blocks.map((block) => block.text).join('\n\n');
}

function isLocked(blocks: readonly Block[]): boolean {
  return blocks.some((block) => block.locked);
}

/**
 * Every section of both documents, in the order the file will read: the current
 * order first, then anything the candidate adds.
 */
export function diffSections(current: GeneratedDoc, candidate: GeneratedDoc): SectionDiff[] {
  const before = sectionsOf(current);
  const after = sectionsOf(candidate);
  const order = [...before.keys(), ...[...after.keys()].filter((section) => !before.has(section))];

  return order.map((section) => {
    const beforeBlocks = before.get(section) ?? [];
    const afterBlocks = after.get(section) ?? [];
    const beforeText = textOf(beforeBlocks);
    const afterText = textOf(afterBlocks);
    const locked = isLocked(beforeBlocks);

    return {
      file: current.file,
      section,
      changed: !locked && beforeText !== afterText,
      locked,
      before: beforeText,
      after: afterText,
      lines: diffLines(beforeText, afterText),
    };
  });
}

/**
 * Apply the accepted sections of a candidate to a document.
 *
 * Locked sections are skipped whatever the accepted set says, and so is a section
 * that did not change: accepting a no-op must cost nothing.
 */
export function applySectionChoices(
  current: GeneratedDoc,
  candidate: GeneratedDoc,
  accepted: ReadonlySet<string>,
): GeneratedDoc {
  const diffs = new Map(
    diffSections(current, candidate).map((diff) => [diff.section, diff] as const),
  );
  const before = sectionsOf(current);
  const after = sectionsOf(candidate);
  const order = [
    ...before.keys(),
    ...[...after.keys()].filter((section) => !before.has(section)),
  ];

  const blocks: Block[] = [];

  for (const section of order) {
    const diff = diffs.get(section);
    const takeCandidate =
      diff !== undefined && diff.changed && accepted.has(sectionKey(current.file, section));

    const source = takeCandidate ? (after.get(section) ?? []) : (before.get(section) ?? []);

    blocks.push(...source.map((block) => ({ ...block })));
  }

  return { ...current, blocks };
}

/** The sections of a candidate a person would have to decide about. */
export function changedSections(current: GeneratedDoc, candidate: GeneratedDoc): string[] {
  return diffSections(current, candidate)
    .filter((diff) => diff.changed)
    .map((diff) => diff.section);
}
