import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Question } from '../../core/question-graph';

/**
 * Numeric answer. The value stays a string because `Answer.text` is a string;
 * the free text helpers on the question are what reject non numbers.
 */
@Component({
  selector: 'app-number-control',
  standalone: true,
  template: `
    <input
      type="number"
      class="control-input"
      inputmode="decimal"
      [attr.aria-label]="question?.prompt ?? 'Answer'"
      [value]="value"
      (input)="onInput($event)"
    />
  `,
  styles: [
    `
      .control-input {
        width: 100%;
        max-width: 14rem;
      }
    `,
  ],
})
export class NumberControlComponent {
  @Input() value = '';
  @Input() question: Question | null = null;
  @Output() valueChange = new EventEmitter<string>();

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
