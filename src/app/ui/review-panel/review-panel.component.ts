import { Component, inject } from '@angular/core';
import { Block } from '../../core/question-graph';
import { DocumentStore } from '../../state/document-store.service';

/**
 * One row per inferred block, with Confirm, Edit and Reject.
 *
 * Only inferred blocks appear here: text a person wrote, and text a template
 * produced, needs no review. Confirm accepts the inference, Edit records that it
 * was rewritten by hand, and Reject refuses it, which replaces the prose with a
 * gap and takes the row out of this list.
 */
@Component({
  selector: 'app-review-panel',
  standalone: true,
  template: `
    <div class="review-panel">
      <h3 class="review-heading">Inferred text to review</h3>

      @if (inferred().length === 0) {
        <p class="review-empty">Nothing was inferred, so nothing needs review.</p>
      } @else {
        <ul class="review-rows">
          @for (block of inferred(); track block.id) {
            <li class="review-row" [attr.data-block-id]="block.id">
              <div class="review-body">
                <span class="review-section">{{ block.section }}</span>
                <p class="review-text">{{ block.text }}</p>
                <span class="review-state">{{ block.review }}</span>
              </div>

              <div class="review-actions">
                <button type="button" class="review-confirm" (click)="confirm(block.id)">
                  Confirm
                </button>
                <button type="button" class="review-edit" (click)="edit(block.id)">Edit</button>
                <button type="button" class="review-reject" (click)="reject(block.id)">
                  Reject
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .review-heading {
        margin: 0 0 0.5rem;
        font-size: 0.95rem;
      }
      .review-empty {
        margin: 0;
        font-size: 0.85rem;
        color: #555;
      }
      .review-rows {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .review-row {
        display: flex;
        gap: 0.75rem;
        justify-content: space-between;
        align-items: flex-start;
        padding: 0.5rem 0;
        border-top: 1px solid #e4e4e4;
      }
      .review-section {
        display: block;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #555;
      }
      .review-text {
        margin: 0.15rem 0;
      }
      .review-state {
        font-size: 0.75rem;
        color: #555;
      }
      .review-actions {
        display: flex;
        gap: 0.35rem;
        flex-shrink: 0;
      }
      .review-actions button {
        font: inherit;
        font-size: 0.8rem;
        padding: 0.2rem 0.55rem;
        cursor: pointer;
      }
    `,
  ],
})
export class ReviewPanelComponent {
  private readonly store = inject(DocumentStore);

  /** The blocks a model wrote. A template run leaves this empty. */
  inferred(): Block[] {
    return this.store
      .docs()
      .flatMap((doc) => doc.blocks)
      .filter((block) => block.origin.kind === 'model');
  }

  confirm(id: string): void {
    this.store.confirm(id);
  }

  edit(id: string): void {
    this.store.edit(id);
  }

  reject(id: string): void {
    this.store.reject(id);
  }
}
