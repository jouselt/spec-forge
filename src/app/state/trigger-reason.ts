/**
 * Pure helpers that turn a `TriggerTrace` into the sentence shown next to an
 * adaptive question.
 *
 * The template lives on the trigger (`reasonTemplate`, "Asked because you
 * mentioned {phrase} in step {step}"), so the copy stays in one place. When the
 * answer that fired the trigger was itself a follow-up, there is no base step
 * number to name, so a fixed sentence is used instead of a half-filled
 * template.
 */

import { Answer, TriggerTrace } from '../core/question-graph';
import { BASE_STEPS } from '../core/steps';
import { TRIGGERS } from '../core/triggers';

export const DEFAULT_REASON_TEMPLATE = 'Asked because you mentioned {phrase} in step {step}';

/**
 * Describe why an adaptive question was asked.
 * Deterministic: the same trace and answers always produce the same sentence.
 */
export function describeTrigger(trace: TriggerTrace, answers: Answer[]): string {
  const answer = answers.find((candidate) => candidate.id === trace.becauseAnswerId);
  const baseStep = answer ? BASE_STEPS.find((question) => question.id === answer.questionId) : undefined;

  if (!baseStep) {
    return `Asked because you mentioned ${trace.matchedPhrase} in a follow-up question`;
  }

  const trigger = TRIGGERS.find((candidate) => candidate.id === trace.triggerId);
  const template = trigger?.reasonTemplate ?? DEFAULT_REASON_TEMPLATE;

  return template
    .replace('{phrase}', trace.matchedPhrase)
    .replace('{step}', String(baseStep.step));
}
