/**
 * The gaps a model leaves behind, and how they become questions.
 *
 * A model with nothing to say about a fact is asked to write `{{MISSING: <question>}}`
 * rather than to invent. Those chips are the most useful thing the model path produces:
 * they are the interview telling you which question it should have asked.
 *
 * Promoting one appends a real question to the interview with `source = 'promoted'` and the
 * placeholder text as its prompt, so the next run has the answer it was missing. That is
 * the loop closing without a server and without an API key.
 */

import { Answer, Question } from '../core/question-graph';

export interface PlaceholderChip {
  /** The question the model could not answer, verbatim. */
  readonly question: string;
  /** Where it appeared, so a promotion can name the file and section. */
  readonly file: string;
  readonly section: string;
  /** The whole `{{MISSING: ...}}` token as it appeared, for a faithful rewrite. */
  readonly raw: string;
}

const PLACEHOLDER = /\{\{MISSING:\s*([^}]*?)\s*\}\}/g;

/**
 * Find the chips in one block of text.
 *
 * A malformed token is not a chip and is left in the text alone. The alternative, guessing
 * at what somebody meant, would put words in the model's mouth and then ask the person to
 * answer them.
 */
export function findPlaceholders(text: string, file: string, section: string): PlaceholderChip[] {
  const chips: PlaceholderChip[] = [];

  for (const match of text.matchAll(PLACEHOLDER)) {
    const question = match[1].trim();

    if (question.length === 0) {
      continue;
    }

    chips.push({ question, file, section, raw: match[0] });
  }

  return chips;
}

/** The chips across a set of blocks, in reading order, without duplicates. */
export function allPlaceholders(
  blocks: readonly { text: string; file: string; section: string }[],
): PlaceholderChip[] {
  const seen = new Set<string>();
  const chips: PlaceholderChip[] = [];

  for (const block of blocks) {
    for (const chip of findPlaceholders(block.text, block.file, block.section)) {
      const key = `${chip.file}:${chip.section}:${chip.question}`;

      if (!seen.has(key)) {
        seen.add(key);
        chips.push(chip);
      }
    }
  }

  return chips;
}

/** A chip as a question the interview can ask. */
export function questionForChip(chip: PlaceholderChip, step: number): Question {
  return {
    id: `promoted.${slugOf(chip.question)}`,
    step,
    prompt: chip.question,
    help: `The model could not answer this for ${chip.file}.md, in ${chip.section}.`,
    kind: 'longtext',
    required: false,
  };
}

/** A chip as a question plus the answer stub a wizard store appends. */
export function promotedAnswer(chip: PlaceholderChip, question: Question, text: string, now: number): Answer {
  return {
    id: question.id,
    questionId: question.id,
    text,
    kind: question.kind,
    askedAt: now,
    source: 'promoted',
  };
}

/** Deterministic id from the question text, so promoting the same chip twice is the same question. */
export function slugOf(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
