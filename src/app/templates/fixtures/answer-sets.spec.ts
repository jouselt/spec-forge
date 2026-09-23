import { BASE_STEPS } from '../../core/steps';
import { answerIds, questionById } from '../../core/mapping';
import { assemble, assembleMarkdown } from '../assembly';
import { ADAPTIVE_VALUES, READABILITY_FIXTURES, completeAnswers, maximalAnswers } from './answer-sets';

const EM_DASH = /[\u2014\u2013]/;
const OUTSIDE_AUDIENCE = /\b(recruiter|recruiters|hiring|hire|interviewer|interviewers|interview panel|candidate)\b/i;

const SHARED_SECTIONS = ['Problem', 'Goal', 'Target Signal', 'Tech Stack', 'Acceptance Criteria', 'Timeline'];

describe('answer set fixtures', () => {
  describe('shape', () => {
    it('has five readability sets with unique ids', () => {
      const ids = READABILITY_FIXTURES.map((fixture) => fixture.id);

      expect(ids.length).toBe(5);
      expect(new Set(ids).size).toBe(5);
      expect(READABILITY_FIXTURES.every((fixture) => fixture.basedOn.length > 0)).toBe(true);
    });

    it('answers all nine base steps in every readability set', () => {
      for (const fixture of READABILITY_FIXTURES) {
        const answered = new Set(fixture.answers.map((answer) => answer.questionId));

        for (const step of BASE_STEPS) {
          expect(answered.has(step.id)).withContext(`${fixture.id} is missing ${step.id}`).toBe(true);
        }
      }
    });

    it('uses real answer ids only', () => {
      const ids = answerIds();

      for (const fixture of READABILITY_FIXTURES) {
        for (const entry of fixture.answers) {
          expect(ids).withContext(`${fixture.id}: ${entry.questionId}`).toContain(entry.questionId);
        }
      }
    });

    it('takes each answer kind and source from the question graph', () => {
      for (const entry of completeAnswers()) {
        const question = questionById(entry.questionId);

        expect(entry.kind).withContext(entry.questionId).toBe(question?.kind ?? 'text');
        expect(entry.source).withContext(entry.questionId).toBe(question?.adaptive ? 'adaptive' : 'base');
        expect(entry.id).toBe(entry.questionId);
      }
    });

    it('answers the adaptive follow-ups with the adaptive source', () => {
      const adaptive = READABILITY_FIXTURES.flatMap((fixture) => fixture.answers).filter((entry) => entry.questionId.startsWith('a.'));

      expect(adaptive.length).toBeGreaterThan(0);

      for (const entry of adaptive) {
        expect(entry.source).withContext(entry.questionId).toBe('adaptive');
        expect(entry.trigger).toBeUndefined();
      }
    });

    it('covers every adaptive question in the maximal set', () => {
      const maximal = maximalAnswers();
      const adaptive = maximal.filter((entry) => entry.questionId.startsWith('a.'));

      expect(adaptive.length).toBe(Object.keys(ADAPTIVE_VALUES).length);
      expect(adaptive.every((entry) => entry.text.trim().length > 0)).toBe(true);
    });

    it('answers every question once in the maximal set', () => {
      const ids = maximalAnswers().map((entry) => entry.questionId);

      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(BASE_STEPS.length + Object.keys(ADAPTIVE_VALUES).length);
    });

    it('keeps the fixtures clean of em dashes and outside-audience wording', () => {
      // These sets are the input a person reads the generated proposals from, and
      // the generated text may quote them, so they are help to the same rule as the
      // templates: a spec for a project, never a document aimed at a reader outside
      // the work.
      for (const fixture of READABILITY_FIXTURES) {
        for (const entry of fixture.answers) {
          expect(EM_DASH.test(entry.text)).withContext(`${fixture.id}/${entry.questionId}`).toBe(false);
          expect(OUTSIDE_AUDIENCE.test(entry.text)).withContext(`${fixture.id}/${entry.questionId}`).toBe(false);
        }
      }
    });
  });

  describe('assembly over the fixtures', () => {
    it('fills every section of every fixture with no gap in the proposal', () => {
      for (const fixture of READABILITY_FIXTURES) {
        const proposal = assemble(fixture.answers, { now: 0 })[0];
        const gaps = proposal.blocks.filter((block) => block.origin.kind === 'missing');

        expect(gaps.length).withContext(`${fixture.id} has ${gaps.length} gaps`).toBe(0);
      }
    });

    it('heads the proposal with the six shared sections', () => {
      for (const fixture of READABILITY_FIXTURES) {
        const markdown = assembleMarkdown(fixture.answers, { now: 0 }).proposal;

        for (const section of SHARED_SECTIONS) {
          expect(markdown).withContext(`${fixture.id}: ${section}`).toContain(`## ${section}\n`);
        }

        expect(markdown).not.toContain('Target Recruiter Signal');
      }
    });

    it('gives the readability eval three files per fixture', () => {
      for (const fixture of READABILITY_FIXTURES) {
        const docs = assemble(fixture.answers, { now: 0 });

        expect(docs.map((doc) => doc.file)).toEqual(['proposal', 'design', 'tasks']);
        expect(docs.every((doc) => doc.path === 'template')).toBe(true);
        expect(docs.every((doc) => doc.blocks.length > 10)).toBe(true);
      }
    });
  });
});
