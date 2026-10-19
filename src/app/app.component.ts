import { Component, computed, inject, signal } from '@angular/core';
import { QuestionPanelComponent } from './ui/question-panel/question-panel.component';
import { StepRailComponent } from './ui/step-rail/step-rail.component';
import { StepStepperComponent } from './ui/step-stepper/step-stepper.component';
import { BlockListComponent } from './ui/block-list/block-list.component';
import { OutputTabsComponent } from './ui/output-tabs/output-tabs.component';
import { ProvenancePanelComponent } from './ui/provenance-panel/provenance-panel.component';
import { ReviewPanelComponent } from './ui/review-panel/review-panel.component';
import { DocumentStore } from './state/document-store.service';
import { DraftService } from './state/draft.service';
import { ModelService } from './state/model.service';
import { ModelBarComponent } from './ui/model-bar/model-bar.component';
import { WizardStore } from './state/wizard-store.service';
import { ExportGateComponent } from './ui/export-gate/export-gate.component';
import { DiffReviewComponent } from './ui/diff-review/diff-review.component';
import { SnapshotPanelComponent } from './ui/snapshot-panel/snapshot-panel.component';

/** Width below which the rail collapses into a toggle, so a phone gets one column. */
const NARROW_QUERY = '(max-width: 720px)';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    StepRailComponent,
    QuestionPanelComponent,
    StepStepperComponent,
    OutputTabsComponent,
    ProvenancePanelComponent,
    ReviewPanelComponent,
    BlockListComponent,
    ExportGateComponent,
    ModelBarComponent,
    DiffReviewComponent,
    SnapshotPanelComponent,
  ],
  template: `
    <div class="app-container">
      <header class="app-header">
        <div class="header-bar">
          <div>
            <h1>spec-forge</h1>
            <p class="tagline">Interview first, generate second, never invent.</p>
          </div>

          <button
            type="button"
            class="rail-toggle"
            aria-controls="step-rail"
            [attr.aria-expanded]="railOpen()"
            (click)="toggleRail()"
          >
            {{ railOpen() ? 'Hide steps' : 'Show steps' }}
          </button>
        </div>

        <p class="progress">{{ store.answeredCount() }} of {{ store.total() }} answered</p>

        <app-model-bar />
      </header>

      <div class="app-layout">
        <aside class="step-rail" id="step-rail" [class.is-hidden]="!railOpen()">
          <app-step-rail
            [steps]="store.rail()"
            [highlighted]="store.highlighted()"
            (select)="onSelectStep($event)"
          />
        </aside>

        <main class="content-region">
          <app-question-panel
            [question]="store.current()"
            [value]="currentText()"
            [error]="store.currentError()"
            [reason]="currentReason()"
            [index]="store.currentIndex()"
            [total]="store.total()"
            [canAdvance]="store.canAdvance()"
            [isFirst]="store.isFirst()"
            [isLast]="store.isLast()"
            (valueChange)="onValueChange($event)"
            (next)="onNext()"
            (back)="onBack()"
          />

          <section class="output-region">
            <div class="output-bar">
              <button
                type="button"
                class="generate"
                [disabled]="!canGenerate()"
                (click)="generate()"
              >
                {{ outputOpen() ? 'Generate again' : 'Generate the spec' }}
              </button>

              @if (outputOpen()) {
                <button type="button" class="hide-output" (click)="hideOutput()">
                  Hide the output
                </button>
              }

              <span class="output-note">
                Nothing is inferred on this path: every block names the answers it read.
              </span>
            </div>

            @defer (when outputOpen()) {
              <div class="output-body">
                <app-output-tabs />
                <app-provenance-panel />
                <app-review-panel />
                <app-block-list />
                <app-diff-review />
                <app-export-gate />
                <app-snapshot-panel />
              </div>
            }
          </section>
        </main>
      </div>

      <app-step-stepper [steps]="store.rail()" />
    </div>
  `,
  styles: [
    `
      .app-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        height: 100dvh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }

      .app-header {
        background: #1a1a1a;
        color: #fff;
        padding: 1.5rem 2rem;
        border-bottom: 1px solid #333;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .header-bar {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      .app-header h1 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 600;
      }

      .tagline {
        margin: 0.25rem 0 0 0;
        font-size: 0.875rem;
        color: #aaa;
      }

      .progress {
        margin: 0.75rem 0 0 0;
        font-size: 0.8125rem;
        color: #aaa;
      }

      .rail-toggle {
        display: none;
        background: transparent;
        color: #fff;
        border-color: #444;
        white-space: nowrap;
      }

      .rail-toggle:hover:not(:disabled) {
        background: #333;
        border-color: #555;
      }

      .app-layout {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      .step-rail {
        width: 240px;
        background: #f5f5f5;
        border-right: 1px solid #ddd;
        overflow-y: auto;
        padding: 1rem 0.5rem;
      }

      .step-rail.is-hidden {
        display: none;
      }

      .content-region {
        flex: 1;
        overflow-y: auto;
        padding: 2rem;
      }

      .output-region {
        margin-top: 1.5rem;
        border-top: 1px solid #e4e4e4;
        padding-top: 1rem;
      }

      .output-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .output-bar button {
        font: inherit;
        font-size: 0.875rem;
        padding: 0.35rem 0.9rem;
        cursor: pointer;
      }

      .output-bar button:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      .output-note {
        font-size: 0.8125rem;
        color: #555;
      }

      .output-body {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      @media (max-width: 720px) {
        .app-header {
          padding: 1rem;
        }

        .app-header h1 {
          font-size: 1.375rem;
        }

        .rail-toggle {
          display: inline-block;
        }

        .app-layout {
          flex-direction: column;
        }

        .step-rail {
          width: 100%;
          max-height: 40vh;
          border-right: none;
          border-bottom: 1px solid #ddd;
        }

        .content-region {
          padding: 1rem;
        }
      }
    `,
  ],
})
export class AppComponent {
  readonly title = 'spec-forge';
  readonly store = inject(WizardStore);
  readonly docs = inject(DocumentStore);
  readonly railOpen = signal(true);

