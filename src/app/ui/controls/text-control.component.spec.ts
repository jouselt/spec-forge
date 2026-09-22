import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextControlComponent } from './text-control.component';
import { Question } from '../../core/question-graph';

describe('TextControlComponent', () => {
  const question: Question = {
    id: 'q.proof',
    step: 5,
    prompt: 'What proves it worked?',
    kind: 'text',
    required: true,
  };

  let fixture: ComponentFixture<TextControlComponent>;
  let component: TextControlComponent;
  let emitted: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TextControlComponent] }).compileComponents();

    fixture = TestBed.createComponent(TextControlComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.valueChange.subscribe((value) => emitted.push(value));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the stored answer', () => {
    fixture.componentRef.setInput('value', 'loads in under 2s');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.value).toBe('loads in under 2s');
  });

  it('should emit what the visitor types', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'loads in under 2s';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['loads in under 2s']);
  });

  it('should label the input with the question prompt', () => {
    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('What proves it worked?');
  });

  it('should fall back to a generic label without a question', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(input.getAttribute('aria-label')).toBe('Answer');
  });
});
