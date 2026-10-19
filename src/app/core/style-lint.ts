/**
 * Style lint: the em dash and the banned vocabulary.
 *
 * A finding names the block it came from, not just the file, so the export gate
 * can point at the text that has to change. One finding per rule per block is
 * enough to act on, and counting repeats of the same word would only add noise to
 * a report a person reads.
 */

import { GeneratedDoc, Block } from './question-graph';
import { SpecFile } from './mapping';
import { BANNED_WORDS, EM_DASH } from './banned-words';

export type StyleKind = 'em-dash' | 'banned-word';

/** One rule hit inside one string. */
export interface StyleHit {
  readonly kind: StyleKind;
  readonly word: string;
  readonly at: number;
}

/** One rule hit inside one block of one file. */
export interface StyleFinding extends StyleHit {
  readonly file: SpecFile;
  readonly blockId: string;
  readonly excerpt: string;
}

/**
 * Built once. The phase 6 budget is a gate that runs on every keystroke-driven
 * render, so the patterns are compiled at module load rather than per call.
 *
 * The suffix set covers the inflections the words actually appear in, and the
 * stem drops a trailing `e` first so that the e-final words work: "showcase"
 * becomes "showcase / showcases / showcased / showcasing", and without the drop
 * "showcasing" would be missed because the `e` is gone in that form. Derived
 * adverbs are not inflections and are not matched: "fundamentally" is a different
 * word from "fundamental".
 */
const WORD_PATTERNS: readonly { readonly word: string; readonly pattern: RegExp }[] =
  BANNED_WORDS.map((word) => ({
    word,
    pattern: new RegExp(
      `\\b${word.endsWith('e') ? word.slice(0, -1) : word}(e|es|ed|ing|s|d)?\\b`,
      'i',
    ),
  }));

function excerptAround(text: string, at: number): string {
  const start = Math.max(0, at - 24);
  const end = Math.min(text.length, at + 32);

  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

/** Every style hit in one string, in rule order. */
export function lintText(text: string): StyleHit[] {
  const hits: StyleHit[] = [];
  const dashAt = text.indexOf(EM_DASH);

  if (dashAt >= 0) {
    hits.push({ kind: 'em-dash', word: EM_DASH, at: dashAt });
  }

  for (const { word, pattern } of WORD_PATTERNS) {
    const match = pattern.exec(text);

    if (match) {
      hits.push({ kind: 'banned-word', word, at: match.index });
    }
  }

  return hits;
}

/** Every style hit across the generated documents. */
export function lintStyle(docs: readonly GeneratedDoc[]): StyleFinding[] {
  const findings: StyleFinding[] = [];

  for (const doc of docs) {
    for (const block of doc.blocks as Block[]) {
      for (const hit of lintText(block.text)) {
        findings.push({
          ...hit,
          file: doc.file,
          blockId: block.id,
          excerpt: excerptAround(block.text, hit.at),
        });
      }
    }
  }

  return findings;
}
