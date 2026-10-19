/**
 * Versions of the three documents, written before anything replaces them.
 *
 * A snapshot keeps both the rendered files and the structured documents. The
 * rendered files are what a person reads and what the design asked for; the
 * structured copy is what makes a restore exact, because markdown alone cannot
 * carry provenance, review state or locks back. Storing only one of the two would
 * either lose the diff preview or lose the block ids.
 */

import { Injectable, computed, signal } from '@angular/core';
import { GeneratedDoc } from '../core/question-graph';
import { SpecFile } from '../core/mapping';
import { renderMarkdown } from '../templates/assembly';

export interface Snapshot {
  readonly id: string;
  readonly draftId: string;
  readonly version: number;
  /** The three files as markdown, which is what a person reads. */
  readonly files: Record<SpecFile, string>;
  /** The same documents as blocks, which is what a restore needs. */
  readonly docs: readonly GeneratedDoc[];
  readonly createdAt: number;
  readonly label: string;
}

export interface SnapshotDiffPreview {
  readonly id: string;
  readonly label: string;
  readonly createdAt: number;
  /** Per file, how many lines differ from what is in the store now. */
  readonly changedLines: Record<SpecFile, number>;
}

const FILES: readonly SpecFile[] = ['proposal', 'design', 'tasks'];

function emptyFiles(): Record<SpecFile, string> {
  return { proposal: '', design: '', tasks: '' };
}

function zeroCounts(): Record<SpecFile, number> {
  return { proposal: 0, design: 0, tasks: 0 };
}

@Injectable({ providedIn: 'root' })
export class SnapshotStore {
  private readonly list = signal<Snapshot[]>([]);
  private readonly draft = signal('draft-1');

  /** Every snapshot, newest first. */
  readonly snapshots = computed(() => [...this.list()].reverse());
  readonly count = computed(() => this.list().length);

  /**
   * Save the current documents. Called before every generation and before every
   * import, which is why it does not decide whether a save is worthwhile: the
   * first generation snapshots the empty state, and restoring it clears the run.
   */
  write(docs: readonly GeneratedDoc[], label: string, now = Date.now()): Snapshot {
    const files = emptyFiles();

    for (const doc of docs) {
      files[doc.file] = renderMarkdown(doc);
    }

    const snapshot: Snapshot = {
      id: `snap-${this.list().length + 1}`,
      draftId: this.draft(),
      version: this.list().length + 1,
      files,
      docs: docs.map((doc) => ({ ...doc, blocks: doc.blocks.map((block) => ({ ...block })) })),
      createdAt: now,
      label,
    };

    this.list.update((snapshots) => [...snapshots, snapshot]);

    return snapshot;
  }

  /** The documents inside one snapshot, or null for an unknown id. */
  restore(id: string): GeneratedDoc[] | null {
    const snapshot = this.list().find((candidate) => candidate.id === id);

    if (!snapshot) {
      return null;
    }

    return snapshot.docs.map((doc) => ({ ...doc, blocks: doc.blocks.map((block) => ({ ...block })) }));
  }

  /** How each snapshot differs from the documents passed in now. */
  preview(current: readonly GeneratedDoc[]): SnapshotDiffPreview[] {
    const now = emptyFiles();

    for (const doc of current) {
      now[doc.file] = renderMarkdown(doc);
    }

    return this.snapshots().map((snapshot) => {
      const changedLines = zeroCounts();

      for (const file of FILES) {
        const before = snapshot.files[file].split('\n');
        const after = now[file].split('\n');
        const longest = Math.max(before.length, after.length);
        let changed = 0;

        for (let index = 0; index < longest; index += 1) {
          if ((before[index] ?? '') !== (after[index] ?? '')) {
            changed += 1;
          }
        }

        changedLines[file] = changed;
      }

      return {
        id: snapshot.id,
        label: snapshot.label,
        createdAt: snapshot.createdAt,
        changedLines,
      };
    });
  }

  setDraftId(draftId: string): void {
    this.draft.set(draftId);
  }

  clear(): void {
    this.list.set([]);
  }
}
