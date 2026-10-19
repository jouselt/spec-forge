/**
 * Generation meets the text a person already wrote.
 *
 * A lock is not a preference, it is a refusal: a section holding a locked block is
 * copied through a regeneration untouched, byte for byte, and the generator only
 * fills the sections nobody protected.
 *
 * Section granularity, not block. Block ids are positional (`file:section:ord`), so
 * a regenerated section can produce a different number of blocks and there is no
 * honest way to line a locked block up with its replacement. Protecting the whole
 * section is a rule a person can predict from the badge they see.
 */

import { Block, GeneratedDoc } from './question-graph';
import { diffSections } from './diff';
import { SpecFile } from './mapping';

/** Sections of one file that hold at least one locked block. */
export function lockedSections(doc: GeneratedDoc | undefined): Set<string> {
  const sections = new Set<string>();

  if (!doc) {
    return sections;
  }

  for (const block of doc.blocks) {
    if (block.locked) {
      sections.add(block.section);
    }
  }

  return sections;
}

/**
 * Put the protected sections of `current` back into `generated`, in the place the
 * generator wanted that section, and leave everything else alone.
 */
export function mergeGeneration(
  current: readonly GeneratedDoc[],
  generated: readonly GeneratedDoc[],
): GeneratedDoc[] {
  return generated.map((doc) => {
    const before = current.find((candidate) => candidate.file === doc.file);
    const protectedSections = lockedSections(before);

    if (!before || protectedSections.size === 0) {
      return doc;
    }

    const kept: Block[] = before.blocks
      .filter((block) => protectedSections.has(block.section))
      .map((block) => ({ ...block }));

    const merged: Block[] = [];
    const placed = new Set<string>();

    for (const block of doc.blocks) {
      if (!protectedSections.has(block.section)) {
        merged.push(block);
        continue;
      }

      if (placed.has(block.section)) {
        continue;
      }

      placed.add(block.section);
      merged.push(...kept.filter((candidate) => candidate.section === block.section));
    }

    // A protected section the generator did not emit at all still belongs in the
    // file: the person wrote it, so dropping it would be the exact failure this
    // whole phase exists to prevent.
    for (const section of protectedSections) {
      if (!placed.has(section)) {
        merged.push(...kept.filter((candidate) => candidate.section === section));
      }
    }

    return {
      ...doc,
      blocks: merged,
      path: doc.path === before.path ? doc.path : 'mixed',
    };
  });
}

/** Does this document hold any text a generation may not overwrite? */
export function hasLockedBlocks(docs: readonly GeneratedDoc[]): boolean {
  return docs.some((doc) => doc.blocks.some((block) => block.locked));
}

/**
 * Would applying these candidates change anything a person would notice?
 *
 * Used to skip the review step when there is nothing to review: a proposal that
 * changes nothing is noise, and asking about it would teach a person to click
 * through the one that mattered.
 */
export function hasAnyChange(
  current: readonly GeneratedDoc[],
  candidate: readonly GeneratedDoc[],
): boolean {
  return changedSectionCount(current, candidate) > 0;
}

/** How many sections across the three files a generation would change. */
export function changedSectionCount(
  current: readonly GeneratedDoc[],
  candidate: readonly GeneratedDoc[],
): number {
  let total = 0;

  for (const doc of candidate) {
    const before = current.find((existing) => existing.file === doc.file);

    if (!before) {
      total += doc.blocks.length > 0 ? 1 : 0;
      continue;
    }

    total += diffSections(before, doc).filter((diff) => diff.changed).length;
  }

  return total;
}

/** The sections of one file that a generation would leave alone. */
export function lockedSectionNames(docs: readonly GeneratedDoc[], file: SpecFile): string[] {
  const doc = docs.find((candidate) => candidate.file === file);

  return doc ? [...lockedSections(doc)] : [];
}
