import { Component, computed, inject, signal } from '@angular/core';
import { QuestionPanelComponent } from './ui/question-panel/question-panel.component';
import { StepRailComponent } from './ui/step-rail/step-rail.component';
import { WizardStore } from './state/wizard-store.service';

/** Width below which the rail collapses into a toggle, so a phone gets one column. */
const NARROW_QUERY = '(max-width: 720px)';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [StepRailComponent, QuestionPanelComponent],
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
      </header>

      <div class="app-layout">
        <aside class="step-rail" id="step-rail" [class.is-hidden]="!railOpen()">
          <app-step-rail [steps]="store.rail()" (select)="store.jumpTo($event)" />
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
            (next)="store.next()"
            (back)="store.back()"
          />
        </main>
      </div>
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
  readonly railOpen = signal(true);

  /** The stored text for the current question, so a control re-renders its value. */
  readonly currentText = computed(() => {
    const question = this.store.current();

    return question ? this.store.textFor(question.id) : '';
  });

  /** The trigger reason for the current question, taken from the rail entry. */
  readonly currentReason = computed(
    () => this.store.rail()[this.store.currentIndex()]?.reason ?? null,
  );

  constructor() {
    // A phone gets the content first; the rail is one tap away.
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.railOpen.set(!window.matchMedia(NARROW_QUERY).matches);
    }
  }

  toggleRail(): void {
    this.railOpen.update((open) => !open);
  }

  onValueChange(text: string): void {
    const question = this.store.current();

    if (question) {
      this.store.setText(question.id, text);
    }
  }
}
