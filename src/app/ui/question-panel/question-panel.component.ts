import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Question } from '../../core/question-graph';
import { ChoiceControlComponent } from '../controls/choice-control.component';
import { ListControlComponent } from '../controls/list-control.component';
import { LongtextControlComponent } from '../controls/longtext-control.component';
import { NumberControlComponent } from '../controls/number-control.component';
import { TableControlComponent } from '../controls/table-control.component';
import { TextControlComponent } from '../controls/text-control.component';

/**
 * The panel for one question: the prompt, the help line, the reason when the
 * question is a follow-up, the control for the question kind, the validation
 * message, and the navigation. It holds no state of its own; the store is the
 * single source of truth and the parent wires the inputs and outputs together.
 */
@Component({
  selector: 'app-question-panel',
  standalone: true,
  imports: [
    TextControlComponent,
    LongtextControlComponent,
    NumberControlComponent,
    ChoiceControlComponent,
    ListControlComponent,
    TableControlComponent,
  ],
  template: `
    @if (question; as q) {
      <article class="panel">
        <p class="panel-progress">Question {{ index + 1 }} of {{ total }}</p>
        <h2 class="panel-prompt">{{ q.prompt }}</h2>

        @if (q.help) {
          <p class="panel-help">{{ q.help }}</p>
        }

        @if (reason) {
          <p class="panel-reason">{{ reason }}</p>
        }

        <div class="panel-control">
          @switch (q.kind) {
            @case ('text') {
              <app-text-control
                [question]="q"
                [value]="value"
                (valueChange)="valueChange.emit($event)"
              />
            }
            @case ('longtext') {
              <app-longtext-control
                [question]="q"
                [value]="value"
                (valueChange)="valueChange.emit($event)"
              />
            }
            @case ('number') {
              <app-number-control
                [question]="q"
                [value]="value"
                (valueChange)="valueChange.emit($event)"
              />
            }
            @case ('choice') {
              <app-choice-control
                [question]="q"
                [value]="value"
                (valueChange)="valueChange.emit($event)"
              />
            }
            @case ('list') {
              <app-list-control
                [question]="q"
                [value]="value"
                (valueChange)="valueChange.emit($event)"
              />
            }
            @case ('table') {
              <app-table-control
                [question]="q"
                [value]="value"
                (valueChange)="valueChange.emit($event)"
              />
            }
          }
        </div>

        @if (error) {
          <p class="panel-error" role="alert">{{ error }}</p>
        }

        <div class="panel-nav">
          <button type="button" class="panel-back" [disabled]="isFirst" (click)="back.emit()">
            Back
          </button>
          @if (!isLast) {
            <button type="button" class="panel-next" [disabled]="!canAdvance" (click)="next.emit()">
              Next
            </button>
          } @else {
            <span class="panel-end">That is the last question.</span>
          }
        </div>
      </article>
    } @else {
      <p class="panel-empty">No question selected.</p>
    }
  `,
  styles: [
    `
      .panel {
        display: flex;
        flex-direction: column;
        max-width: 48rem;
      }

      .panel-progress {
        margin: 0 0 0.5rem;
        font-size: 0.8125rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-secondary);
      }

      .panel-prompt {
        margin: 0 0 0.5rem;
        font-size: 1.375rem;
        line-height: 1.3;
      }

      .panel-help {
        margin: 0 0 1rem;
        color: var(--color-text-secondary);
        line-height: 1.5;
      }

      .panel-reason {
        margin: 0 0 1rem;
        padding: 0.5rem 0.75rem;
        background: #eef4fd;
        border-left: 3px solid var(--color-info);
        color: var(--color-fg);
        font-size: 0.875rem;
      }

      .panel-control {
        margin-bottom: 1rem;
      }

      .panel-error {
        margin: 0 0 1rem;
        color: var(--color-error);
        font-size: 0.875rem;
      }

      .panel-nav {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding-top: 1rem;
        border-top: 1px solid var(--color-border);
      }

      .panel-next {
        background: #1a1a1a;
        color: #fff;
        border-color: #1a1a1a;
      }

      .panel-next:hover:not(:disabled) {
        background: #333;
        border-color: #333;
      }

      .panel-end {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class QuestionPanelComponent {
  @Input() question: Question | null = null;
  @Input() value = '';
  @Input() error: string | null = null;
  @Input() reason: string | null = null;
  @Input() index = 0;
  @Input() total = 0;
  @Input() canAdvance = false;
  @Input() isFirst = false;
  @Input() isLast = false;
  @Output() valueChange = new EventEmitter<string>();
  @Output() next = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
}
