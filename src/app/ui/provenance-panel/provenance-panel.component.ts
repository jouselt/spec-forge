import { Component, computed, inject } from '@angular/core';
import { OriginKind } from '../../core/question-graph';
import { SpecFile } from '../../core/mapping';
import { countByOriginKind } from '../../core/provenance';
import { DocumentStore } from '../../state/document-store.service';

/** The three generated files, in the order they are exported. */
const FILES: readonly SpecFile[] = ['proposal', 'design', 'tasks'];

/** Every origin kind, so a file always renders one row per kind. */
const KINDS: readonly OriginKind[] = [
  'answer',
  'template',
  'model',
  'imported',
  'edited',
  'missing',
];

interface FileReport {
  readonly file: SpecFile;
  readonly counts: Record<OriginKind, number>;
  readonly total: number;
}

/**
 * Where the text came from, per file: how many blocks of each origin kind, and
 * how many blocks the file holds. The total is the sum of the kinds, so a
 * reader can check it by adding the rows up.
 */
@Component({
  selector: 'app-provenance-panel',
  standalone: true,
  template: `
    <div class="provenance-panel">
      @for (report of reports(); track report.file) {
        <div class="provenance-file">
          <h3 class="provenance-name">{{ report.file }}</h3>

          <ul class="provenance-kinds">
            @for (kind of kinds; track kind) {
              <li class="provenance-kind" [attr.data-kind]="kind">
                <span class="provenance-label">{{ kind }}</span>
                <span class="provenance-count">{{ report.counts[kind] }}</span>
              </li>
            }
          </ul>

          <p class="provenance-total">{{ report.total }} in this file</p>
        </div>
      }

      <p class="provenance-grand-total">{{ totalBlocks() }} in total</p>
    </div>
  `,
  styles: [
    `
      .provenance-panel {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .provenance-file {
        flex: 1 1 12rem;
        border: 1px solid #d0d0d0;
        border-radius: 4px;
        padding: 0.5rem 0.75rem;
      }
      .provenance-name {
        margin: 0 0 0.35rem;
        font-size: 0.95rem;
      }
      .provenance-kinds {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .provenance-kind {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        padding: 0.1rem 0;
      }
      .provenance-kind[data-kind='model'] .provenance-label {
        font-weight: 600;
      }
      .provenance-total,
      .provenance-grand-total {
        margin: 0.4rem 0 0;
        font-size: 0.8rem;
        color: #555;
      }
    `,
  ],
})
export class ProvenancePanelComponent {
  private readonly store = inject(DocumentStore);

  readonly kinds = KINDS;

  /** One row per file, with the counts and the block total. */
  readonly reports = computed<FileReport[]>(() =>
    FILES.map((file) => {
      const blocks = this.store.blocksFor(file);

      return { file, counts: countByOriginKind(blocks), total: blocks.length };
    }),
  );

  readonly totalBlocks = this.store.totalBlocks;
}
