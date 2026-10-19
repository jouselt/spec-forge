import { Injectable, computed, signal } from '@angular/core';
import { Answer, Block, GeneratedDoc, OriginKind, ReviewState } from '../core/question-graph';
import { SpecFile } from '../core/mapping';
import { countByOriginKind } from '../core/provenance';
import { assemble } from '../templates/assembly';

/**
 * Owns the current generated documents, the generate action, block text
 * mutation and the review transitions.
 *
 * One service, not two: an edit and a review both mutate the same `Block`, so
 * splitting them across services that must stay in agreement is a bug waiting
 * to happen. `snapshot-store` (Phase 7) versions these documents instead of
 * owning them.
 */
@Injectable({ providedIn: 'root' })
export class DocumentStore {
  private readonly docList = signal<GeneratedDoc[]>([]);

  /** The three files as last generated, in proposal, design, tasks order. */
  readonly docs = this.docList.asReadonly();

  /** Every block across the three files. */
  readonly totalBlocks = computed(() =>
    this.docList().reduce((total, doc) => total + doc.blocks.length, 0),
  );

  /** The blocks of one file, empty before the first generation. */
  blocksFor(file: SpecFile): Block[] {
    return this.docList().find((doc) => doc.file === file)?.blocks ?? [];
  }

  /** Counts per origin kind for one file, with every kind present at zero. */
  countsFor(file: SpecFile): Record<OriginKind, number> {
    return countByOriginKind(this.blocksFor(file));
  }

  /** Replace the documents with a fresh assembly. Never appends. */
  generate(answers: Answer[]): void {
    this.docList.set(assemble(answers));
  }

  /**
   * Hand-edit one block. The text changes, the block is marked edited for
   * review, and the origin it came from is kept under `derivedFrom` so a panel
   * can still name the answers behind the edit.
   */
  setBlockText(id: string, text: string): void {
    this.updateBlock(id, (block) => ({
      ...block,
      text,
      origin: { kind: 'edited', derivedFrom: block.origin },
      review: 'edited',
    }));
  }

  confirm(id: string): void {
    this.setReview(id, 'confirmed');
  }

  reject(id: string): void {
    this.setReview(id, 'rejected');
  }

  edit(id: string): void {
    this.setReview(id, 'edited');
  }

  private setReview(id: string, review: ReviewState): void {
    this.updateBlock(id, (block) => (block.review === review ? block : { ...block, review }));
  }

  /** Apply a change to one block. An unknown id is a no-op, never a throw. */
  private updateBlock(id: string, change: (block: Block) => Block): void {
    const current = this.docList();

    if (!current.some((doc) => doc.blocks.some((block) => block.id === id))) {
      return;
    }

    this.docList.set(
      current.map((doc) =>
        doc.blocks.some((block) => block.id === id)
          ? { ...doc, blocks: doc.blocks.map((block) => (block.id === id ? change(block) : block)) }
          : doc,
      ),
    );
  }
}
