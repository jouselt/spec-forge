import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableControlComponent } from './table-control.component';

describe('TableControlComponent', () => {
  let fixture: ComponentFixture<TableControlComponent>;
  let component: TableControlComponent;
  let emitted: string[];

  function cells(): HTMLInputElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>);
  }

  function click(selector: string): void {
    (fixture.nativeElement.querySelector(selector) as HTMLButtonElement).click();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TableControlComponent] }).compileComponents();

    fixture = TestBed.createComponent(TableControlComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.valueChange.subscribe((value) => emitted.push(value));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with one empty row and the two column labels', () => {
    expect(cells().length).toBe(2);
    const head = fixture.nativeElement.querySelector('.table-head') as HTMLElement;
    expect(head.textContent).toContain('Constraint');
    expect(head.textContent).toContain('Target');
  });

  it('should render one row per stored line', () => {
    fixture.componentRef.setInput('value', 'P99 latency | 100ms\nPeak throughput | 10K qps');
    fixture.detectChanges();

    expect(cells().map((input) => input.value)).toEqual([
      'P99 latency',
      '100ms',
      'Peak throughput',
      '10K qps',
    ]);
  });

  it('should emit the edited target in place', () => {
    fixture.componentRef.setInput('value', 'P99 latency | 100ms');
    fixture.detectChanges();

    const target = cells()[1];
    target.value = '250ms';
    target.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['P99 latency | 250ms']);
  });

  it('should emit the edited constraint in place', () => {
    fixture.componentRef.setInput('value', 'P99 latency | 100ms');
    fixture.detectChanges();

    const label = cells()[0];
    label.value = 'P95 latency';
    label.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['P95 latency | 100ms']);
  });

  it('should append an empty row on add', () => {
    fixture.componentRef.setInput('value', 'P99 latency | 100ms');
    fixture.detectChanges();

    click('.table-add');

    expect(emitted).toEqual(['P99 latency | 100ms\n | ']);
  });

  it('should drop the removed row', () => {
    fixture.componentRef.setInput('value', 'P99 latency | 100ms\nBudget | $0');
    fixture.detectChanges();

    click('.table-remove');

    expect(emitted).toEqual(['Budget | $0']);
  });

  it('should keep one empty row when the last row is removed', () => {
    click('.table-remove');

    expect(emitted).toEqual([' | ']);
  });
});
