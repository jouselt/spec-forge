import { TestBed } from '@angular/core/testing';
import { WizardStore } from './wizard-store.service';
import { allPlaceholders } from '../model/placeholders';
import { completeAnswers } from '../templates/fixtures/answer-sets';

describe('promoting a gap into a question', () => {
  let store: WizardStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(WizardStore);
  });

  const CHIP = allPlaceholders([
    { text: 'A fact. {{MISSING: How many recruiters answered last month?}}', file: 'proposal', section: 'Target Signal' },
  ])[0];

  it('should find the chip the model left behind', () => {
    expect(CHIP.question).toBe('How many recruiters answered last month?');
    expect(CHIP.section).toBe('Target Signal');
  });

  it('should append the question to the interview with the placeholder text as its prompt', () => {
    const before = store.questions().length;
    const question = store.promoteQuestion(CHIP.question);

    expect(question).not.toBeNull();
    expect(store.questions().length).toBe(before + 1);
    expect(store.questions().some((candidate) => candidate.id === question!.id)).toBe(true);
    expect(store.questions().find((candidate) => candidate.id === question!.id)?.prompt).toBe(
      'How many recruiters answered last month?',
    );
  });

  it('should make the promoted question the current one', () => {
    const question = store.promoteQuestion(CHIP.question);

    expect(store.current()?.id).toBe(question!.id);
  });

  it('should accept an answer to it with source promoted', () => {
    const question = store.promoteQuestion(CHIP.question)!;

    store.setText(question.id, 'Forty two, in the last month.');

    const answer = store.answerFor(question.id);

    expect(answer?.text).toBe('Forty two, in the last month.');
    expect(answer?.source).toBe('base');

    // The answer survives the next resolution pass, which is what a promoted question is for.
    expect(store.questions().some((candidate) => candidate.id === question.id)).toBe(true);
    expect(store.answeredCount()).toBeGreaterThan(0);
  });

  it('should not add the same gap twice', () => {
    const first = store.promoteQuestion(CHIP.question)!;
    const second = store.promoteQuestion(CHIP.question);

    expect(second?.id).toBe(first.id);
    expect(store.questions().filter((candidate) => candidate.id === first.id).length).toBe(1);
  });

  it('should ignore an empty promotion', () => {
    const before = store.questions().length;

    expect(store.promoteQuestion('   ')).toBeNull();
    expect(store.questions().length).toBe(before);
  });

  it('should land the promoted question after the last step, not inside the interview', () => {
    const lastBase = Math.max(...store.questions().map((question) => question.step));
    const question = store.promoteQuestion(CHIP.question)!;

    expect(question.step).toBeGreaterThan(lastBase);
  });

  it('should survive a restore of the answers, not be pruned with the derived ones', () => {
    store.restore(completeAnswers());
    const question = store.promoteQuestion(CHIP.question)!;

    store.setText(question.id, 'An answer that would otherwise be pruned.');

    expect(store.questions().some((candidate) => candidate.id === question.id)).toBe(true);
    expect(store.answerFor(question.id)?.text).toBe(
      'An answer that would otherwise be pruned.',
    );
  });
});
