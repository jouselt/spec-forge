import { TestBed } from '@angular/core/testing';
import { SnapshotStore } from './snapshot-store.service';
import { DocumentStore } from './document-store.service';
import { assemble, renderMarkdown } from '../templates/assembly';
import { completeAnswers } from '../templates/fixtures/answer-sets';
import { importSpec } from '../core/import-spec';

describe('SnapshotStore', () => {
  let snapshots: SnapshotStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    snapshots = TestBed.inject(SnapshotStore);
  });

  it('should start empty', () => {
    expect(snapshots.snapshots()).toEqual([]);
    expect(snapshots.count()).toBe(0);
  });

  it('should keep the three rendered files and the structured documents', () => {
    const docs = assemble(completeAnswers());
    const snapshot = snapshots.write(docs, 'before a generate', 1000);

    expect(snapshot.version).toBe(1);
    expect(snapshot.draftId).toBe('draft-1');
    expect(snapshot.createdAt).toBe(1000);
    expect(snapshot.label).toBe('before a generate');
    expect(snapshot.files.proposal).toBe(renderMarkdown(docs[0]));
    expect(snapshot.docs.length).toBe(3);
  });

  it('should number the versions in order and list the newest first', () => {
    const docs = assemble(completeAnswers());

    snapshots.write(docs, 'first', 1000);
    snapshots.write(docs, 'second', 2000);

    expect(snapshots.snapshots().map((snapshot) => snapshot.label)).toEqual(['second', 'first']);
    expect(snapshots.snapshots().map((snapshot) => snapshot.version)).toEqual([2, 1]);
  });

  it('should restore the documents exactly, provenance and locks included', () => {
    const imported = importSpec('## Problem\n\nMine.\n');
    const docs = [imported.doc, ...assemble(completeAnswers()).slice(1)];
    const snapshot = snapshots.write(docs, 'imported');
    const restored = snapshots.restore(snapshot.id);

    expect(restored).not.toBeNull();
    expect(renderMarkdown(restored![0])).toBe(renderMarkdown(imported.doc));
    expect(restored![0].blocks[0].locked).toBe(true);
    expect(restored![0].blocks[0].origin.kind).toBe('imported');
  });

  it('should hand back a copy, not the stored one', () => {
    const docs = assemble(completeAnswers());
    const snapshot = snapshots.write(docs, 'copy me');
    const restored = snapshots.restore(snapshot.id)!;

    restored[0].blocks[0].text = 'mutated';

    expect(snapshots.restore(snapshot.id)![0].blocks[0].text).not.toBe('mutated');
  });

  it('should return null for an unknown id', () => {
    expect(snapshots.restore('snap-99')).toBeNull();
  });

  it('should preview how many lines each file differs by now', () => {
    const docs = assemble(completeAnswers());

    snapshots.write(docs, 'same as now');
    const preview = snapshots.preview(docs);

    expect(preview[0].changedLines).toEqual({ proposal: 0, design: 0, tasks: 0 });

    const changed = docs.map((doc) =>
      doc.file === 'proposal'
        ? { ...doc, blocks: doc.blocks.map((block, index) => (index === 0 ? { ...block, text: 'Different.' } : block)) }
        : doc,
    );
    const after = snapshots.preview(changed);

    expect(after[0].changedLines.proposal).toBeGreaterThan(0);
    expect(after[0].changedLines.design).toBe(0);
  });
});

describe('DocumentStore and snapshots', () => {
  let store: DocumentStore;
  let snapshots: SnapshotStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(DocumentStore);
    snapshots = TestBed.inject(SnapshotStore);
  });

  it('should write one snapshot per generation', () => {
    store.generate(completeAnswers());
    expect(snapshots.count()).toBe(1);

    store.generate(completeAnswers());
    expect(snapshots.count()).toBe(2);
  });

  it('should go back to what was there before a generation', () => {
    store.generate(completeAnswers());
    const first = renderMarkdown(store.docs()[0]);

    store.setBlockText(store.blocksFor('proposal')[0].id, 'A change worth undoing.');
    const edited = renderMarkdown(store.docs()[0]);

    expect(edited).not.toBe(first);

    store.generate(completeAnswers());

    // A snapshot holds the state before the action, so the newest one is what was
    // on screen right before this generate, edit included.
    expect(snapshots.count()).toBe(2);
    expect(store.restoreSnapshot(snapshots.snapshots()[0].id)).toBe(true);
    expect(renderMarkdown(store.docs()[0])).toBe(edited);

    // And the oldest one is the empty state, which is how a run gets cleared.
    expect(store.restoreSnapshot(snapshots.snapshots()[1].id)).toBe(true);
    expect(store.docs()).toEqual([]);
  });

  it('should keep an imported file through a generation', () => {
    const imported = importSpec('## Problem\n\nA sentence of mine.\n');

    store.importDoc(imported.doc);
    store.generate(completeAnswers());

    const problem = store.blocksFor('proposal').find((block) => block.section === 'Problem');

    expect(problem?.text).toBe('A sentence of mine.');
    expect(problem?.locked).toBe(true);
  });

  it('should keep the files in reading order after an import', () => {
    store.importDoc(importSpec('## Problem\n\nMine.\n').doc);
    store.importDoc(importSpec('## Architecture\n\nMine too.\n', 'design').doc);

    expect(store.docs().map((doc) => doc.file)).toEqual(['proposal', 'design']);
  });

  it('should refuse an unknown snapshot id', () => {
    expect(store.restoreSnapshot('snap-404')).toBe(false);
  });
});
