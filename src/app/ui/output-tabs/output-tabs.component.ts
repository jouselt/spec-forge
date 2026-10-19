import { Component, inject, signal } from '@angular/core';
import { Block } from '../../core/question-graph';
import { SpecFile } from '../../core/mapping';
import { DocumentStore } from '../../state/document-store.service';
import { renderMarkdown } from '../../templates/assembly';
import { MarkdownEditorComponent } from '../markdown-editor/markdown-editor.component';

/** The three generated files, in the order they are exported. */
const FILES: readonly SpecFile[] = ['proposal', 'design', 'tasks'];

/** Where one block's text sits inside the rendered markdown. */
interface BlockSpan {
  id: string;
  start: number;
  end: number;
  text: string;
}

/** One edit, expressed as what was removed at an offset and what replaced it. */
interface TextEdit {
  at: number;
  removed: string;
  inserted: string;
}

/**
 * The single edit that turns `before` into `after`, or null when they are equal.
 * The common prefix and suffix are trimmed, so one keystroke yields one edit.
 */
export function singleEdit(before: string, after: string): TextEdit | null {
  if (before === after) {
    return null;
  }

  let prefix = 0;
  const shortest = Math.min(before.length, after.length);

  while (prefix < shortest && before[prefix] === after[prefix]) {
    prefix += 1;
  }

  let suffix = 0;

  while (
    suffix < shortest - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    at: prefix,
    removed: before.slice(prefix, before.length - suffix),
    inserted: after.slice(prefix, after.length - suffix),
  };
}

/** Apply one edit to a string. */
export function applyEdit(text: string, edit: TextEdit): string {
  return `${text.slice(0, edit.at)}${edit.inserted}${text.slice(edit.at + edit.removed.length)}`;
}

/**
 * The three tabs, one markdown editor each. An edit in an editor is mapped back
 * to the block that owns that region of the file, so the store keeps provenance
 * and review state on the block rather than on the whole document.
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
      <div class="tab-panel" role="tabpanel" [hidden]="active() !== file">
        <app-markdown-editor [value]="markdownFor(file)" (valueChange)="onTextChange(file, $event)" />
      </div>
    }

    <p class="hint">Edit any block in place. A hand-edited block keeps the answers it came from.</p>
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
      .tab-panel {
        min-height: 12rem;
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

  /** The rendered markdown for one file, empty before a generate. */
  markdownFor(file: SpecFile): string {
    const doc = this.store.docs().find((candidate) => candidate.file === file);

    return doc ? renderMarkdown(doc) : '';
  }

  select(file: SpecFile): void {
    this.active.set(file);
  }

  /**
   * Map an editor's new text back onto the block it changed.
   *
   * The whole file is in one editor, but provenance lives on blocks, so the
   * edit is located, translated into an offset inside the owning block's text,
   * and applied there. An edit outside every block, or one that changes
   * nothing, is ignored rather than guessed at.
   */
  onTextChange(file: SpecFile, text: string): void {
    const before = this.markdownFor(file);

    if (before === text) {
      return;
    }

    const edit = singleEdit(before, text);

    if (!edit) {
      return;
    }

    const span = this.spansFor(file, before).find(
      (candidate) => edit.at >= candidate.start && edit.at <= candidate.end,
    );

    if (!span) {
      return;
    }

    const next = applyEdit(span.text, { ...edit, at: edit.at - span.start });

    if (next !== span.text) {
      this.store.setBlockText(span.id, next);
    }
  }

  /** Where each block's text sits in the rendered file, in document order. */
  private spansFor(file: SpecFile, markdown: string): BlockSpan[] {
    const spans: BlockSpan[] = [];
    let cursor = 0;

    for (const block of this.store.blocksFor(file) as Block[]) {
      const start = markdown.indexOf(block.text, cursor);

      if (start < 0) {
        continue;
      }

      spans.push({ id: block.id, start, end: start + block.text.length, text: block.text });
      cursor = start + block.text.length;
    }

    return spans;
  }
}
