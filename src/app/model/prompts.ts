/**
 * The three shaping prompts, one per file.
 *
 * Two instructions carry the whole design, and both are in every prompt because a prompt
 * without them produces prose that reads well and cannot be checked:
 *
 * 1. every factual sentence ends with `[[answer:N]]`, N being the number of the answer it
 *    came from;
 * 2. any fact with no answer behind it is written as `{{MISSING: <the question to ask>}}`,
 *    never guessed.
 *
 * Written here as plain strings rather than as a builder, so a test can assert both
 * instructions are present without running a model. The prompts are the contract; the
 * model is the thing on the other side of it.
 */

import { Answer } from '../core/question-graph';
import { SpecFile } from '../core/mapping';

/** The instruction both rules come from, repeated in each prompt. */
export const SHAPING_RULES = [
  'Every factual sentence must end with its source, written as [[answer:N]] where N is the number of the numbered answer it came from.',
  'If a fact is needed and no answer supports it, write {{MISSING: <the question that would get it>}} instead of a fact. Never invent.',
  'Do not add sentences that carry no fact. No preamble, no closing summary.',
].join('\n');

/** The numbered answer list the model cites by position. */
export function numberedAnswers(answers: readonly Answer[]): string {
  return answers
    .map((answer, index) => `${index + 1}. ${answer.text.trim()}`)
    .join('\n');
}

/** One prompt per file, each with that file's section list. */
export interface ShapingPrompt {
  readonly file: SpecFile;
  readonly sections: readonly string[];
  readonly text: string;
}

const SECTIONS: Readonly<Record<SpecFile, readonly string[]>> = {
  proposal: ['Problem', 'Goal', 'Target Signal', 'Core Features', 'Timeline', 'Acceptance Criteria', 'Risks'],
  design: [
    'Architecture',
    'Stack',
    'Data Model',
    'Interfaces',
    'Provenance',
    'Failure Modes',
    'Open Questions',
  ],
  tasks: ['Phases', 'Definition of Done'],
};

/** Build the prompt for one file. */
export function shapingPrompt(file: SpecFile, answers: readonly Answer[]): ShapingPrompt {
  const sections = SECTIONS[file];
  const text = [
    `You are writing ${file}.md for a portfolio project spec.`,
    '',
    'Rules:',
    SHAPING_RULES,
    '',
    `Sections, in this order: ${sections.join(', ')}. Write a "## " heading for each.`,
    '',
    'The numbered answers, which are the only facts you have:',
    numberedAnswers(answers),
    '',
    `Write ${file}.md now.`,
  ].join('\n');

  return { file, sections, text };
}

/** Every prompt, for the record and for a test. */
export function allShapingPrompts(answers: readonly Answer[]): ShapingPrompt[] {
  return (['proposal', 'design', 'tasks'] as const).map((file) => shapingPrompt(file, answers));
}
