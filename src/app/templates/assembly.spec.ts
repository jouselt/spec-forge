import { Answer, Block } from '../core/question-graph';
import { isSourced } from '../core/question-graph';
import { PROPOSAL_SECTIONS, sectionNamesFor, sectionsFor } from '../core/mapping';
import { hasModelOrigin, parsePlaceholder, sourceAnswerIds } from '../core/provenance';
import {
  assemble,
  assembleMarkdown,
  buildContext,
  deriveName,
  firstSentence,
  indexAnswers,
  listEntries,
  sentences,
  stripFiller,
  tableEntries,
} from './assembly';
import { completeAnswers, maximalAnswers, READABILITY_FIXTURES } from './fixtures/answer-sets';

const TAG = /^- \[ \] `\[(G|E|M)\]` /;
const EM_DASH = /[\u2014\u2013]/;
const OUTSIDE_AUDIENCE = /\b(recruiter|recruiters|hiring|hire|interviewer|interviewers|interview panel|candidate)\b/i;

/** A complete interview with the constraints answer taken out. */
function withoutConstraints(): Answer[] {
  return completeAnswers().filter((answer) => answer.questionId !== 'q.constraints');
}

function sectionBlocks(blocks: Block[], section: string): Block[] {
  return blocks.filter((block) => block.section === section);
}

