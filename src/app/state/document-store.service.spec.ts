import { TestBed } from '@angular/core/testing';
import { DocumentStore } from './document-store.service';
import { SnapshotStore } from './snapshot-store.service';
import { Answer, Block, OriginKind, narrowOrigin } from '../core/question-graph';
import { hasModelOrigin, isPlaceholder, sourceAnswerIds } from '../core/provenance';
import { completeAnswers } from '../templates/fixtures/answer-sets';
import { block, doc } from '../ui/fixtures/blocks';

const NO_BLOCKS: Record<OriginKind, number> = {
  answer: 0,
  template: 0,
  model: 0,
  imported: 0,
  edited: 0,
  missing: 0,
};

describe('DocumentStore', () => {
  let store: DocumentStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(DocumentStore);
  });

  beforeEach(() => {
    TestBed.inject(SnapshotStore).clear();
  });

  function allBlocks(): Block[] {
    return store.docs().flatMap((doc) => doc.blocks);
  }

  function blockById(id: string): Block {
    const found = allBlocks().find((block) => block.id === id);

    if (!found) {
      throw new Error(`No block with id ${id}`);
    }

    return found;
  }

  function firstBlock(file: Block['file'], index = 0): Block {
    const block = store.blocksFor(file)[index];

    if (!block) {
      throw new Error(`No block at ${file}[${index}]`);
    }

    return block;
  }

  describe('before a generate', () => {
    it('should hold no documents', () => {
      expect(store.docs()).toEqual([]);
      expect(store.totalBlocks()).toBe(0);
      expect(store.blocksFor('proposal')).toEqual([]);
      expect(store.countsFor('proposal')).toEqual(NO_BLOCKS);
    });
  });

  describe('generate', () => {
    it('should assemble the three files from the answers', () => {
      store.generate(completeAnswers());

      expect(store.docs().map((doc) => doc.file)).toEqual(['proposal', 'design', 'tasks']);
      expect(store.docs().every((doc) => doc.path === 'template')).toBe(true);
      expect(store.totalBlocks()).toBeGreaterThan(0);
      expect(store.totalBlocks()).toBe(store.docs().reduce((total, doc) => total + doc.blocks.length, 0));
    });

    it('should count every block of a file by origin kind', () => {
      store.generate(completeAnswers());

      const counts = store.countsFor('proposal');
      const blocks = store.blocksFor('proposal');
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

      expect(total).toBe(blocks.length);
      expect(counts.template).toBeGreaterThan(0);
      expect(counts.model).toBe(0);
      expect(counts.edited).toBe(0);
    });

    it('should infer nothing on the template path', () => {
      store.generate(completeAnswers());

      expect(hasModelOrigin(allBlocks())).toBe(false);
    });

    it('should replace the previous documents rather than append to them', () => {
      store.generate(completeAnswers());
      const first = store.docs();

      store.generate([]);

      expect(store.docs()).not.toBe(first);
      expect(store.docs().length).toBe(3);
      // With no answers every required section is a gap, so nothing is templated.
      expect(store.countsFor('proposal').template).toBe(0);
      expect(store.countsFor('proposal').missing).toBe(store.blocksFor('proposal').length);
      expect(store.countsFor('proposal').missing).toBeGreaterThan(0);
    });
  });

  describe('setBlockText', () => {
    beforeEach(() => {
      store.generate(completeAnswers());
    });

    it('should replace the text, flip the block to edited and keep the previous origin', () => {
      const target = firstBlock('proposal');
      const previous = target.origin;

      store.setBlockText(target.id, 'Rewritten by hand.');

      const updated = blockById(target.id);
      const edited = narrowOrigin(updated.origin, 'edited');

      expect(updated.text).toBe('Rewritten by hand.');
      expect(updated.review).toBe('edited');
      expect(edited).not.toBeNull();
      expect(edited?.derivedFrom).toEqual(previous);
      // The chain still resolves, so a panel can name the answers behind the edit.
      expect(sourceAnswerIds(updated.origin)).toEqual(sourceAnswerIds(previous));
      expect(sourceAnswerIds(updated.origin).length).toBeGreaterThan(0);
    });

    it('should leave every other block untouched', () => {
      const blocks = store.blocksFor('proposal');
      const target = blocks[0];
      const others = blocks.slice(1);
      const design = store.blocksFor('design');

      store.setBlockText(target.id, 'Rewritten by hand.');

      expect(store.blocksFor('proposal').slice(1)).toEqual(others);
      expect(store.blocksFor('design')).toEqual(design);
      expect(store.totalBlocks()).toBe(store.docs().reduce((total, doc) => total + doc.blocks.length, 0));
    });

    it('should keep the question behind an edited gap', () => {
      store.generate([]);
      const gap = firstBlock('design');
      const placeholder = narrowOrigin(gap.origin, 'missing')?.placeholder;

      store.setBlockText(gap.id, 'Filled in by hand.');

      const edited = narrowOrigin(blockById(gap.id).origin, 'edited');

      expect(placeholder).toBeTruthy();
      expect(narrowOrigin(edited?.derivedFrom ?? gap.origin, 'missing')?.placeholder).toBe(placeholder);
      expect(blockById(gap.id).review).toBe('edited');
    });

    it('should ignore an unknown block id', () => {
      const before = store.docs();

      store.setBlockText('proposal:goal:p99', 'Nope.');

      expect(store.docs()).toEqual(before);
    });

    it('should keep the block id, the file, the section and the lock', () => {
      const target = firstBlock('tasks');

      store.setBlockText(target.id, 'Rewritten by hand.');

      const updated = blockById(target.id);

      expect(updated.id).toBe(target.id);
      expect(updated.file).toBe(target.file);
      expect(updated.section).toBe(target.section);
      expect(updated.ord).toBe(target.ord);
      expect(updated.locked).toBe(target.locked);
    });
  });

  describe('review transitions', () => {
    let id: string;

    beforeEach(() => {
      store.generate(completeAnswers());
      id = firstBlock('tasks').id;
    });

    it('should confirm a block', () => {
      store.confirm(id);

      expect(blockById(id).review).toBe('confirmed');
    });

    it('should reject a block', () => {
      store.reject(id);

      expect(blockById(id).review).toBe('rejected');
    });

    it('should mark a block edited', () => {
      store.edit(id);

      expect(blockById(id).review).toBe('edited');
    });

    it('should leave the text and the origin alone', () => {
      const before = blockById(id);

      store.confirm(id);

      const after = blockById(id);

      expect(after.text).toBe(before.text);
      expect(after.origin).toEqual(before.origin);
    });

    it('should be idempotent when the same transition runs twice', () => {
      store.confirm(id);
      const confirmed = blockById(id);

      store.confirm(id);

      expect(blockById(id)).toEqual(confirmed);
      expect(blockById(id).review).toBe('confirmed');
    });

    it('should let a later transition win without throwing', () => {
      store.confirm(id);

      expect(() => store.reject(id)).not.toThrow();
      expect(blockById(id).review).toBe('rejected');

      store.edit(id);
      store.edit(id);

      expect(blockById(id).review).toBe('edited');
    });

    it('should ignore an unknown block id', () => {
      const before = store.docs();

      expect(() => {
        store.confirm('nope');
        store.reject('nope');
        store.edit('nope');
      }).not.toThrow();
      expect(store.docs()).toEqual(before);
    });
  });

  describe('reject on an inferred block', () => {
    const inferred = block('proposal', 'Goal', 0, 'model', 'Model wrote this sentence.');

    beforeEach(() => {
      store.setDocs([doc('proposal', [inferred]), doc('design', []), doc('tasks', [])]);
    });

    it('should replace the prose with a placeholder and keep the heading', () => {
      store.reject(inferred.id);

      const after = store.blocksFor('proposal')[0];

      expect(after.id).toBe(inferred.id);
      expect(after.review).toBe('rejected');
      expect(isPlaceholder(after.text)).toBe(true);
      expect(narrowOrigin(after.origin, 'missing')).not.toBeNull();
      expect(after.section).toBe('Goal');
    });

    it('should leave nothing of the inference behind', () => {
      const question = narrowOrigin(inferred.origin, 'model')?.basedOn ?? [];

      store.reject(inferred.id);

      const after = store.blocksFor('proposal')[0];

      expect(after.text).not.toContain('Model wrote this sentence.');
      expect(sourceAnswerIds(after.origin)).toEqual([]);
      expect(question.length).toBeGreaterThan(0);
      expect(store.countsFor('proposal').model).toBe(0);
      expect(store.countsFor('proposal').missing).toBe(1);
    });
  });
});
