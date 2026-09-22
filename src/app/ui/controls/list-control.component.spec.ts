import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListControlComponent } from './list-control.component';

describe('ListControlComponent', () => {
  let fixture: ComponentFixture<ListControlComponent>;
  let component: ListControlComponent;
  let emitted: string[];

  function rows(): HTMLInputElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>);
  }

  function click(selector: string): void {
    (fixture.nativeElement.querySelector(selector) as HTMLButtonElement).click();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ListControlComponent] }).compileComponents();

    fixture = TestBed.createComponent(ListControlComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.valueChange.subscribe((value) => emitted.push(value));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with one empty row', () => {
    expect(rows().length).toBe(1);
    expect(rows()[0].value).toBe('');
  });

  it('should render one input per stored item', () => {
    fixture.componentRef.setInput('value', 'Angular 20\nNode.js\nPostgreSQL');
    fixture.detectChanges();

    expect(rows().map((input) => input.value)).toEqual(['Angular 20', 'Node.js', 'PostgreSQL']);
  });

  it('should emit the edited item in place', () => {
    fixture.componentRef.setInput('value', 'Angular 20\nNode.js\nPostgreSQL');
    fixture.detectChanges();

    const second = rows()[1];
    second.value = 'NestJS';
    second.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['Angular 20\nNestJS\nPostgreSQL']);
  });

  it('should append an empty row on add', () => {
    fixture.componentRef.setInput('value', 'Docker');
    fixture.detectChanges();

    click('.list-add');

    expect(emitted).toEqual(['Docker\n']);
  });

  it('should drop the removed row', () => {
    fixture.componentRef.setInput('value', 'Docker\nKubernetes');
    fixture.detectChanges();

    click('.list-remove');

    expect(emitted).toEqual(['Kubernetes']);
  });

  it('should keep one empty row when the last row is removed', () => {
    click('.list-remove');

    expect(emitted).toEqual(['']);
  });
});