describe('assembly', () => {
  describe('three documents', () => {
    it('emits proposal, design and tasks on the template path', () => {
      const docs = assemble(completeAnswers(), { now: 0 });

      expect(docs.map((doc) => doc.file)).toEqual(['proposal', 'design', 'tasks']);
      expect(docs.every((doc) => doc.path === 'template')).toBe(true);
      expect(docs.every((doc) => doc.version === 1)).toBe(true);
      expect(docs.every((doc) => doc.generatedAt === 0)).toBe(true);
    });

    it('keeps block ids unique inside a document', () => {
      for (const doc of assemble(maximalAnswers(), { now: 0 })) {
        const ids = doc.blocks.map((block) => block.id);

        expect(new Set(ids).size).withContext(doc.file).toBe(ids.length);
      }
    });

    it('starts every document with its first registered section', () => {
      for (const doc of assemble(completeAnswers(), { now: 0 })) {
        expect(doc.blocks[0].section).withContext(doc.file).toBe(sectionNamesFor(doc.file)[0]);
      }
    });
  });

  describe('determinism', () => {
    it('produces byte-identical markdown across three runs', () => {
      const answers = completeAnswers();
      const runs = [assembleMarkdown(answers, { now: 0 }), assembleMarkdown(answers, { now: 0 }), assembleMarkdown(answers, { now: 0 })];

      expect(runs[1].proposal).toBe(runs[0].proposal);
      expect(runs[2].proposal).toBe(runs[0].proposal);
      expect(runs[1].design).toBe(runs[0].design);
      expect(runs[1].tasks).toBe(runs[0].tasks);
    });

    it('produces identical blocks and markdown for a maximal answer set', () => {
      const answers = maximalAnswers();
      const first = assemble(answers, { now: 0 });
      const second = assemble(answers, { now: 0 });

      expect(second).toEqual(first);
      expect(second.map((doc) => doc.file)).toEqual(first.map((doc) => doc.file));
      expect(docMarkdown(second)).toEqual(docMarkdown(first));
    });

    it('does not depend on the order of the answers it is given', () => {
      const answers = completeAnswers();
      const reversed = [...answers].reverse();

      expect(assembleMarkdown(reversed, { now: 0 })).toEqual(assembleMarkdown(answers, { now: 0 }));
    });
  });

  describe('sourcing', () => {
    it('carries no model origin on the template path', () => {
      for (const doc of assemble(maximalAnswers(), { now: 0 })) {
        expect(hasModelOrigin(doc.blocks)).withContext(doc.file).toBe(false);

        for (const block of doc.blocks) {
          expect(block.origin.kind).withContext(block.id).not.toBe('model');
        }
      }
    });

    it('names the answer behind every block that is not a gap', () => {
      for (const doc of assemble(maximalAnswers(), { now: 0 })) {
        for (const block of doc.blocks) {
          if (block.origin.kind === 'missing') {
            continue;
          }

          expect(sourceAnswerIds(block.origin).length).withContext(block.id).toBeGreaterThan(0);
          expect(isSourced(block.origin)).withContext(block.id).toBe(true);
        }
      }
    });

    it('names the frame that rendered a block', () => {
      const doc = assemble(completeAnswers(), { now: 0 })[0];
      const goal = sectionBlocks(doc.blocks, 'Goal')[0];
      const frame = goal.origin.kind === 'template' ? goal.origin.frame : '';

      expect(frame).toBe('goal.measured');
      expect(goal.origin.kind === 'template' ? goal.origin.inputs : []).toEqual(['q.idea', 'q.goal', 'q.proof']);
    });

    it('leaves every block unreviewed and unlocked on the first run', () => {
      for (const doc of assemble(completeAnswers(), { now: 0 })) {
        expect(doc.blocks.every((block) => block.review === 'unreviewed')).toBe(true);
        expect(doc.blocks.every((block) => !block.locked)).toBe(true);
      }
    });

    it('reads the whole document for a complete interview, with no holes', () => {
      for (const doc of assemble(maximalAnswers(), { now: 0 })) {
        const gaps = doc.blocks.filter((block) => block.origin.kind === 'missing');

        expect(gaps.length).withContext(`${doc.file} has ${gaps.length} gaps`).toBe(0);
      }
    });
  });

  describe('gaps', () => {
    it('emits the placeholder for a missing constraints answer and no prose', () => {
      const doc = assemble(withoutConstraints(), { now: 0 })[0];
      const blocks = sectionBlocks(doc.blocks, 'Constraints Measured Up Front');

      expect(blocks.length).toBe(1);
      expect(blocks[0].text).toBe('{{MISSING: Which constraints can you measure before starting?}}');
      expect(blocks[0].origin.kind).toBe('missing');
      expect(isSourced(blocks[0].origin)).toBe(false);
      expect(blocks[0].review).toBe('unreviewed');
      expect(parsePlaceholder(blocks[0].text)).toBe('Which constraints can you measure before starting?');
    });

    it('puts the placeholder under the heading and nothing else in that section', () => {
      const markdown = assembleMarkdown(withoutConstraints(), { now: 0 }).proposal;
      const section = markdown.split('## Constraints Measured Up Front\n\n')[1].split('\n## ')[0];

      expect(section.trim()).toBe('{{MISSING: Which constraints can you measure before starting?}}');
    });

    it('names the question that would fill an empty section', () => {
      const doc = assemble([], { now: 0 })[0];

      expect(sectionBlocks(doc.blocks, 'Problem')[0].text).toBe('{{MISSING: What problem does it solve, and who has it?}}');
      expect(sectionBlocks(doc.blocks, 'Timeline')[0].text).toBe('{{MISSING: Biggest risk, and what you would build first instead.}}');
    });

    it('keeps a required heading even when the section has nothing behind it', () => {
      const markdown = assembleMarkdown([], { now: 0 });

      for (const section of PROPOSAL_SECTIONS.filter((candidate) => candidate.required)) {
        expect(markdown.proposal).withContext(section.name).toContain(`## ${section.name}\n`);
      }
    });

    it('renders no block at all from an empty answer set', () => {
      for (const doc of assemble([], { now: 0 })) {
        expect(doc.blocks.every((block) => block.origin.kind === 'missing')).withContext(doc.file).toBe(true);
      }
    });

    it('leaves a section out entirely when it is optional and unanswered', () => {
      const doc = assemble(READABILITY_FIXTURES[1].answers, { now: 0 })[1];

      expect(sectionNamesFor('design')).toContain('Capability handling');
      expect(sectionBlocks(doc.blocks, 'Capability handling').length).toBe(0);
    });
  });

  describe('markdown', () => {
    it('heads every section with the registry name', () => {
      const markdown = assembleMarkdown(completeAnswers(), { now: 0 });

      for (const doc of ['proposal', 'design', 'tasks'] as const) {
        for (const section of sectionsFor(doc)) {
          if (!section.required) {
            continue;
          }

          expect(markdown[doc]).withContext(`${doc}: ${section.name}`).toContain(`## ${section.name}\n`);
        }
      }
    });

    it('joins list items and keeps paragraphs apart', () => {
      const markdown = assembleMarkdown(completeAnswers(), { now: 0 }).tasks;

      expect(markdown).toContain('- [ ] `[G]` Add Angular 20 with signals to the scaffold');
      expect(markdown).not.toContain('to the scaffold and typecheck it; `npm run build` stays green.\n\n- [ ]');
    });

    it('tags every task item', () => {
      const lines = assembleMarkdown(completeAnswers(), { now: 0 }).tasks.split('\n');
      const items = lines.filter((line) => line.startsWith('- [ ]'));

      expect(items.length).toBeGreaterThan(10);

      for (const item of items) {
        expect(TAG.test(item)).withContext(item).toBe(true);
      }
    });

    it('checks off every acceptance criterion', () => {
      const markdown = assembleMarkdown(completeAnswers(), { now: 0 }).proposal;
      const section = markdown.split('## Acceptance Criteria\n\n')[1].split('\n## ')[0];
      const items = section.trim().split('\n');

      expect(items.length).toBeGreaterThan(3);

      for (const item of items) {
        expect(item.startsWith('- [ ] ')).withContext(item).toBe(true);
      }
    });

    it('ends each file with a single newline', () => {
      const markdown = assembleMarkdown(completeAnswers(), { now: 0 });

      for (const file of ['proposal', 'design', 'tasks'] as const) {
        expect(markdown[file].endsWith('\n')).withContext(file).toBe(true);
        expect(markdown[file].endsWith('\n\n')).withContext(file).toBe(false);
      }
    });
  });

  describe('generated copy', () => {
    it('writes no em dash and no outside-audience framing for any fixture', () => {
      for (const fixture of READABILITY_FIXTURES) {
        const markdown = assembleMarkdown(fixture.answers, { now: 0 });

        for (const file of ['proposal', 'design', 'tasks'] as const) {
          expect(EM_DASH.test(markdown[file])).withContext(`${fixture.id}/${file}`).toBe(false);
          expect(OUTSIDE_AUDIENCE.test(markdown[file])).withContext(`${fixture.id}/${file}`).toBe(false);
        }
      }
    });
  });

  describe('answer helpers', () => {
    it('indexes answers by question id', () => {
      const index = indexAnswers(completeAnswers());

      expect(index.get('q.idea')?.text).toContain('reading list');
      expect(index.size).toBe(12);
    });

    it('splits sentences and drops their punctuation', () => {
      expect(sentences('One. Two! Three?')).toEqual(['One', 'Two', 'Three']);
      expect(firstSentence('Only one sentence here.')).toBe('Only one sentence here');
    });

    it('strips a leading filler phrase', () => {
      expect(stripFiller('I want to build a card writer.')).toBe('build a card writer.');
      expect(stripFiller('The goal is to ship it.')).toBe('ship it.');
      expect(stripFiller('Ship it.')).toBe('Ship it.');
    });

    it('derives a short name from the idea answer', () => {
      expect(deriveName('A notes vault that encrypts every note in the browser.')).toBe('notes vault');
      expect(deriveName('I want to build a card writer for readers.')).toBe('card writer');
      expect(deriveName('')).toBe('project');
    });

    it('parses list and table answers the way the controls write them', () => {
      expect(listEntries('Angular 20\nSQLite\n\n')).toEqual([
        { text: 'Angular 20', label: 'Angular 20', value: '' },
        { text: 'SQLite', label: 'SQLite', value: '' },
      ]);
      expect(tableEntries('vault size | 10,000 notes\nkey material | never leaves the device')).toEqual([
        { text: 'vault size: 10,000 notes', label: 'vault size', value: '10,000 notes' },
        { text: 'key material: never leaves the device', label: 'key material', value: 'never leaves the device' },
      ]);
    });

    it('exposes every answer as a token and nothing else', () => {
      const context = buildContext(completeAnswers());

      expect(context.values['q.idea']).toContain('reading list');
      expect(context.values['a.ctx_window']).toBe('4096');
      expect(context.sources['proof_sentence']).toEqual(['q.proof']);
      expect(context.lists['constraint_entries'].length).toBe(4);
      expect(context.listSources['constraint_entries']).toEqual(['q.constraints']);
    });
  });
});

/** Markdown for a set of documents, in order, so two runs can be compared as text. */
function docMarkdown(docs: ReturnType<typeof assemble>): string[] {
  return docs.map((doc) => `${doc.file}\n${doc.blocks.map((block) => `${block.id} ${block.text}`).join('\n')}`);
}
