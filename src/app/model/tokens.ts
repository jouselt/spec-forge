/**
 * How many tokens a string will cost, estimated.
 *
 * Two estimators and the larger one, because being wrong low is the failure that matters:
 * an underestimated prompt overflows a 4096-token window and the run dies mid-file with
 * half a document on screen.
 *
 * The word "estimate" belongs in the label and in the type name. This is arithmetic on
 * character counts, not a tokenizer: a real tokenizer would mean shipping the model's
 * vocabulary before the model.
 */

import { SpecFile } from '../core/mapping';

/** How many characters per token, roughly, for this family of models. */
const CHARS_PER_TOKEN = 4;

/** How many tokens per word, roughly, once punctuation and long words are counted. */
const TOKENS_PER_WORD = 1.3;

/** Used everywhere the number appears, so it cannot drift into looking exact. */
export const ESTIMATE_LABEL = 'estimated tokens';

/** The estimate: `max(chars / 4, words * 1.3)`, rounded up. */
export function estimateTokens(text: string): number {
  const chars = text.length;
  const words = text.split(/\s+/).filter((word) => word.length > 0).length;

  return Math.ceil(Math.max(chars / CHARS_PER_TOKEN, words * TOKENS_PER_WORD));
}

/** How a number is written next to the word estimate. */
export function describeEstimate(tokens: number): string {
  return `~${tokens} ${ESTIMATE_LABEL}`;
}

/** Tokens reserved for the model's own scaffolding around the prompt. */
export const PROMPT_OVERHEAD = 256;

/**
 * How much room each file's answer needs left over.
 *
 * Different per file because the files are different lengths: `design.md` is the long one,
 * `proposal.md` the short one. These are the numbers a run is refused against.
 */
export const OUTPUT_RESERVE: Readonly<Record<SpecFile, number>> = {
  proposal: 900,
  design: 1400,
  tasks: 1100,
};
