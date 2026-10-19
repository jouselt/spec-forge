import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SpecFile } from '../../core/mapping';
import { SectionDiff, diffSections, sectionKey } from '../../core/diff';
import { DocumentStore } from '../../state/document-store.service';

interface FileDiff {
  readonly file: SpecFile;
  readonly changed: readonly SectionDiff[];
}

/**
 * What a regeneration would change, one section at a time.
 *
 * Nothing here has been applied yet. Every changed section starts accepted, which is
 * the merge behaviour a person expects from a diff, and the two buttons at the bottom
 * are the only things that write: apply takes what is ticked, keep mine throws the
 * whole candidate away.
 *
 * A locked section is shown and cannot be ticked. Seeing it is the point: the person
 * should know their text is in that file and the generator is not touching it.
 */
@Component({
  selector: 'app-diff-review',
  standalone: true,
  template: `
    <section class="diff-review">
      @if (groups().length > 0) {
        <header class="review-head">
        <h3 class="review-title">What the new run would change</h3>
        <p class="review-count">{{ changedCount() }} of {{ sectionCount() }} sections</p>
      </header>

      @for (group of groups(); track group.file) {
        <article class="diff-file" [attr.data-file]="group.file">
          <h4 class="file-name">{{ group.file }}.md</h4>

          @for (diff of group.changed; track diff.section) {
            <div
              class="diff-section"
              [attr.data-section]="diff.section"
              [class.is-locked]="diff.locked"
            >
              <label class="section-head">
                <input
                  type="checkbox"
                  class="accept-toggle"
                  [checked]="isAccepted(group.file, diff.section)"
                  [disabled]="diff.locked"
                  (change)="toggle(group.file, diff.section)"
                />
                <span class="section-name">{{ diff.section }}</span>
                @if (diff.locked) {
                  <span class="lock-badge">This is your text</span>
                }
              </label>

              <ul class="diff-lines">
                @for (line of diff.lines; track $index) {
                  @if (line.kind !== 'same') {
                    <li class="diff-line" [attr.data-kind]="line.kind">
                      <span class="marker">{{ line.kind === 'added' ? '+' : '-' }}</span>
                      <span class="line-text">{{ line.text }}</span>
                    </li>
                  }
                }
              </ul>
            </div>
          }
        </article>
      }

      <div class="review-actions">
        <button type="button" class="apply-diff" [disabled]="accepted().size === 0" (click)="apply()">
          Apply {{ accepted().size }} to the spec
        </button>
        <button type="button" class="keep-mine" (click)="keepMine()">Keep my text</button>
      </div>
      }
    </section>
  `,
  styles: [
    `
      .diff-review {
        margin-top: 1.5rem;
        border: 1px solid #d0d0d0;
        border-radius: 4px;
        padding: 0.9rem;
        background: #fffdf5;
      }
      .review-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
      }
      .review-title {
        margin: 0;
        font-size: 0.95rem;
      }
      .review-count {
        margin: 0;
        font-size: 0.8rem;
        color: #666;
      }
      .file-name {
        margin: 0.8rem 0 0.3rem;
        font-size: 0.85rem;
      }
      .diff-section {
        margin-bottom: 0.6rem;
      }
      .section-head {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .lock-badge {
        font-size: 0.7rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #7a5b00;
        background: #fff4cc;
        border-radius: 3px;
        padding: 0.05rem 0.35rem;
      }
      .diff-lines {
        margin: 0.25rem 0 0;
        padding: 0;
        list-style: none;
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
      }
      .diff-line {
        display: flex;
        gap: 0.35rem;
        padding: 0.05rem 0.3rem;
        white-space: pre-wrap;
      }
      .diff-line[data-kind='added'] {
        background: #eaf7ea;
      }
      .diff-line[data-kind='removed'] {
        background: #fdeaea;
      }
      .marker {
        width: 0.7rem;
        color: #666;
      }
      .review-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.8rem;
      }
      .apply-diff,
      .keep-mine {
        padding: 0.3rem 0.8rem;
        cursor: pointer;
      }
      .apply-diff[disabled] {
        cursor: not-allowed;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiffReviewComponent {
  private readonly store = inject(DocumentStore);

  /** Every section key that is ticked, starting with every changed one. */
  private readonly selections = signal<ReadonlySet<string>>(new Set());
  private readonly touched = signal(false);

  readonly groups = computed<FileDiff[]>(() => {
    const candidate = this.store.proposal();
    const current = this.store.docs();

    if (!candidate) {
      return [];
    }

    return candidate
      .map((doc) => {
        const before = current.find((existing) => existing.file === doc.file);

        if (!before) {
          return { file: doc.file, changed: [] as SectionDiff[] };
        }

        return {
          file: doc.file,
          changed: diffSections(before, doc).filter((diff) => diff.changed || diff.locked),
        };
      })
      .filter((group) => group.changed.length > 0);
  });

  readonly sectionCount = computed(() =>
    this.groups().reduce((total, group) => total + group.changed.length, 0),
  );

  /** Tick everything that changed, unless the person has started choosing. */
  readonly accepted = computed<ReadonlySet<string>>(() => {
    if (this.touched()) {
      return this.selections();
    }

    return new Set(
      this.groups().flatMap((group) =>
        group.changed
          .filter((diff) => diff.changed && !diff.locked)
          .map((diff) => sectionKey(group.file, diff.section)),
      ),
    );
  });

  readonly changedCount = computed(() => this.accepted().size);

  isAccepted(file: SpecFile, section: string): boolean {
    return this.accepted().has(sectionKey(file, section));
  }

  toggle(file: SpecFile, section: string): void {
    const key = sectionKey(file, section);
    const next = new Set(this.accepted());

    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }

    this.touched.set(true);
    this.selections.set(next);
  }

  apply(): void {
    this.store.applyProposal(this.accepted());
    this.touched.set(false);
    this.selections.set(new Set());
  }

  keepMine(): void {
    this.store.discardProposal();
    this.touched.set(false);
    this.selections.set(new Set());
  }
}
