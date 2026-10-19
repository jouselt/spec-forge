import { Injectable, computed, inject, signal } from '@angular/core';
import { Answer, Block, GeneratedDoc, OriginKind, ReviewState } from '../core/question-graph';
import { SpecFile } from '../core/mapping';
import { hasAnyChange, mergeGeneration } from '../core/merge';
import { applySectionChoices } from '../core/diff';
import { countByOriginKind, missingOrigin, placeholderFor } from '../core/provenance';
import { assemble, gapQuestionFor } from '../templates/assembly';
import { SnapshotStore } from './snapshot-store.service';

/** The three files in the order they are read and exported. */
const FILES_ORDER: readonly SpecFile[] = ['proposal', 'design', 'tasks'];

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
  private readonly proposalList = signal<GeneratedDoc[] | null>(null);
  private readonly snapshots = inject(SnapshotStore);

  /** The three files as last generated, in proposal, design, tasks order. */
  readonly docs = this.docList.asReadonly();

  /** A generation waiting on a decision, or null. Never applied on its own. */
  readonly proposal = this.proposalList.asReadonly();

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

  /**
   * Replace the documents with a fresh assembly, behind two rules.
   *
   * A snapshot of what is there now is written first, so a generation can undo
   * itself. And the assembly is merged with the current documents rather than
   * replacing them, so a section holding locked text survives byte for byte: that
   * is what makes an import safe and what makes a hand-written sentence survive a
   * regeneration.
   *
   * This applies immediately. The UI goes through `propose()` instead, so a person
   * sees what would change before it does.
   */
  generate(answers: Answer[]): void {
    const current = this.docList();

    this.snapshots.write(current, current.length === 0 ? 'before the first generate' : 'before a generate');
    this.setDocs(mergeGeneration(current, assemble(answers)));
  }

  /**
   * Offer a generation instead of applying it.
   *
   * Nothing on screen changes: the candidate is held in `proposal` and the UI asks
   * per section. With no documents yet there is nothing to protect, so the first
   * generation applies straight away.
   */
  propose(answers: Answer[]): void {
    const current = this.docList();

    this.snapshots.write(
      current,
      current.length === 0 ? 'before the first generate' : 'before a generate',
    );

    const candidate = mergeGeneration(current, assemble(answers));

    if (current.length === 0 || !hasAnyChange(current, candidate)) {
      this.proposalList.set(null);
      this.setDocs(candidate);

      return;
    }

    this.proposalList.set(candidate);
  }

  /** Take the accepted sections of the proposal and drop the rest. */
  applyProposal(accepted: ReadonlySet<string>): void {
    const candidate = this.proposalList();

    if (!candidate) {
      return;
    }

    const current = this.docList();
    const merged = candidate.map((doc) => {
      const before = current.find((existing) => existing.file === doc.file);

      return before ? applySectionChoices(before, doc, accepted) : doc;
    });

    this.proposalList.set(null);
    this.setDocs(merged);
  }

  /** Throw the proposal away. Nothing was written, so this costs nothing. */
  discardProposal(): void {
    this.proposalList.set(null);
  }

  /**
   * Pin or unpin one block. A locked block is excluded from regeneration, so this
   * is the control that turns "I wrote this" into a promise the generator keeps.
   */
  toggleLock(id: string): void {
    this.updateBlock(id, (block) => ({ ...block, locked: !block.locked }));
  }

  /** Lock one block explicitly, for an import or a restore. */
  setLocked(id: string, locked: boolean): void {
    this.updateBlock(id, (block) => (block.locked === locked ? block : { ...block, locked }));
  }

  /**
   * Bring an imported file into the store. The snapshot is written first, for the
   * same reason generation writes one: nothing may be lost that was not saved.
   */
  importDoc(doc: GeneratedDoc): void {
    this.snapshots.write(this.docList(), `before importing ${doc.file}.md`);

    const others = this.docList().filter((candidate) => candidate.file !== doc.file);
    const ordered = [...others, doc].sort(
      (left, right) => FILES_ORDER.indexOf(left.file) - FILES_ORDER.indexOf(right.file),
    );

    this.docList.set(ordered);
  }

  /** Put a snapshot back. Returns false for an unknown id. */
  restoreSnapshot(id: string): boolean {
    const restored = this.snapshots.restore(id);

    if (!restored) {
      return false;
    }

    this.docList.set(restored);

    return true;
  }

  /**
   * Replace the documents wholesale. `generate()` is the template path; the
   * optional model path (Phase 9) hands its shaped documents to the store here,
   * so every consumer reads one source and provenance is never rebuilt.
   */
  setDocs(docs: GeneratedDoc[]): void {
    this.docList.set(docs);
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

  /**
   * Reject a block. Rejecting an inference is refusing the sentence, not just
   * flagging it: the prose goes and the section keeps its heading with a gap
   * that names the question which would fill it. A rejected inference therefore
   * leaves no text to export and the gap is what the export gate blocks on.
   */
  reject(id: string): void {
    this.updateBlock(id, (block) => {
      if (block.origin.kind !== 'model') {
        return block.review === 'rejected' ? block : { ...block, review: 'rejected' };
      }

      const question = gapQuestionFor(block.file, block.section);

      return {
        ...block,
        review: 'rejected',
        text: placeholderFor(question),
        origin: missingOrigin(question),
      };
    });
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
