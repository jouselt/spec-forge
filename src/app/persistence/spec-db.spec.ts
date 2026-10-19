import { TestBed } from '@angular/core/testing';
import {
  DB_NAME,
  DB_VERSION,
  clearAll,
  getDocs,
  getDraft,
  getLocks,
  getSnapshots,
  putDocs,
  putDraft,
  putLock,
  putSnapshots,
  resetSpecDbHandle,
  specDb,
} from './spec-db';
import { DraftRecord } from './spec-db';
import { completeAnswers } from '../templates/fixtures/answer-sets';
import { assemble, renderMarkdown } from '../templates/assembly';
import { DraftService } from '../state/draft.service';
import { WizardStore } from '../state/wizard-store.service';
import { DocumentStore } from '../state/document-store.service';
import { SnapshotStore } from '../state/snapshot-store.service';

function draft(step: number, answers = completeAnswers()): DraftRecord {
  return {
    id: 'draft-1',
    step,
    answers,
    traces: [],
    updatedAt: 1234,
  };
}

describe('spec-db', () => {
  beforeEach(async () => {
    resetSpecDbHandle();
    await clearAll();
  });

  afterEach(async () => {
    await clearAll();
  });

  it('should open the database with the five stores at version 1', async () => {
    const db = await specDb();

    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual([
      'answers',
      'docs',
      'drafts',
      'locks',
      'snapshots',
    ]);
  });

  it('should write and read a draft back', async () => {
    await putDraft(draft(3));

    const stored = await getDraft('draft-1');

    expect(stored?.step).toBe(3);
    expect(stored?.answers.length).toBe(completeAnswers().length);
  });

  it('should return nothing for a draft that was never written', async () => {
    expect(await getDraft('nope')).toBeUndefined();
  });

  it('should write and read the documents', async () => {
    const docs = assemble(completeAnswers());

    await putDocs({ draftId: 'draft-1', docs });

    const stored = await getDocs('draft-1');

    expect(stored.length).toBe(3);
    expect(renderMarkdown(stored[0])).toBe(renderMarkdown(docs[0]));
  });

  it('should keep the snapshots with their documents', async () => {
    const docs = assemble(completeAnswers());

    await putSnapshots({
      draftId: 'draft-1',
      snapshots: [
        {
          id: 'snap-1',
          draftId: 'draft-1',
          version: 1,
          files: {
            proposal: renderMarkdown(docs[0]),
            design: renderMarkdown(docs[1]),
            tasks: renderMarkdown(docs[2]),
          },
          docs,
          createdAt: 1000,
          label: 'before a generate',
        },
      ],
    });

    const stored = await getSnapshots('draft-1');

    expect(stored.length).toBe(1);
    expect(stored[0].label).toBe('before a generate');
  });

  it('should keep the locks', async () => {
    await putLock({ blockId: 'proposal:problem:p0', locked: true });

    expect(await getLocks()).toEqual([{ blockId: 'proposal:problem:p0', locked: true }]);
  });

  it('should clear everything on request', async () => {
    await putDraft(draft(1));
    await putLock({ blockId: 'x', locked: true });
    await clearAll();

    expect(await getDraft('draft-1')).toBeUndefined();
    expect(await getLocks()).toEqual([]);
  });
});

describe('DraftService', () => {
  let service: DraftService;
  let wizard: WizardStore;
  let documents: DocumentStore;

  beforeEach(async () => {
    resetSpecDbHandle();
    await clearAll();
    TestBed.configureTestingModule({});

    service = TestBed.inject(DraftService);
    wizard = TestBed.inject(WizardStore);
    documents = TestBed.inject(DocumentStore);
    TestBed.inject(SnapshotStore).clear();
  });

  afterEach(async () => {
    await clearAll();
  });

  it('should say there is no draft to resume on a fresh install', async () => {
    expect(await service.hasDraft()).toBe(false);
    expect((await service.restore()).restored).toBe(false);
  });

  it('should save the answers and the step', async () => {
    wizard.restore(completeAnswers());
    wizard.jumpTo(7);

    await service.saveNow();

    const stored = await getDraft('draft-1');

    expect(stored?.step).toBe(wizard.index());
    expect(stored?.answers.length).toBe(12);
  });

  it('should save the documents and the locks it was given', async () => {
    wizard.restore(completeAnswers());
    documents.generate(completeAnswers());
    documents.setLocked(documents.blocksFor('proposal')[0].id, true);

    await service.saveNow();

    expect((await getDocs('draft-1')).length).toBe(3);
    expect((await getLocks()).length).toBe(1);
  });

  it('should resume at step 7 with all twelve answers', async () => {
    // Seeded straight into the database, which is what a reload would find.
    await putDraft(draft(7));

    const report = await service.restore();

    expect(report.restored).toBe(true);
    expect(report.answers).toBe(12);
    expect(wizard.answeredCount()).toBe(12);
    expect(wizard.index()).toBe(7);
    expect(wizard.current()).not.toBeNull();
  });

  it('should bring the documents back with their provenance', async () => {
    const docs = assemble(completeAnswers());

    await putDraft(draft(0));
    await putDocs({ draftId: 'draft-1', docs });

    const report = await service.restore();

    expect(report.documents).toBe(3);
    expect(renderMarkdown(documents.docs()[0])).toBe(renderMarkdown(docs[0]));
    expect(documents.docs()[0].blocks[0].origin.kind).toBe(docs[0].blocks[0].origin.kind);
  });

  it('should bring a lock back onto the block it belonged to', async () => {
    const docs = assemble(completeAnswers());
    const blockId = docs[0].blocks[0].id;

    await putDraft(draft(0));
    await putDocs({ draftId: 'draft-1', docs });
    await putLock({ blockId, locked: true });

    await service.restore();

    expect(documents.blocksFor('proposal')[0].locked).toBe(true);
  });

  it('should keep twelve answers on screen after a full round trip', async () => {
    wizard.restore(completeAnswers());
    wizard.jumpTo(5);
    const before = wizard.answers().map((answer) => `${answer.questionId}=${answer.text}`);

    await service.saveNow();
    wizard.restore([]);

    expect(wizard.answeredCount()).toBe(0);

    await service.restore();

    expect(wizard.answers().map((answer) => `${answer.questionId}=${answer.text}`)).toEqual(before);
    expect(wizard.index()).toBe(5);
  });
});
