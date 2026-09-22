import { Component, Input } from '@angular/core';
import { RailStep } from '../../state/wizard-store.service';

/**
 * The bottom bar: one thin segment per question, in order, plus the position as
 * text. It exists so a visitor can read where they are without opening the rail,
 * which is collapsed by default on a phone.
 *
 * The segments come from the same rail list the store derives, so an adaptive
 * follow-up inserted mid-interview adds a segment and raises the total at once,
 * and there is no second copy of the question list to keep in sync.
 *
 * Presentational: the parent passes the rail. The position is read off the
 * segment the store marked current, which is the same value the rail highlights.
 */
@Component({
  selector: 'app-step-stepper',
  standalone: true,
  template: `
    <footer class="stepper-footer" aria-label="Interview progress">
      <!-- The count line states the position in words, so the segment row is
           decoration to a screen reader rather than a second reading of it. -->
      <div class="stepper-track" aria-hidden="true">
        @for (step of steps; track step.question.id) {
          <span
            class="stepper-segment"
            [class.is-answered]="step.answered"
            [class.is-current]="step.status === 'current'"
            [attr.data-step-id]="step.question.id"
          ></span>
        }
      </div>

      <p class="stepper-count">{{ position }} out of {{ steps.length }}</p>
    </footer>
  `,
  styles: [
    `
      .stepper-footer {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        padding: 0.625rem 1rem 0.75rem;
        background: var(--color-bg);
        border-top: 1px solid var(--color-border);
      }

      /* A flex row with no minimum width, so the segments share whatever the
         viewport gives them and twelve of them still fit at 390px. */
      .stepper-track {
        display: flex;
        gap: 3px;
        height: 6px;
      }

      .stepper-segment {
        flex: 1 1 0;
        min-width: 0;
        border-radius: 3px;
        background: #d8d8d8;
      }

      .stepper-segment.is-answered {
        background: var(--color-success);
      }

      /* The current question wins over answered, matching the rail. */
      .stepper-segment.is-current {
        background: #1a1a1a;
      }

      .stepper-count {
        margin: 0;
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        text-align: center;
      }
    `,
  ],
})
export class StepStepperComponent {
  @Input() steps: RailStep[] = [];

  /** 1-based position of the current question, or 0 while the list is empty. */
  get position(): number {
    const index = this.steps.findIndex((step) => step.status === 'current');

    return index < 0 ? 0 : index + 1;
  }
}
