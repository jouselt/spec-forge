import { Block, Origin } from './question-graph';
import {
  blockId,
  countByOriginKind,
  gapBlocks,
  hasModelOrigin,
  isPlaceholder,
  missingBlock,
  missingOrigin,
  parsePlaceholder,
  placeholderFor,
  sectionSlug,
  sourceAnswerIds,
  tagBlock,
  templateBlock,
} from './provenance';

function block(origin: Origin, ord = 0): Block {
  return tagBlock({
    file: 'proposal',
    section: 'Goal',
    ord,
    text: 'text',
    origin,
  });
}

describe('provenance block tagging', () => {
  describe('ids', () => {
    it('slugs a section heading', () => {
      expect(sectionSlug('Constraints Measured Up Front')).toBe('constraints-measured-up-front');
      expect(sectionSlug('Acceptance criteria (design-verifiable)')).toBe('acceptance-criteria-design-verifiable');
    });

    it('builds the file:section:position id', () => {
      expect(blockId('proposal', 'Goal', 0)).toBe('proposal:goal:p0');
      expect(blockId('tasks', 'Phase 1: Contracts and scaffold', 12)).toBe('tasks:phase-1-contracts-and-scaffold:p12');
    });
  });

  describe('origins', () => {
    it('tags a template origin with its frame and inputs', () => {
      expect(templateBlock({ file: 'proposal', section: 'Goal', ord: 1, frame: 'goal.measured', inputs: ['q.idea', 'q.goal'], text: 'Goal text' }).origin).toEqual({
        kind: 'template',
        frame: 'goal.measured',
        inputs: ['q.idea', 'q.goal'],
      });
    });

    it('tags a missing origin with the question, not with text', () => {
      const gap = missingBlock({ file: 'proposal', section: 'Constraints Measured Up Front', ord: 0, question: 'Which constraints can you measure before starting?' });

      expect(gap.origin).toEqual({ kind: 'missing', placeholder: 'Which constraints can you measure before starting?' });
      expect(gap.text).toBe('{{MISSING: Which constraints can you measure before starting?}}');
      expect(gap.id).toBe('proposal:constraints-measured-up-front:p0');
    });
  });

  describe('tagBlock', () => {
    it('defaults the review state to unreviewed and the lock to false', () => {
      const tagged = block({ kind: 'template', frame: 'goal.measured', inputs: ['q.goal'] });

      expect(tagged.review).toBe('unreviewed');
      expect(tagged.locked).toBe(false);
    });

    it('keeps an explicit review state and lock', () => {
      const tagged = tagBlock({
        file: 'proposal',
        section: 'Goal',
        ord: 0,
        text: 'text',
        origin: { kind: 'imported', section: 'Goal' },
        review: 'confirmed',
        locked: true,
      });

      expect(tagged.review).toBe('confirmed');
      expect(tagged.locked).toBe(true);
    });
  });

  describe('placeholders', () => {
    it('wraps a question in the placeholder form', () => {
      expect(placeholderFor('What is the goal?')).toBe('{{MISSING: What is the goal?}}');
    });

    it('reads the question back out', () => {
      const text = placeholderFor('What proves it worked?');

      expect(parsePlaceholder(text)).toBe('What proves it worked?');
      expect(isPlaceholder(text)).toBe(true);
    });

    it('returns null for prose that is not a placeholder', () => {
      expect(parsePlaceholder('Build the thing.')).toBeNull();
      expect(parsePlaceholder('{{MISSING: unterminated')).toBeNull();
      expect(isPlaceholder('Some {{MISSING: inline}} text')).toBe(false);
    });
  });

  describe('sourceAnswerIds', () => {
    it('names the answers behind an answer origin', () => {
      expect(sourceAnswerIds({ kind: 'answer', answerIds: ['q.goal'], frame: 'goal.measured' })).toEqual(['q.goal']);
    });

    it('names the inputs behind a template origin', () => {
      expect(sourceAnswerIds({ kind: 'template', frame: 'goal.measured', inputs: ['q.idea', 'q.goal'] })).toEqual(['q.idea', 'q.goal']);
    });

    it('names the answers a model rewrote', () => {
      expect(sourceAnswerIds({ kind: 'model', modelId: 'llama', basedOn: ['q.proof'], temperature: 0.2 })).toEqual(['q.proof']);
    });

    it('walks back through an edit', () => {
      expect(sourceAnswerIds({ kind: 'edited', derivedFrom: { kind: 'template', frame: 'goal.measured', inputs: ['q.idea'] } })).toEqual(['q.idea']);
      expect(sourceAnswerIds({ kind: 'edited' })).toEqual([]);
    });

    it('names no answer for a gap or an import', () => {
      expect(sourceAnswerIds(missingOrigin('What is the goal?'))).toEqual([]);
      expect(sourceAnswerIds({ kind: 'imported', section: 'Goal' })).toEqual([]);
    });
  });

  describe('inspection', () => {
    const blocks: Block[] = [
      block({ kind: 'template', frame: 'a', inputs: ['q.idea'] }, 0),
      block({ kind: 'template', frame: 'b', inputs: ['q.goal'] }, 1),
      block({ kind: 'model', modelId: 'llama', basedOn: ['q.proof'], temperature: 0.2 }, 2),
      block({ kind: 'imported', section: 'Goal' }, 3),
      block(missingOrigin('What proves it worked?'), 4),
    ];

    it('counts every origin kind and sums to the block total', () => {
      const counts = countByOriginKind(blocks);
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

      expect(counts.template).toBe(2);
      expect(counts.model).toBe(1);
      expect(counts.imported).toBe(1);
      expect(counts.missing).toBe(1);
      expect(counts.answer).toBe(0);
      expect(counts.edited).toBe(0);
      expect(total).toBe(blocks.length);
    });

    it('reports the presence of an inferred block', () => {
      expect(hasModelOrigin(blocks)).toBe(true);
      expect(hasModelOrigin(blocks.filter((candidate) => candidate.origin.kind !== 'model'))).toBe(false);
    });

    it('collects the gap blocks the export gate looks for', () => {
      const gaps = gapBlocks(blocks);

      expect(gaps.length).toBe(1);
      expect(gaps[0].origin.kind).toBe('missing');
    });
  });
});
