import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GeneratedDoc } from '../../core/question-graph';
import { SpecFile } from '../../core/mapping';
import { GateResult, evaluate, groupBlocking, verdictLine } from '../../core/gate';
import { downloadMarkdown } from '../../core/download';
import { renderMarkdown } from '../../templates/assembly';
import { DocumentStore } from '../../state/document-store.service';
import { SettingsStore } from '../../state/settings.service';

/**
 * The export gate: what the three files contain, what is stopping them, and the
 * buttons that hand them over.
 *
 * The report is always visible, not only when something blocks. A run with no
 * model and no gaps shows three live buttons and a line saying nothing is
 * blocking, which is the design working: the safest path is also the fastest one.
 */
@Component({
  selector: 'app-export-gate',
  standalone: true,
  template: `
    <section class="gate">
      <header class="gate-head">
        <h3 class="gate-title">Export</h3>
        <label class="warn-setting">
          <input
            type="checkbox"
            class="warn-toggle"
            [checked]="settings.warnInsteadOfBlock()"
            (change)="toggleWarn($event)"
          />
          Warn instead of block
        </label>
      </header>

      <p class="gate-verdict" [class.is-blocked]="!result().canExport">
        {{ verdict() }}
      </p>

      @if (groups().length > 0) {
        <ul class="blocking-list">
          @for (group of groups(); track group.file + group.kind) {
            <li class="blocking-row" [attr.data-kind]="group.kind" [attr.data-file]="group.file">
              <span class="blocking-count">{{ group.count }}</span>
              <span class="blocking-file">{{ group.file }}.md</span>
              <span class="blocking-detail">{{ group.details[0] }}</span>
            </li>
          }
        </ul>
      }

      <table class="report">
        <thead>
          <tr>
            <th scope="col">File</th>
            <th scope="col">Blocks</th>
            <th scope="col">Sourced</th>
            <th scope="col">Inferred, unreviewed</th>
            <th scope="col">Gaps</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of result().report; track row.file) {
            <tr class="report-row" [attr.data-file]="row.file">
              <th scope="row" class="report-file">{{ row.file }}.md</th>
              <td class="report-blocks">{{ row.blocks }}</td>
              <td class="report-sourced">{{ row.sourced }}</td>
              <td class="report-inferred">{{ row.inferredUnreviewed }}</td>
              <td class="report-gaps">{{ row.gaps }}</td>
              <td>
                <button
                  type="button"
                  class="download-button"
                  [attr.data-file]="row.file"
                  [disabled]="!result().canExport"
                  [attr.title]="result().canExport ? 'Download ' + row.file + '.md' : verdict()"
                  (click)="download(row.file)"
                >
                  Download
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>

      @if (result().warnings.length > 0) {
        <ul class="warning-list">
          @for (warning of result().warnings; track warning.code + warning.detail) {
            <li class="warning-row" [attr.data-code]="warning.code">{{ warning.detail }}</li>
          }
        </ul>
      }

      @if (result().styleFindings.length > 0) {
        <ul class="style-list">
          @for (finding of result().styleFindings; track finding.blockId + finding.word) {
            <li class="style-row" [attr.data-word]="finding.word">
              {{ finding.file }}.md, {{ finding.blockId }}: "{{ finding.word }}": {{ finding.excerpt }}
            </li>
          }
        </ul>
      }

      @if (lastDownload()) {
        <p class="last-download">Saved {{ lastDownload() }}.</p>
      }
    </section>
  `,
  styles: [
    `
      .gate {
        margin-top: 1.5rem;
        border-top: 1px solid #d0d0d0;
        padding-top: 1rem;
      }
      .gate-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
      }
      .gate-title {
        margin: 0;
        font-size: 1rem;
      }
      .warn-setting {
        font-size: 0.85rem;
        color: #444;
      }
      .gate-verdict {
        margin: 0.4rem 0 0.75rem;
        font-size: 0.9rem;
      }
      .gate-verdict.is-blocked {
        color: #a03030;
        font-weight: 600;
      }
      .blocking-list,
      .warning-list,
      .style-list {
        margin: 0 0 0.75rem;
        padding-left: 1.1rem;
        font-size: 0.85rem;
      }
      .blocking-row {
        color: #a03030;
      }
      .blocking-file {
        font-weight: 600;
        margin-right: 0.4rem;
      }
      .warning-row {
        color: #7a5b00;
      }
      .report {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }
      .report th,
      .report td {
        border-bottom: 1px solid #e4e4e4;
        padding: 0.3rem 0.4rem;
        text-align: left;
      }
      .report-file {
        font-weight: 600;
      }
      .download-button {
        padding: 0.2rem 0.7rem;
        cursor: pointer;
      }
      .download-button[disabled] {
        cursor: not-allowed;
      }
      .last-download {
        margin: 0.6rem 0 0;
        font-size: 0.85rem;
        color: #2b6b2b;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportGateComponent {
  private readonly store = inject(DocumentStore);
  readonly settings = inject(SettingsStore);

  readonly lastDownload = signal<string | null>(null);

  readonly result = computed<GateResult>(() =>
    evaluate(this.store.docs(), { warnInsteadOfBlock: this.settings.warnInsteadOfBlock() }),
  );

  readonly verdict = computed(() => verdictLine(this.result()));

  readonly groups = computed(() => groupBlocking(this.result().blocking));

  toggleWarn(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.settings.setWarnInsteadOfBlock(target?.checked === true);
  }

  download(file: SpecFile): void {
    const result = this.result();

    if (!result.canExport) {
      return;
    }

    const doc = this.store.docs().find((candidate: GeneratedDoc) => candidate.file === file);

    if (!doc) {
      return;
    }

    const text = renderMarkdown(doc, {
      markUnreviewedInferred: this.settings.warnInsteadOfBlock(),
    });

    this.lastDownload.set(downloadMarkdown(file, text));
  }
}
