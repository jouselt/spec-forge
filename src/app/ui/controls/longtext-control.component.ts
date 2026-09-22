import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Question } from '../../core/question-graph';

/** Multi line answer for the paragraph questions. */
@Component({
  selector: 'app-longtext-control',
  standalone: true,
  template: `
    <textarea
      class="control-input"
      rows="6"
      [attr.aria-label]="question?.prompt ?? 'Answer'"
      [value]="value"
      (input)="onInput($event)"
    ></textarea>
  `,
  styles: [
    `
      .control-input {
        width: 100%;
        max-width: 44rem;
        resize: vertical;
        line-height: 1.5;
      }
    `,
  ],
})
export class LongtextControlComponent {
  @Input() value = '';
  @Input() question: Question | null = null;
  @Output() valueChange = new EventEmitter<string>();

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLTextAreaElement).value);
  }
}
