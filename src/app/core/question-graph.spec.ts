import { isSourced, isBlockExportReady, narrowOrigin, Block, Origin } from './question-graph';

describe('question-graph types and helpers', () => {
  describe('narrowOrigin', () => {
    it('should narrow Origin to answer kind', () => {
      const origin: Origin = { kind: 'answer', answerIds: ['q.idea'], frame: 'test' };
      const narrowed = narrowOrigin(origin, 'answer');
      expect(narrowed).toBeTruthy();
      expect(narrowed?.kind).toBe('answer');
    });

    it('should return null when kind does not match', () => {
      const origin: Origin = { kind: 'template', frame: 'test', inputs: [] };
      const narrowed = narrowOrigin(origin, 'answer');
      expect(narrowed).toBeNull();
    });

    it('should narrow Origin to model kind', () => {
      const origin: Origin = { kind: 'model', modelId: 'llama-3b', basedOn: ['q.idea'], temperature: 0.2 };
      const narrowed = narrowOrigin(origin, 'model');
      expect(narrowed).toBeTruthy();
      expect(narrowed?.kind).toBe('model');
    });

    it('should narrow Origin to missing kind', () => {
      const origin: Origin = { kind: 'missing', placeholder: 'What is missing?' };
      const narrowed = narrowOrigin(origin, 'missing');
      expect(narrowed).toBeTruthy();
      expect(narrowed?.placeholder).toBe('What is missing?');
    });
  });

  describe('isSourced', () => {
    it('should return true for answer origin', () => {
      const origin: Origin = { kind: 'answer', answerIds: ['q.idea'], frame: 'test' };
      expect(isSourced(origin)).toBe(true);
    });

    it('should return true for template origin', () => {
      const origin: Origin = { kind: 'template', frame: 'test', inputs: [] };
      expect(isSourced(origin)).toBe(true);
    });

    it('should return true for imported origin', () => {
      const origin: Origin = { kind: 'imported', section: 'Goal' };
      expect(isSourced(origin)).toBe(true);
    });

    it('should return true for edited origin', () => {
      const origin: Origin = { kind: 'edited', derivedFrom: { kind: 'answer', answerIds: [], frame: '' } };
      expect(isSourced(origin)).toBe(true);
    });

    it('should return false for model origin', () => {
      const origin: Origin = { kind: 'model', modelId: 'llama', basedOn: [], temperature: 0.2 };
      expect(isSourced(origin)).toBe(false);
    });

    it('should return false for missing origin', () => {
      const origin: Origin = { kind: 'missing', placeholder: 'test' };
      expect(isSourced(origin)).toBe(false);
    });
  });

  describe('isBlockExportReady', () => {
    it('should return true for sourced block', () => {
      const block: Block = {
        id: 'test-1',
        file: 'proposal',
        section: 'Goal',
        ord: 0,
        text: 'Some text',
        origin: { kind: 'answer', answerIds: ['q.goal'], frame: 'test' },
        review: 'unreviewed',
        locked: false,
      };
      expect(isBlockExportReady(block)).toBe(true);
    });

    it('should return false for inferred unreviewed block', () => {
      const block: Block = {
        id: 'test-2',
        file: 'proposal',
        section: 'Goal',
        ord: 0,
        text: 'Model text',
        origin: { kind: 'model', modelId: 'llama', basedOn: ['q.goal'], temperature: 0.2 },
        review: 'unreviewed',
        locked: false,
      };
      expect(isBlockExportReady(block)).toBe(false);
    });

    it('should return true for inferred confirmed block', () => {
      const block: Block = {
        id: 'test-3',
        file: 'proposal',
        section: 'Goal',
        ord: 0,
        text: 'Model text',
        origin: { kind: 'model', modelId: 'llama', basedOn: ['q.goal'], temperature: 0.2 },
        review: 'confirmed',
        locked: false,
      };
      expect(isBlockExportReady(block)).toBe(true);
    });
  });
});
