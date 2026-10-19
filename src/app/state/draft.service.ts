/**
 * The draft: what is on screen, kept on disk.
 *
 * One draft, one id. This app is a single-sitting tool, not a workspace, so a draft list
 * would be a feature nobody asked for; what people actually lose is the tab they closed.
 *
 * The service is deliberately ignorant of IndexedDB: it builds a payload and hands it to
 * the autosaver, which hands it to the store. That is what lets the resume path be tested
 * against the real database while the debounce is tested with no database at all.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { Answer } from '../core/question-graph';
import { Autosaver, DraftPayload, AUTOSAVE_DELAY_MS } from '../persistence/autosave';
import { putDocs, putDraft, getDocs, getDraft, putSnapshots, putLock, getLocks } from '../persistence/spec-db';
import { DocumentStore } from './document-store.service';
import { SnapshotStore } from './snapshot-store.service';
import { WizardStore } from './wizard-store.service';

/** The id a single-sitting draft uses. */
export const CURRENT_DRAFT_ID = 'draft-1';

/** What a restore found, so the UI can say something true. */
export interface RestoreReport {
  readonly restored: boolean;
  readonly answers: number;
  readonly step: number;
  readonly documents: number;
}

@Injectable({ providedIn: 'root' })
export class DraftService {
  private readonly wizard = inject(WizardStore);
  private readonly documents = inject(DocumentStore);
  private readonly snapshots = inject(SnapshotStore);

  private readonly lastSaved = signal<number | null>(null);
  private readonly saving = signal(false);

  readonly savedAt = this.lastSaved.asReadonly();
  readonly isSaving = this.saving.asReadonly();
  readonly savedLabel = computed(() => {
    const at = this.lastSaved();

    return at === null ? 'Not saved yet' : `Saved at ${new Date(at).toLocaleTimeString()}`;
  });

  private readonly autosaver = new Autosaver(
    {
      write: (payload) => this.write(payload),
    },
    AUTOSAVE_DELAY_MS,
  );

  /** The payload as the state is right now. */
  payload(): DraftPayload {
    return {
      id: CURRENT_DRAFT_ID,
      step: this.wizard.index(),
      answers: this.wizard.answers(),
      traces: this.wizard.traces(),
      updatedAt: Date.now(),
    };
  }

  /** An answer changed: debounce. */
  saveSoon(): void {
    this.autosaver.schedule(this.payload());
  }

  /** A step changed, a document was generated, the page is going away: write now. */
  async saveNow(): Promise<void> {
    this.autosaver.schedule(this.payload());
    await this.autosaver.flush();
  }

  /** Called when the tab is hidden or unloaded. Best effort, nothing to await. */
  flushPending(): void {
    void this.autosaver.flush();
  }

  /** How many writes actually happened, for a test and for the saved line. */
  writeCount(): number {
    return this.autosaver.stats().written;
  }

  /**
   * Put the stored draft back into the stores.
   *
   * Order matters: the answers first, because the question list is derived from them and a
   * jump to a step index that does not exist yet would land somewhere else. Then the
   * documents. Then the step.
   */
  async restore(): Promise<RestoreReport> {
    const draft = await getDraft(CURRENT_DRAFT_ID);

    if (!draft || draft.answers.length === 0) {
      return { restored: false, answers: 0, step: 0, documents: 0 };
    }

    this.wizard.restore(draft.answers as Answer[]);

    const docs = await getDocs(CURRENT_DRAFT_ID);

    if (docs.length > 0) {
      this.documents.setDocs([...docs]);
    }

    const locks = await getLocks();

    for (const lock of locks) {
      this.documents.setLocked(lock.blockId, lock.locked);
    }

    this.wizard.jumpTo(draft.step);
    this.lastSaved.set(draft.updatedAt);

    return {
      restored: true,
      answers: draft.answers.length,
      step: this.wizard.index(),
      documents: docs.length,
    };
  }

  /** Is there a draft to resume? */
  async hasDraft(): Promise<boolean> {
    const draft = await getDraft(CURRENT_DRAFT_ID);

    return (draft?.answers.length ?? 0) > 0;
  }

  private async write(payload: DraftPayload): Promise<void> {
    this.saving.set(true);

    try {
      await putDraft({
        id: payload.id,
        step: payload.step,
        answers: payload.answers,
        traces: payload.traces,
        updatedAt: payload.updatedAt,
      });

      const docs = this.documents.docs();

      if (docs.length > 0) {
        await putDocs({ draftId: payload.id, docs });
      }

      const snapshots = this.snapshots.snapshots();

      if (snapshots.length > 0) {
        await putSnapshots({ draftId: payload.id, snapshots });
      }

      for (const block of docs.flatMap((doc) => doc.blocks)) {
        if (block.locked) {
          await putLock({ blockId: block.id, locked: true });
        }
      }

      this.lastSaved.set(payload.updatedAt);
    } finally {
      this.saving.set(false);
    }
  }
}
