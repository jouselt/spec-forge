import { answerIds, sectionNamesFor, SpecFile } from '../core/mapping';
import { TemplateSection, frameTokens, renderFrame } from './frame';
import { buildContext, buildShape } from './assembly';
import { PROPOSAL_TEMPLATE } from './proposal.tpl';
import { DESIGN_TEMPLATE } from './design.tpl';
import { TASKS_TEMPLATE } from './tasks.tpl';
import { completeAnswers, maximalAnswers } from './fixtures/answer-sets';

const TEMPLATES: readonly { file: SpecFile; sections: readonly TemplateSection[] }[] = [
  { file: 'proposal', sections: PROPOSAL_TEMPLATE },
  { file: 'design', sections: DESIGN_TEMPLATE },
  { file: 'tasks', sections: TASKS_TEMPLATE },
];

/** Words that would put an outside reader in the output. The spec is for a project. */
const OUTSIDE_AUDIENCE = /\b(recruiter|recruiters|hiring|hire|interviewer|interviewers|interview panel|candidate)\b/i;

const EM_DASH = /[\u2014\u2013]/;

function everyFrame(): { section: string; frame: TemplateSection['frames'][number] }[] {
  const frames: { section: string; frame: TemplateSection['frames'][number] }[] = [];

  for (const template of TEMPLATES) {
    for (const section of template.sections) {
      for (const frame of section.frames) {
        frames.push({ section: section.section, frame });
      }
    }
  }

  return frames;
}

describe('section templates', () => {
  describe('coverage', () => {
    it('has a template for every registered section, in registry order', () => {
      for (const template of TEMPLATES) {
        expect(template.sections.map((section) => section.section))
          .withContext(template.file)
          .toEqual(sectionNamesFor(template.file));
      }
    });

    it('names every gap question with a real answer id', () => {
      const ids = answerIds();

      for (const template of TEMPLATES) {
        for (const section of template.sections) {
          expect(ids).withContext(`${section.section} names ${section.gapQuestion}`).toContain(section.gapQuestion);
        }
      }
    });

    it('gives every section two to four frames', () => {
      for (const { section, frame } of everyFrame()) {
        expect(frame).withContext(section).toBeDefined();
      }

      for (const template of TEMPLATES) {
        for (const section of template.sections) {
          expect(section.frames.length).withContext(`${section.section} frames`).toBeGreaterThanOrEqual(2);
          expect(section.frames.length).withContext(`${section.section} frames`).toBeLessThanOrEqual(4);
        }
      }
    });

    it('gives every frame a unique id', () => {
      const ids = everyFrame().map(({ frame }) => frame.id);

      expect(new Set(ids).size).toBe(ids.length);
    });

    it('builds every tasks section out of checkbox items', () => {
      for (const section of TASKS_TEMPLATE) {
        expect(section.frames.every((frame) => frame.kind === 'check')).withContext(section.section).toBe(true);
      }
    });
  });

  describe('placeholders', () => {
    it('resolves every token against a complete answer set', () => {
      const context = buildContext(maximalAnswers());

      for (const { section, frame } of everyFrame()) {
        for (const token of frameTokens(frame.text)) {
          const perEntry = token === 'item' || token === 'item_label' || token === 'item_value';

          if (perEntry) {
            expect(frame.each).withContext(`${section} / ${frame.id} uses {${token}} without an each list`).toBeDefined();
            continue;
          }

          expect(Object.prototype.hasOwnProperty.call(context.values, token))
            .withContext(`${section} / ${frame.id} uses {${token}}`)
            .toBe(true);
        }

        if (frame.each) {
          expect(context.lists[frame.each]).withContext(`${section} / ${frame.id} repeats over ${frame.each}`).toBeDefined();
        }
      }
    });

    it('leaves no token unfilled when a frame renders', () => {
      const context = buildContext(maximalAnswers());

      for (const { section, frame } of everyFrame()) {
        for (const text of renderFrame(frame, context)) {
          expect(text).withContext(`${section} / ${frame.id}`).not.toContain('{');
          expect(text).withContext(`${section} / ${frame.id}`).not.toContain('undefined');
          expect(text).withContext(`${section} / ${frame.id}`).not.toContain('NaN');
        }
      }
    });

    it('names at least one answer in every frame, so every block has provenance', () => {
      for (const { frame } of everyFrame()) {
        expect(frameTokens(frame.text).length).withContext(frame.id).toBeGreaterThan(0);
      }
    });

    it('fires a frame only when its answers are present', () => {
      const empty = buildShape([]);

      for (const { frame } of everyFrame()) {
        expect(frame.when(empty)).withContext(`${frame.id} fired on an empty answer set`).toBe(false);
      }
    });

    it('fires the measured goal frame on a complete interview', () => {
      const shape = buildShape(completeAnswers());
      const goal = PROPOSAL_TEMPLATE.find((section) => section.section === 'Goal');
      const measured = goal?.frames.find((frame) => frame.id === 'goal.measured');

      expect(measured?.when(shape)).toBe(true);
    });
  });

  describe('generated copy', () => {
    it('writes no em dash', () => {
      for (const { frame } of everyFrame()) {
        expect(EM_DASH.test(frame.text)).withContext(frame.id).toBe(false);
      }
    });

    it('writes nothing for a reader outside the work', () => {
      for (const { frame } of everyFrame()) {
        expect(OUTSIDE_AUDIENCE.test(frame.text)).withContext(frame.id).toBe(false);
      }
    });

    it('keeps the section names free of outside-audience framing', () => {
      for (const template of TEMPLATES) {
        for (const section of template.sections) {
          expect(OUTSIDE_AUDIENCE.test(section.section)).withContext(section.section).toBe(false);
        }
      }
    });
  });
});
