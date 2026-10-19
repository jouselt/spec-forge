/**
 * Did the model cite anything, or did it make things up in a confident voice?
 *
 * The shaping prompt asks for `[[answer:N]]` on every factual sentence. This file reads
 * those marks back and turns them into the number that decides whether the run is used at
 * all:
 *
 * - at or above 0.80 the text is accepted quietly;
 * - between 0.60 and 0.80 it is accepted with a banner that names the percentage, so the
 *   person knows which number they are looking at;
 * - under 0.60 the run fails and the template output stays on screen, byte identical.
 *
 * The third branch is the whole reason the other two exist. A model that stops citing is
 * not a model that needs a warning; it is a model whose output nobody can check, and the
 * template path is already correct.
 */

import { Block, GeneratedDoc } from '../core/question-graph';
import { SpecFile } from '../core/mapping';

/** Below this, the run is thrown away. */
export const MIN_COVERAGE = 0.6;

/** At or above this, no banner. */
export const GOOD_COVERAGE = 0.8;

export type CoverageVerdict = 'accept' | 'accept-with-banner' | 'reject';

export interface MarkedSentence {
  /** The sentence with the markers stripped out. */
  readonly text: string;
  /** The 1-based answer numbers it cited, in the order they appeared. */
  readonly answerIndexes: readonly number[];
  readonly marked: boolean;
}

export interface CoverageReport {
  readonly total: number;
  readonly marked: number;
  readonly coverage: number;
  readonly verdict: CoverageVerdict;
  readonly banner: string | null;
  readonly sentences: readonly MarkedSentence[];
}

const MARKER = /\[\[answer:(\d+)\]\]/g;

/**
 * Split prose into sentences, keeping the punctuation.
 *
 * Splitting on the boundary and not on a repeated pattern, because a marker that follows
 * the full stop is not a sentence: `A fact. [[answer:2]]` has to stay one sentence or the
 * marker is counted against nothing and the citation is thrown away. Anything that starts
 * with markers is therefore glued back onto the sentence before it.
 */
export function splitSentences(text: string): string[] {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return [];
  }

  const sentences: string[] = [];

  for (const part of trimmed.split(/(?<=[.!?])\s+/)) {
    let piece = part.trim();
    const leading = piece.match(/^(?:\[\[answer:\d+\]\]\s*)+/);

    // A marker trails the sentence it belongs to, so a marker at the start of a fragment
    // attaches to the sentence before it and the rest of the fragment is its own sentence.
    // `A fact. [[answer:1]] An invented fact.` is therefore a cited sentence followed by an
    // uncited one, which is exactly the split the export gate needs to see.
    if (leading && sentences.length > 0) {
      sentences[sentences.length - 1] = `${sentences[sentences.length - 1]} ${leading[0].trim()}`;
      piece = piece.slice(leading[0].length).trim();
    }

    if (piece.length > 0) {
      sentences.push(piece);
    }
  }

  return sentences;
}

/** One sentence, with its markers read and removed. */
export function parseMarkers(sentence: string): MarkedSentence {
  const answerIndexes: number[] = [];

  for (const match of sentence.matchAll(MARKER)) {
    const index = Number.parseInt(match[1], 10);

    if (Number.isInteger(index) && index > 0) {
      answerIndexes.push(index);
    }
  }

  const text = sentence.replace(MARKER, '').replace(/\s{2,}/g, ' ').trim();

  return { text, answerIndexes, marked: answerIndexes.length > 0 };
}

/** The verdict for one coverage number. */
export function routeCoverage(coverage: number): CoverageVerdict {
  if (coverage >= GOOD_COVERAGE) {
    return 'accept';
  }

  return coverage >= MIN_COVERAGE ? 'accept-with-banner' : 'reject';
}

/** What the banner says, or null when there is nothing to say. */
export function coverageBanner(coverage: number, verdict: CoverageVerdict): string | null {
  if (verdict === 'accept') {
    return null;
  }

  const percent = Math.round(coverage * 100);

  if (verdict === 'reject') {
    return `${percent}% of the sentences cite an answer, under the ${Math.round(MIN_COVERAGE * 100)}% needed to use this run. Your template output is unchanged.`;
  }

  return `${percent}% of the sentences cite an answer. The rest are the model's own wording and are marked as such for review.`;
}

/** Read a whole shaping result and decide what to do with it. */
export function measureCoverage(text: string): CoverageReport {
  const sentences = splitSentences(text).map(parseMarkers);
  const total = sentences.length;
  const marked = sentences.filter((sentence) => sentence.marked).length;
  const coverage = total === 0 ? 0 : marked / total;
  const verdict = routeCoverage(coverage);

  return { total, marked, coverage, verdict, banner: coverageBanner(coverage, verdict), sentences };
}

/**
 * Turn accepted shaped text into blocks.
 *
 * Marked sentences become `origin.kind = 'answer'` naming the answers they cited.
 * Unmarked ones become **separate blocks** with `origin.kind = 'model'` and
 * `review = 'unreviewed'`, because the export gate blocks on exactly that state: a
 * sentence nobody can check has to be visible as one sentence, not folded into a paragraph
 * of cited text where it would inherit the other sentences' credibility.
 */
export function blocksFromShaped(
  text: string,
  file: SpecFile,
  section: string,
  modelId: string,
  answers: readonly { id: string }[],
  temperature: number,
): Block[] {
  const report = measureCoverage(text);
  const blocks: Block[] = [];
  let ordinal = 0;

  for (const sentence of report.sentences) {
    if (sentence.text.length === 0) {
      continue;
    }

    const cited = sentence.answerIndexes
      .map((index) => answers[index - 1]?.id)
      .filter((id): id is string => typeof id === 'string');

    blocks.push({
      id: `${file}:${section}:shaped${ordinal}`,
      file,
      section,
      ord: ordinal,
      text: sentence.text,
      origin: sentence.marked
        ? { kind: 'answer', answerIds: cited, frame: 'shaped' }
        : { kind: 'model', modelId, basedOn: [], temperature },
      review: sentence.marked ? 'confirmed' : 'unreviewed',
      locked: false,
    });

    ordinal += 1;
  }

  return blocks;
}

/** The shaped result as a document, or null when the coverage was too low to use. */
export function shapedDoc(
  text: string,
  file: SpecFile,
  section: string,
  modelId: string,
  answers: readonly { id: string }[],
  temperature: number,
): GeneratedDoc | null {
  const report = measureCoverage(text);

  if (report.verdict === 'reject') {
    return null;
  }

  return {
    file,
    blocks: blocksFromShaped(text, file, section, modelId, answers, temperature),
    version: 1,
    generatedAt: 0,
    path: 'shaped',
  };
}
