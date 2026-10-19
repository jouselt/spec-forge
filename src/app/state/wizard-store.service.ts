/**
 * Wizard state: the answers, the question list derived from them, and the
 * current position in that list.
 *
 * The list is `BASE_STEPS` plus the adaptive questions `evaluateTriggers`
 * returns for the answers so far. Adaptive questions carry fractional `step`
 * values, so a plain sort by `step` drops each follow-up directly after the
 * question that fired it. Answers whose question disappears (the user deletes
 * the word "ollama") are dropped with it, so the rail never shows a dead step.
 */

import { Injectable, computed, signal } from '@angular/core';
import { Answer, Question, TriggerTrace } from '../core/question-graph';
import { BASE_STEPS } from '../core/steps';
import { evaluateTriggers } from '../core/triggers';
import { describeTrigger } from './trigger-reason';

export type StepStatus = 'pending' | 'current' | 'answered';

export interface RailStep {
  /** Position of the question in the derived list. */
  index: number;
  question: Question;
  /** The current question wins over the answered state. */
  status: StepStatus;
  /** True as soon as the question holds a non-blank answer. */
  answered: boolean;
  /** Why the question was asked; null for base questions. */
  reason: string | null;
}

export const REQUIRED_MESSAGE = 'This question is required.';

/** Bounded fixpoint: pruning an answer can drop the trigger it fired. */
const MAX_RESOLVE_PASSES = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Sort by step, keeping the incoming order for equal steps (base before follow-ups). */
export function orderQuestions(questions: Question[]): Question[] {
  return questions
    .map((question, ordinal) => ({ question, ordinal }))
    .sort((a, b) => a.question.step - b.question.step || a.ordinal - b.ordinal)
    .map((entry) => entry.question);
}

@Injectable({ providedIn: 'root' })
export class WizardStore {
  private readonly answerList = signal<Answer[]>([]);
  private readonly questionList = signal<Question[]>(orderQuestions(BASE_STEPS));
  private readonly traceList = signal<TriggerTrace[]>([]);
  private readonly position = signal(0);
  private readonly highlight = signal<string | null>(null);
  private readonly promotedList = signal<Question[]>([]);

  readonly answers = this.answerList.asReadonly();
  readonly questions = this.questionList.asReadonly();
  readonly traces = this.traceList.asReadonly();
  readonly index = this.position.asReadonly();

  /** The answer a caller asked to see, or null when nothing is highlighted. */
  readonly highlighted = this.highlight.asReadonly();
  /** Questions promoted from a `{{MISSING: ...}}` chip, in the order they were promoted. */
  readonly promoted = this.promotedList.asReadonly();

  readonly total = computed(() => this.questionList().length);
  /** The position clamped into the list, so a shrinking list never strands the user. */
  readonly currentIndex = computed(() => {
    const last = Math.max(this.questionList().length - 1, 0);
    return clamp(this.position(), 0, last);
  });
  readonly current = computed<Question | null>(
    () => this.questionList()[this.currentIndex()] ?? null,
  );
  readonly answeredCount = computed(
    () => this.questionList().filter((question) => this.hasAnswer(question.id)).length,
  );
  readonly isFirst = computed(() => this.currentIndex() === 0);
  readonly isLast = computed(() => this.currentIndex() >= this.questionList().length - 1);
  readonly currentError = computed(() => this.errorFor(this.current()));
  readonly canAdvance = computed(() => this.currentError() === null);
  readonly rail = computed<RailStep[]>(() => {
    const currentIndex = this.currentIndex();

    return this.questionList().map((question, index) => {
      const answered = this.hasAnswer(question.id);

      return {
        index,
        question,
        answered,
        status: index === currentIndex ? 'current' : answered ? 'answered' : 'pending',
        reason: this.reasonFor(question),
      };
    });
  });

  /** The stored answer for a question, or null when it is still unanswered. */
  answerFor(questionId: string): Answer | null {
    return this.answerList().find((answer) => answer.questionId === questionId) ?? null;
  }

  textFor(questionId: string): string {
    return this.answerFor(questionId)?.text ?? '';
  }

  hasAnswer(questionId: string): boolean {
    return this.textFor(questionId).trim().length > 0;
  }

  /**
   * Write-through update from a control. Blank text removes the answer, which
   * also removes any follow-up it had triggered.
   */
  setText(questionId: string, text: string): void {
    const question = this.questionList().find((candidate) => candidate.id === questionId);
    if (!question) {
      return;
    }

    const existing = this.answerFor(questionId);
    const now = Date.now();

    if (text.trim().length === 0) {
      if (!existing) {
        return;
      }
      this.applyAnswers(this.answerList().filter((answer) => answer.questionId !== questionId));
      return;
    }

    if (existing) {
      if (existing.text === text) {
        return;
      }
      this.applyAnswers(
        this.answerList().map((answer) =>
          answer.questionId === questionId ? { ...answer, text, editedAt: now } : answer,
        ),
      );
      return;
    }

    this.applyAnswers([...this.answerList(), this.createAnswer(question, text, now)]);
  }

  /**
   * Put a stored draft back, before anything else runs.
   *
   * The answers go in first and the question list is rebuilt from them, because every
   * follow-up question is derived: restoring the step before the answers would land at an
   * index that means something else by the time it is applied. The traces are recomputed
   * from the answers rather than trusted from disk, for the same reason.
   */
  restore(answers: Answer[]): void {
    this.applyAnswers([...answers]);
    this.position.set(0);
    this.highlight.set(null);
  }

