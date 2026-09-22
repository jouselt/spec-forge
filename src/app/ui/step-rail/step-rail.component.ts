import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RailStep } from '../../state/wizard-store.service';

/**
 * The rail listing every question in order, marking the current one and the
 * answered ones. Clicking a step jumps to it. Presentational: the parent holds
 * the state and reacts to `select`.
 */
@Component({
  selector: 'app-step-rail',
  standalone: true,
  template: `
    <nav class="rail" aria-label="Interview steps">
      <ol class="rail-list">
        @for (step of steps; track step.question.id) {
          <li class="rail-item">
            <button
              type="button"
              class="rail-button"
              [class.is-current]="step.status === 'current'"
              [class.is-answered]="step.answered"
              [attr.aria-current]="step.status === 'current' ? 'step' : null"
              [attr.data-step-id]="step.question.id"
              (click)="select.emit(step.index)"
            >
              <span class="rail-number">{{ step.index + 1 }}</span>
              <span class="rail-body">
                <span class="rail-prompt">{{ step.question.prompt }}</span>
                <span class="rail-meta">
                  <span class="rail-state">{{ stateLabel(step) }}</span>
                  @if (step.question.adaptive) {
                    <span class="rail-tag">Follow-up</span>
                  }
                </span>
                @if (step.reason) {
                  <span class="rail-reason">{{ step.reason }}</span>
                }
              </span>
            </button>
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [
    `
      .rail-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .rail-button {
        display: flex;
        gap: 0.5rem;
        width: 100%;
        text-align: left;
        border: 1px solid transparent;
        border-left: 3px solid transparent;
        background: transparent;
        padding: 0.5rem;
        border-radius: 4px;
      }

      .rail-button.is-answered:not(.is-current) .rail-number {
        color: var(--color-success);
      }

      .rail-button.is-current {
        background: var(--color-bg);
        border-color: var(--color-border);
        border-left-color: #1a1a1a;
      }

      .rail-number {
        min-width: 1.25rem;
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        padding-top: 0.125rem;
      }

      .rail-body {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        min-width: 0;
      }

      .rail-prompt {
        font-size: 0.875rem;
        line-height: 1.35;
      }

      .rail-button.is-current .rail-prompt {
        font-weight: 600;
      }

      .rail-meta {
        display: flex;
        gap: 0.375rem;
        align-items: center;
      }

      .rail-state {
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-secondary);
      }

      .rail-tag {
        font-size: 0.6875rem;
        color: var(--color-info);
        border: 1px solid currentColor;
        border-radius: 999px;
        padding: 0 0.375rem;
      }

      .rail-reason {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        line-height: 1.35;
      }
    `,
  ],
})
export class StepRailComponent {
  @Input() steps: RailStep[] = [];
  @Output() select = new EventEmitter<number>();

  stateLabel(step: RailStep): string {
    if (step.status === 'current') {
      return 'Current';
    }

    return step.answered ? 'Answered' : 'Pending';
  }
}
