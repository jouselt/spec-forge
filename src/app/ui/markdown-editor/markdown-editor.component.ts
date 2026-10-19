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
        // The editor grows with its document instead of scrolling inside a
        // fixed box.
        EditorView.theme({
          '&': { height: 'auto', minHeight: '12rem' },
          '.cm-scroller': { overflow: 'visible' },
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
