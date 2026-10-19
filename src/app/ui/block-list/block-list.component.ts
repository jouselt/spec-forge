import { Component, inject } from '@angular/core';
import { Block, isSourced } from '../../core/question-graph';
import { sourceAnswerIds } from '../../core/provenance';
import { DocumentStore } from '../../state/document-store.service';
import { WizardStore } from '../../state/wizard-store.service';

/**
 * Every generated block as a row, grouped by file, with where it came from.
 *
 * A sourced row carries a button that jumps to the answer behind it and marks
 * it in the rail. An inferred row carries the `model-inferred` badge and a
 * distinct background instead, because there is no answer to point at: a model
 * wrote it and a person has to accept or refuse it.
 */
@Component({
  selector: 'app-block-list',
  standalone: true,
  template: `
    <div class="block-list">
      @for (doc of docs(); track doc.file) {
        <section class="block-file" [attr.data-file]="doc.file">
          <h3 class="block-file-name">{{ doc.file }}</h3>

          @if (doc.blocks.length === 0) {
            <p class="block-empty">This file holds no blocks yet.</p>
          } @else {
            <ul class="block-rows">
              @for (block of doc.blocks; track block.id) {
                <li
                  class="block-row"
                  [attr.data-block-id]="block.id"
                  [attr.data-kind]="block.origin.kind"
                  [class.is-inferred]="isInferred(block)"
                  [class.is-gap]="block.origin.kind === 'missing'"
                >
                  <div class="block-body">
                    <span class="block-section">{{ block.section }}</span>
                    <p class="block-text">{{ block.text }}</p>
                  </div>

                  <div class="block-meta">
                    <span class="block-kind">{{ block.origin.kind }}</span>

                    @if (isInferred(block)) {
                      <span class="model-inferred">model-inferred</span>
                    } @else if (isSourced(block.origin)) {
                      <button type="button" class="block-source" (click)="seeSource(block)">
                        Where this came from
                      </button>
                    }
                  </div>
                </li>
              }
            </ul>
          }
        </section>
      }
    </div>
  `,
  styles: [
    `
      .block-file {
        margin-bottom: 1rem;
      }
      .block-file-name {
        margin: 0 0 0.35rem;
        font-size: 0.95rem;
      }
      .block-empty {
        margin: 0;
        font-size: 0.85rem;
        color: #555;
      }
      .block-rows {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .block-row {
        display: flex;
        gap: 0.75rem;
        justify-content: space-between;
        align-items: flex-start;
        padding: 0.4rem 0.5rem;
        border-left: 3px solid transparent;
        border-top: 1px solid #e4e4e4;
      }
      .block-row.is-inferred {
        background: #fff4e0;
        border-left-color: #c47f00;
      }
      .block-row.is-gap {
        border-left-color: #b00020;
      }
      .block-section {
        display: block;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #555;
      }
      .block-text {
        margin: 0.1rem 0 0;
      }
      .block-meta {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-shrink: 0;
      }
      .block-kind,
      .model-inferred {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #555;
      }
      .model-inferred {
        color: #8a4b00;
        border: 1px solid currentColor;
        border-radius: 999px;
        padding: 0 0.4rem;
      }
      .block-source {
        font: inherit;
        font-size: 0.75rem;
        padding: 0.15rem 0.5rem;
        cursor: pointer;
      }
    `,
  ],
})
export class BlockListComponent {
  private readonly store = inject(DocumentStore);
  private readonly wizard = inject(WizardStore);

  readonly docs = this.store.docs;
  readonly isSourced = isSourced;

  /** True when a model wrote the block, which is the one case that needs review. */
  isInferred(block: Block): boolean {
    return block.origin.kind === 'model';
  }

  /**
   * Jump to the answer behind a block and mark it. The first source answers the
   * question "where did this sentence come from"; a block with no source has no
   * button, so this is never called for a gap.
   */
  seeSource(block: Block): void {
    const [first] = sourceAnswerIds(block.origin);

    if (first) {
      this.wizard.highlightAnswer(first);
    }
  }
}
