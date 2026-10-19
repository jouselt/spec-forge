/**
 * Bringing an existing spec into the app.
 *
 * The point of an import is that the text survives. A person pastes the
 * `proposal.md` they already wrote, and from then on no generation may rewrite a
 * sentence of it. So every parsed section becomes a block with
 * `origin.kind = 'imported'` and `locked = true`, and the merge in `core/merge.ts`
 * refuses to touch a locked section.
 *
 * One block per section, not one per paragraph: the body keeps its own blank lines
 * and list markers inside a single block, so nothing is reflowed on the way in or
 * on the way back out. Splitting into paragraphs would mean rebuilding the blank
 * lines between them on render, which is a way to lose a person's formatting.
 */

import { Block, GeneratedDoc } from './question-graph';
import { SpecFile, canonicalSectionName } from './mapping';

/** What the import found, and what it could not place. */
export interface ImportResult {
  readonly doc: GeneratedDoc;
  /** Canonical section names, in the order the file has them. */
  readonly sections: readonly string[];
  /** Headings the mapping table does not know, kept verbatim and still locked. */
  readonly unmapped: readonly string[];
  /** The `# Title` line before the first `##`, which is not a section. */
  readonly title: string | null;
}

const SECTION_HEADING = /^##\s+(.+?)\s*$/;
const TITLE_HEADING = /^#\s+(.+?)\s*$/;

function slugOf(section: string): string {
  return section
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse a markdown file into locked, imported blocks.
 *
 * Text before the first `##` heading is the document title, not a section, and is
 * reported rather than turned into a block: a title is not spec content and a
 * block for it would appear in every provenance count and every export.
 */
export function importSpec(text: string, file: SpecFile = 'proposal'): ImportResult {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  const sections: string[] = [];
  const unmapped: string[] = [];
  let title: string | null = null;
  let current: { heading: string; canonical: string; body: string[] } | null = null;

  const flush = (): void => {
    if (!current) {
      return;
    }

    const body = current.body.join('\n').replace(/^\n+/, '').replace(/\s+$/, '');
    const canonical = canonicalSectionName(current.heading) ?? current.heading;

    sections.push(canonical);

    if (canonicalSectionName(current.heading) === null) {
      unmapped.push(current.heading);
    }

    blocks.push({
      id: `${file}:${slugOf(canonical)}:imported`,
      file,
      section: canonical,
      ord: blocks.filter((block) => block.section === canonical).length,
      text: body,
      origin: { kind: 'imported', section: current.heading },
      review: 'unreviewed',
      locked: true,
    });

    current = null;
  };

  for (const line of lines) {
    const sectionMatch = SECTION_HEADING.exec(line);

    if (sectionMatch) {
      flush();
      current = { heading: sectionMatch[1], canonical: sectionMatch[1], body: [] };
      continue;
    }

    if (!current) {
      const titleMatch = TITLE_HEADING.exec(line);

      if (titleMatch && title === null) {
        title = titleMatch[1];
      }

      continue;
    }

    current.body.push(line);
  }

  flush();

  return {
    doc: {
      file,
      blocks,
      version: 1,
      generatedAt: 0,
      path: 'template',
    },
    sections,
    unmapped,
    title,
  };
}
