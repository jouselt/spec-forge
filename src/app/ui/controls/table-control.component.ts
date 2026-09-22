import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Question } from '../../core/question-graph';
import { emptyRow, parseTable, serializeTable, TableRow } from './value-model';

/**
 * Table answer: two columns, one row per line when stored. The separator is the
 * ` | ` that the help text uses when it describes the constraint table.
 */
@Component({
  selector: 'app-table-control',
  standalone: true,
  template: `
    <div class="table-control">
      <div class="table-head">
        <span>Constraint</span>
        <span>Target</span>
      </div>
      @for (row of rows; track $index) {
        <div class="table-row">
          <input
            type="text"
            class="table-cell"
            [attr.aria-label]="'Row ' + ($index + 1) + ' constraint'"
            [value]="row.label"
            (input)="updateLabel($index, $event)"
          />
          <input
            type="text"
            class="table-cell"
            [attr.aria-label]="'Row ' + ($index + 1) + ' target'"
            [value]="row.value"
            (input)="updateValue($index, $event)"
          />
          <button type="button" class="table-remove" (click)="removeRow($index)">Remove</button>
        </div>
      }
      <button type="button" class="table-add" (click)="addRow()">Add row</button>
    </div>
  `,
  styles: [
    `
      .table-control {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-width: 44rem;
      }

      .table-head,
      .table-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .table-head span {
        flex: 1;
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
      }

      .table-head::after {
        content: '';
        width: 4.5rem;
      }

      .table-cell {
        flex: 1;
        min-width: 0;
      }

      .table-add {
        align-self: flex-start;
      }
    `,
  ],
})
export class TableControlComponent {
  @Input() value = '';
  @Input() question: Question | null = null;
  @Output() valueChange = new EventEmitter<string>();

  get rows(): TableRow[] {
    return parseTable(this.value);
  }

  updateLabel(index: number, event: Event): void {
    this.updateRow(index, { label: (event.target as HTMLInputElement).value });
  }

  updateValue(index: number, event: Event): void {
    this.updateRow(index, { value: (event.target as HTMLInputElement).value });
  }

  addRow(): void {
    this.valueChange.emit(serializeTable([...this.rows, emptyRow()]));
  }

  removeRow(index: number): void {
    const rows = this.rows.filter((_, position) => position !== index);
    this.valueChange.emit(serializeTable(rows.length > 0 ? rows : [emptyRow()]));
  }

  private updateRow(index: number, patch: Partial<TableRow>): void {
    const rows = this.rows.map((row, position) =>
      position === index ? { ...row, ...patch } : row,
    );
    this.valueChange.emit(serializeTable(rows));
  }
}