  /**
   * Append a question to the interview, and go to it.
   *
   * This is the loop closing: a model that could not answer something writes
   * `{{MISSING: <the question>}}`, a person promotes the chip, and the interview asks that
   * question on the next run. The question lands after the last step so it does not reorder
   * the interview somebody is already half way through.
   */
  promoteQuestion(prompt: string, help?: string): Question | null {
    const trimmed = prompt.trim();

    if (trimmed.length === 0) {
      return null;
    }

    const id = `promoted.${trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)}`;

    if (this.questionList().some((question) => question.id === id)) {
      const existing = this.questionList().find((question) => question.id === id) ?? null;

      if (existing) {
        this.jumpToQuestion(existing.id);
      }

      return existing;
    }

    const last = this.questionList().reduce((max, question) => Math.max(max, question.step), 0);
    const question: Question = {
      id,
      step: last + 0.5,
      prompt: trimmed,
      help: help ?? 'Promoted from a gap in an earlier run.',
      kind: 'longtext',
      required: false,
    };

    this.promotedList.update((questions) => [...questions, question]);
    this.applyAnswers(this.answerList());
    this.jumpToQuestion(id);

    return question;
  }

  /** Advance one question. Blocked while the current question fails validation. */
  next(): void {
    if (!this.canAdvance()) {
      return;
    }
    this.jumpTo(this.currentIndex() + 1);
  }

  back(): void {
    this.jumpTo(this.currentIndex() - 1);
  }

  /** Jump from the rail. Out-of-range positions are clamped, not rejected. */
  jumpTo(index: number): void {
    if (!Number.isFinite(index)) {
      return;
    }
    const last = Math.max(this.questionList().length - 1, 0);
    this.position.set(clamp(Math.trunc(index), 0, last));
  }

  jumpToQuestion(questionId: string): void {
    const index = this.questionList().findIndex((question) => question.id === questionId);
    if (index >= 0) {
      this.jumpTo(index);
    }
  }

  /**
   * Jump to the question behind an answer and mark it, so a view can show where
   * a generated sentence came from. An id that is not part of the interview
   * marks nothing, so a stale provenance id cannot move the wizard.
   */
  highlightAnswer(answerId: string): void {
    if (!this.questionList().some((question) => question.id === answerId)) {
      return;
    }

    this.highlight.set(answerId);
    this.jumpToQuestion(answerId);
  }

  /** Error message for a question, or null when the answer is acceptable. */
  errorFor(question: Question | null): string | null {
    if (!question) {
      return null;
    }

    const text = this.textFor(question.id);

    if (text.trim().length === 0) {
      return question.required ? REQUIRED_MESSAGE : null;
    }

    return question.validate ? question.validate(text) : null;
  }

  /** Structured clone of the answers, for later persistence and export stages. */
  snapshot(): Answer[] {
    return this.answerList().map((answer) => ({ ...answer }));
  }

  reset(): void {
    this.answerList.set([]);
    this.questionList.set(orderQuestions(BASE_STEPS));
    this.traceList.set([]);
    this.position.set(0);
    this.highlight.set(null);
  }

  private reasonFor(question: Question): string | null {
    if (!question.adaptive) {
      return null;
    }

    const trace = this.traceList().find((candidate) => candidate.triggerId === question.adaptive?.triggerId);

    return trace ? describeTrigger(trace, this.answerList()) : null;
  }

  private createAnswer(question: Question, text: string, now: number): Answer {
    const answer: Answer = {
      id: question.id,
      questionId: question.id,
      text,
      kind: question.kind,
      askedAt: now,
      source: question.adaptive ? 'adaptive' : 'base',
    };

    if (question.adaptive) {
      const trace = this.traceList().find((candidate) => candidate.triggerId === question.adaptive?.triggerId);
      if (trace) {
        answer.trigger = trace;
      }
    }

    return answer;
  }

  private applyAnswers(answers: Answer[]): void {
    const settled = this.resolve(answers);
    this.answerList.set(settled.answers);
    this.questionList.set(settled.questions);
    this.traceList.set(settled.traces);
    this.position.set(clamp(this.position(), 0, Math.max(settled.questions.length - 1, 0)));
  }

  private resolve(answers: Answer[]): {
    answers: Answer[];
    questions: Question[];
    traces: TriggerTrace[];
  } {
    let kept = answers;
    let questions = orderQuestions([...BASE_STEPS, ...this.promotedList()]);
    let traces: TriggerTrace[] = [];

    for (let pass = 0; pass < MAX_RESOLVE_PASSES; pass++) {
      const result = evaluateTriggers(kept);
      // Promoted questions stay in the list: they were appended by a person answering a gap
      // the model named, and dropping them would prune the answer they were made for.
      questions = orderQuestions([...BASE_STEPS, ...this.promotedList(), ...result.questions]);
      traces = result.traces;

      const known = new Set(questions.map((question) => question.id));
      const pruned = kept.filter((answer) => known.has(answer.questionId));

      if (pruned.length === kept.length) {
        break;
      }

      kept = pruned;
    }

    return { answers: kept, questions, traces };
  }
}
