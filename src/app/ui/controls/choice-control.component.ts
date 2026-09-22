import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Question } from '../../core/question-graph';
import { choiceOptions } from './value-model';

/**
 * Choice answer. Candidate options are parsed out of the question help; when
 * the help names no options the control is a plain text input. A text input
 * stays available either way, so a visitor is never stuck with a short list.
 */
@Component({
  selector: 'app-choice-control',
  standalone: true,
  template: `
    @if (options.length > 0) {
      <label class="control-label" [attr.for]="selectId">Choose one</label>
      <select class="control-select" [id]="selectId" [value]="selectedOption" (change)="onSelect($event)">
        <option value="">Select an option</option>
        @for (option of options; track option) {
          <option [value]="option" [selected]="option === selectedOption">{{ option }}</option>
        }
      </select>
    }

    <label class="control-label" [attr.for]="inputId">Or type your own answer</label>
    <input
      type="text"
      class="control-input"
      [id]="inputId"
      [value]="customText"
      (input)="onInput($event)"
    />
  `,
  styles: [
    `
      .control-label {
        display: block;
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
        margin: 0.5rem 0 0.25rem;
      }

      .control-select,
      .control-input {
        width: 100%;
        max-width: 24rem;
        display: block;
      }
    `,
  ],
})
export class ChoiceControlComponent {
  @Input() value = '';
  @Input() question: Question | null = null;
  @Output() valueChange = new EventEmitter<string>();

  get options(): string[] {
    return choiceOptions(this.question);
  }

  get selectId(): string {
    return `${this.question?.id ?? 'choice'}-select`;
  }

  get inputId(): string {
    return `${this.question?.id ?? 'choice'}-custom`;
  }

  /** The select shows the stored value only when it is one of the options. */
  get selectedOption(): string {
    return this.options.includes(this.value) ? this.value : '';
  }

  /** The text input holds anything that is not one of the options. */
  get customText(): string {
    return this.options.includes(this.value) ? '' : this.value;
  }

  onSelect(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
