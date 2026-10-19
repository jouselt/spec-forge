import { Component, inject, signal } from '@angular/core';
import { Block } from '../../core/question-graph';
import { SpecFile } from '../../core/mapping';
import { DocumentStore } from '../../state/document-store.service';
import { MarkdownEditorComponent } from '../markdown-editor/markdown-editor.component';

/** The three generated files, in the order they are exported. */
const FILES: readonly SpecFile[] = ['proposal', 'design', 'tasks'];

/** The blocks of one `##` section, in document order. */
interface SectionGroup {
  readonly section: string;
  readonly blocks: Block[];
}

/**
 * The three files, one editor per block, grouped under its section heading.
 *
 * One editor per block rather than one per file, for two reasons. Provenance is
 * per block, so an edit maps to exactly one block id and no diffing is needed to
 * find which block it belongs to. And CodeMirror renders only the window of
 * lines that fits its box, leaving a `cm-gap` for the rest, which hid the tail
 * of a long file; a block is a line or two, so nothing is ever hidden.
 *
 * Only the active file mounts its editors, and what they show comes from the
 * store, so switching tabs re-reads the same documents and no edit is lost.
 */
@Component({
  selector: 'app-output-tabs',
  standalone: true,
  imports: [MarkdownEditorComponent],
  template: `
    <div class="tabs" role="tablist">
      @for (file of files; track file) {
        <button
          type="button"
          role="tab"
          class="tab-button"
          [attr.aria-selected]="active() === file"
          [class.is-active]="active() === file"
          (click)="select(file)"
        >
          {{ file }}
        </button>
      }
    </div>

    @for (file of files; track file) {
      <section class="tab-panel" role="tabpanel" [hidden]="active() !== file">
        @if (active() === file) {
          @for (group of sectionsFor(file); track group.section) {
            <article class="section" [attr.data-section]="group.section">
              <h3 class="section-heading">{{ group.section }}</h3>

              @for (block of group.blocks; track block.id) {
                <div class="block-editor" [attr.data-block-id]="block.id">
                  <app-markdown-editor
                    [value]="block.text"
                    (valueChange)="onBlockText(block.id, $event)"
                  />
                  <p class="block-kind" [attr.data-kind]="block.origin.kind">
                    {{ block.origin.kind }}
                  </p>
                </div>
              }
            </article>
          }
        }
      </section>
    }

    <p class="hint">
      Edit any block in place. A hand-edited block keeps the answers it came from.
    </p>
  `,
  styles: [
    `
      .tabs {
        display: flex;
        gap: 0.25rem;
        border-bottom: 1px solid #d0d0d0;
        margin-bottom: 0.75rem;
      }
      .tab-button {
        padding: 0.35rem 0.9rem;
        border: 1px solid transparent;
        border-bottom: none;
        background: none;
        cursor: pointer;
        font: inherit;
      }
      .tab-button.is-active {
        border-color: #d0d0d0;
        border-radius: 4px 4px 0 0;
        background: #fff;
      }
      .section {
        margin-bottom: 1rem;
      }
      .section-heading {
        margin: 0 0 0.35rem;
        font-size: 0.9rem;
      }
      .block-editor {
        margin-bottom: 0.5rem;
      }
      .block-kind {
        margin: 0.15rem 0 0;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #666;
      }
      .hint {
        margin: 0.5rem 0 0;
        font-size: 0.85rem;
        color: #666;
      }
    `,
  ],
})
export class OutputTabsComponent {
  private readonly store = inject(DocumentStore);

  readonly files = FILES;
  readonly active = signal<SpecFile>('proposal');

  /** The blocks of one file, grouped by the section they belong to. */
  sectionsFor(file: SpecFile): SectionGroup[] {
    const groups: SectionGroup[] = [];

    for (const block of this.store.blocksFor(file)) {
      const last = groups[groups.length - 1];

      if (last && last.section === block.section) {
        last.blocks.push(block);
      } else {
        groups.push({ section: block.section, blocks: [block] });
      }
    }

    return groups;
  }

  select(file: SpecFile): void {
    this.active.set(file);
  }

  /**
   * One block's text changed. The block id came from the editor that produced
   * the edit, so this is the whole mapping: no diff, no offset arithmetic, and
   * no way to attribute an edit to the wrong block. An edit that changes
   * nothing never reaches the store.
   */
  onBlockText(id: string, text: string): void {
    const block = this.store
      .docs()
      .flatMap((doc) => doc.blocks)
      .find((candidate) => candidate.id === id);

    if (!block || block.text === text) {
      return;
    }

    this.store.setBlockText(id, text);
  }
}
