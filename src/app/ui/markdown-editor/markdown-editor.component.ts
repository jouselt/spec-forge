import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';

/**
 * A markdown editor over CodeMirror 6: `[value]` in, `(valueChange)` out.
 *
 * A programmatic value never emits, so a parent bound to a store cannot loop on
 * its own writes. Only a real document change coming from the editor emits.
 */
@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  template: ` <div class="editor" #host></div> `,
  styles: [
    `
      .editor {
        border: 1px solid #d0d0d0;
        border-radius: 4px;
      }
    `,
  ],
})
export class MarkdownEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** The markdown to show. Changing it replaces the editor document. */
  @Input() value = '';

  /** Emitted on every user edit, with the whole document text. */
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLElement>;

  private view: EditorView | null = null;

  /** True while a programmatic dispatch runs, so its own listener ignores it. */
  private applying = false;

  ngAfterViewInit(): void {
    this.view = new EditorView({
      doc: this.value,
      extensions: [
        markdown(),
        EditorView.lineWrapping,
        // A bounded box, sized to its content up to a ceiling. CodeMirror
        // renders the lines that fit the box plus a wide margin, and leaves a
        // `cm-gap` for anything beyond it, so the box must be big enough for the
        // whole document. Every caller here edits one block, which is a line or
        // two, so the ceiling is never reached and nothing is ever gapped. An
        // unbounded box has the opposite failure: it grows to whatever was
        // rendered and never learns the document is longer.
        EditorView.theme({
          '&': { minHeight: '3rem', maxHeight: '14rem' },
          '.cm-scroller': { overflow: 'auto' },
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || this.applying) {
            return;
          }

          this.valueChange.emit(update.state.doc.toString());
        }),
      ],
      parent: this.host.nativeElement,
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.applyValue(this.value);
    }
  }

  ngOnDestroy(): void {
    this.view?.destroy();
    this.view = null;
  }

  private applyValue(text: string): void {
    const view = this.view;

    if (!view || view.state.doc.toString() === text) {
      return;
    }

    this.applying = true;

    try {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    } finally {
      this.applying = false;
    }
  }
}
