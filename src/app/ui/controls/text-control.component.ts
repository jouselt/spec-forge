import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Question } from '../../core/question-graph';

/** Single line text answer. */
@Component({
  selector: 'app-text-control',
  standalone: true,
  template: `
    <input
      type="text"
      class="control-input"
      [attr.aria-label]="question?.prompt ?? 'Answer'"
      [value]="value"
      (input)="onInput($event)"
    />
  `,
  styles: [
    `
      .control-input {
        width: 100%;
        max-width: 40rem;
      }
    `,
  ],
})
export class TextControlComponent {
  @Input() value = '';
  @Input() question: Question | null = null;
  @Output() valueChange = new EventEmitter<string>();

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