  /** True once the output has been generated at least once. */
  readonly outputOpen = signal(false);

  /** Generating with no answers would only produce gaps, so the button waits. */
  readonly canGenerate = computed(() => this.store.answeredCount() > 0);

  /** The stored text for the current question, so a control re-renders its value. */
  readonly currentText = computed(() => {
    const question = this.store.current();

    return question ? this.store.textFor(question.id) : '';
  });

  /** The trigger reason for the current question, taken from the rail entry. */
  readonly currentReason = computed(
    () => this.store.rail()[this.store.currentIndex()]?.reason ?? null,
  );

  readonly draft = inject(DraftService);
  readonly model = inject(ModelService);

  constructor() {
    // A phone gets the content first; the rail is one tap away.
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.railOpen.set(!window.matchMedia(NARROW_QUERY).matches);
    }

    // Resume before anything else can write, so a returning visit opens where the
    // person left instead of on an empty first question.
    void this.draft.restore();

    if (typeof window !== 'undefined') {
      // A closed tab is the failure this exists for, and `visibilitychange` is the only
      // event that reliably fires on mobile before the page goes away.
      window.addEventListener('beforeunload', () => this.draft.flushPending());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.draft.flushPending();
        }
      });
    }
  }

  /**
   * A step change is rare and expensive to lose, so it does not wait for the debounce.
   * Three separate methods instead of one taking a callback, because an Angular template
   * cannot evaluate an arrow function.
   */
  onNext(): void {
    this.store.next();
    void this.draft.saveNow();
  }

  onBack(): void {
    this.store.back();
    void this.draft.saveNow();
  }

  onSelectStep(index: number): void {
    this.store.jumpTo(index);
    void this.draft.saveNow();
  }

  toggleRail(): void {
    this.railOpen.update((open) => !open);
  }

  onValueChange(text: string): void {
    const question = this.store.current();

    if (question) {
      this.store.setText(question.id, text);
      this.draft.saveSoon();
    }
  }

  /**
   * Assemble the three files from the answers and show them. The template path
   * is the default, so this hands the store the answers and no model is loaded.
   */
  async generate(): Promise<void> {
    // With a model turned on the run goes through the shaper, which refuses to use output
    // that does not cite its answers. Everything else is the template path, unchanged.
    if (this.model.canShape()) {
      const result = await this.model.shape(this.store.snapshot());

      this.docs.setDocs([...result.docs]);
      this.outputOpen.set(true);

      return;
    }

    this.docs.propose(this.store.snapshot());
    this.outputOpen.set(true);
  }

  hideOutput(): void {
    this.outputOpen.set(false);
  }
}
