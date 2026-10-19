/**
 * The one place this app talks to a database.
 *
 * Five stores, one version, no migrations yet. IndexedDB and not localStorage because the
 * documents hold block arrays with provenance, and a JSON string of a whole draft is the
 * kind of thing that grows past a quota without anyone noticing.
 *
 * `idb` is wrapped here and nowhere else: `core/` is not allowed to import it (the
 * layering scan enforces that) so that the evals can compile and run those modules under
 * node. Everything above this file sees plain async functions and plain data.
 */

import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { Answer, GeneratedDoc, TriggerTrace } from '../core/question-graph';

/** The database name a reader would find in DevTools. */
export const DB_NAME = 'spec-forge';

/** Bumped only when a store changes shape, with a migration next to it when it is. */
export const DB_VERSION = 1;

/** A draft as stored: where the person was, and what they had said. */
export interface DraftRecord {
  readonly id: string;
  /** The step index they were on, so a resume opens where they left. */
  readonly step: number;
  readonly answers: readonly Answer[];
  readonly traces: readonly TriggerTrace[];
  readonly updatedAt: number;
}

/** The three documents of a draft. */
export interface DocsRecord {
  readonly draftId: string;
  readonly docs: readonly GeneratedDoc[];
}

/** A snapshot as stored. Structurally what `SnapshotStore` hands over, without the import. */
export interface StoredSnapshot {
  readonly id: string;
  readonly draftId: string;
  readonly version: number;
  readonly files: { proposal: string; design: string; tasks: string };
  readonly docs: readonly GeneratedDoc[];
  readonly createdAt: number;
  readonly label: string;
}

export interface SnapshotsRecord {
  readonly draftId: string;
  readonly snapshots: readonly StoredSnapshot[];
}

/** A block a person pinned. Kept separately from the documents so a lock survives a restore. */
export interface LockRecord {
  readonly blockId: string;
  readonly locked: boolean;
}

export interface SpecForgeDb extends DBSchema {
  drafts: { key: string; value: DraftRecord };
  answers: { key: string; value: DraftRecord };
  docs: { key: string; value: DocsRecord };
  snapshots: { key: string; value: SnapshotsRecord };
  locks: { key: string; value: LockRecord };
}

/** Open, creating the five stores on a first run. */
export function openSpecDb(): Promise<IDBPDatabase<SpecForgeDb>> {
  return openDB<SpecForgeDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('answers')) {
        db.createObjectStore('answers', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('docs')) {
        db.createObjectStore('docs', { keyPath: 'draftId' });
      }

      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'draftId' });
      }

      if (!db.objectStoreNames.contains('locks')) {
        db.createObjectStore('locks', { keyPath: 'blockId' });
      }
    },
  });
}

let handle: Promise<IDBPDatabase<SpecForgeDb>> | null = null;

/** One connection per page, opened on first use. */
export function specDb(): Promise<IDBPDatabase<SpecForgeDb>> {
  handle ??= openSpecDb();

  return handle;
}

/** Forget the connection. Used by tests so each one starts on a fresh open. */
export function resetSpecDbHandle(): void {
  handle = null;
}

export async function putDraft(draft: DraftRecord): Promise<void> {
  const db = await specDb();

  await db.put('drafts', draft);
  await db.put('answers', draft);
}

export async function getDraft(id: string): Promise<DraftRecord | undefined> {
  const db = await specDb();

  return db.get('drafts', id);
}

export async function putDocs(record: DocsRecord): Promise<void> {
  const db = await specDb();

  await db.put('docs', record);
}

export async function getDocs(draftId: string): Promise<readonly GeneratedDoc[]> {
  const db = await specDb();
  const record = await db.get('docs', draftId);

  return record?.docs ?? [];
}

export async function putSnapshots(record: SnapshotsRecord): Promise<void> {
  const db = await specDb();

  await db.put('snapshots', record);
}

export async function getSnapshots(draftId: string): Promise<readonly StoredSnapshot[]> {
  const db = await specDb();
  const record = await db.get('snapshots', draftId);

  return record?.snapshots ?? [];
}

export async function putLock(lock: LockRecord): Promise<void> {
  const db = await specDb();

  await db.put('locks', lock);
}

export async function getLocks(): Promise<readonly LockRecord[]> {
  const db = await specDb();

  return db.getAll('locks');
}

/** Everything, gone. The one destructive function here, and only ever called on purpose. */
export async function clearAll(): Promise<void> {
  const db = await specDb();

  for (const store of ['drafts', 'answers', 'docs', 'snapshots', 'locks'] as const) {
    await db.clear(store);
  }
}
