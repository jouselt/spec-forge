import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LongtextControlComponent } from './longtext-control.component';
import { Question } from '../../core/question-graph';

describe('LongtextControlComponent', () => {
  const question: Question = {
    id: 'q.idea',
    step: 1,
    prompt: 'What is the idea? One paragraph.',
    kind: 'longtext',
    required: true,
  };

  let fixture: ComponentFixture<LongtextControlComponent>;
  let component: LongtextControlComponent;
  let emitted: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LongtextControlComponent] }).compileComponents();

    fixture = TestBed.createComponent(LongtextControlComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.valueChange.subscribe((value) => emitted.push(value));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a multi line box with the stored answer', () => {
    fixture.componentRef.setInput('value', 'A wizard that interviews you first.');
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('A wizard that interviews you first.');
    expect(textarea.rows).toBe(6);
  });

  it('should emit a multi line answer without collapsing the lines', () => {
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'First line.\nSecond line.';
    textarea.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['First line.\nSecond line.']);
  });

  it('should label the box with the question prompt', () => {
    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.getAttribute('aria-label')).toBe('What is the idea? One paragraph.');
  });
});
