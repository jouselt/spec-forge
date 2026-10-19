/**
 * The style rules this repository holds itself to, in one place.
 *
 * The list lives in `banned-words.json` rather than here so the app and the node
 * lint script in `evals/style/run.mjs` read the same bytes. Two copies would
 * drift, and a lint that disagrees with itself is worse than no lint.
 *
 * The words are the ones the repository's own style rule bans: the vocabulary
 * that makes prose sound generated. The list is 19 words, not the 18 the phase
 * notes predicted, because the rule it was taken from lists 19.
 */

import rules from './banned-words.json';

/** The character that must never appear in a spec. */
export const EM_DASH: string = rules.emDash;

/** Every banned word, lower case, in the order the rule lists them. */
export const BANNED_WORDS: readonly string[] = rules.words;
