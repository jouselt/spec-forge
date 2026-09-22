import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Question } from '../../core/question-graph';
import { parseList, serializeList } from './value-model';

/** List answer: one input per item, stored newline separated. */
@Component({
  selector: 'app-list-control',
  standalone: true,
  template: `
    <div class="list-control">
      @for (item of items; track $index) {
        <div class="list-row">
          <input
            type="text"
            class="list-input"
            [attr.aria-label]="'Item ' + ($index + 1)"
            [value]="item"
            (input)="updateItem($index, $event)"
          />
          <button type="button" class="list-remove" (click)="removeItem($index)">Remove</button>
        </div>
      }
      <button type="button" class="list-add" (click)="addItem()">Add item</button>
    </div>
  `,
  styles: [
    `
      .list-control {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-width: 40rem;
      }

      .list-row {
        display: flex;
        gap: 0.5rem;
      }

      .list-input {
        flex: 1;
        min-width: 0;
      }

      .list-add {
        align-self: flex-start;
      }
    `,
  ],
})
export class ListControlComponent {
  @Input() value = '';
  @Input() question: Question | null = null;
  @Output() valueChange = new EventEmitter<string>();

  get items(): string[] {
    return parseList(this.value);
  }

  updateItem(index: number, event: Event): void {
    const items = [...this.items];
    items[index] = (event.target as HTMLInputElement).value;
    this.valueChange.emit(serializeList(items));
  }

  addItem(): void {
    this.valueChange.emit(serializeList([...this.items, '']));
  }

  removeItem(index: number): void {
    const items = this.items.filter((_, position) => position !== index);
    this.valueChange.emit(serializeList(items.length > 0 ? items : ['']));
  }
}
