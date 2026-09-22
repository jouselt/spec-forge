import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuestionPanelComponent } from './question-panel.component';
import { Question } from '../../core/question-graph';

function question(kind: Question['kind'], overrides: Partial<Question> = {}): Question {
  return {
    id: `q.${kind}`,
    step: 1,
    prompt: 'The prompt',
    help: 'The help line',
    kind,
    required: true,
    ...overrides,
  };
}

describe('QuestionPanelComponent', () => {
  let fixture: ComponentFixture<QuestionPanelComponent>;
  let component: QuestionPanelComponent;
  let values: string[];
  let nextCount: number;
  let backCount: number;

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(selector: string): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLButtonElement | null;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [QuestionPanelComponent] }).compileComponents();

    fixture = TestBed.createComponent(QuestionPanelComponent);
    component = fixture.componentInstance;
    values = [];
    nextCount = 0;
    backCount = 0;
    component.valueChange.subscribe((value) => values.push(value));
    component.next.subscribe(() => (nextCount += 1));
    component.back.subscribe(() => (backCount += 1));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should say so when no question is selected', () => {
    expect(text()).toContain('No question selected.');
  });

  it('should show the prompt, the help line and the position', () => {
    fixture.componentRef.setInput('question', question('longtext'));
    fixture.componentRef.setInput('index', 1);
    fixture.componentRef.setInput('total', 9);
    fixture.detectChanges();

    expect(text()).toContain('The prompt');
    expect(text()).toContain('The help line');
    expect(text()).toContain('Question 2 of 9');
  });

  it('should show the reason for an adaptive question', () => {
    fixture.componentRef.setInput('question', question('text', { id: 'a.ctx_window' }));
    fixture.componentRef.setInput('reason', 'Asked because you mentioned ollama in step 7');
    fixture.detectChanges();

    expect(text()).toContain('Asked because you mentioned ollama in step 7');
  });

  it('should show the validation message', () => {
    fixture.componentRef.setInput('question', question('text'));
    fixture.componentRef.setInput('error', 'Answer must be at least 12 characters.');
    fixture.detectChanges();

    expect(text()).toContain('Answer must be at least 12 characters.');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  describe('controls per question kind', () => {
    const cases: { kind: Question['kind']; selector: string }[] = [
      { kind: 'text', selector: 'app-text-control' },
      { kind: 'longtext', selector: 'app-longtext-control' },
      { kind: 'number', selector: 'app-number-control' },
      { kind: 'choice', selector: 'app-choice-control' },
      { kind: 'list', selector: 'app-list-control' },
      { kind: 'table', selector: 'app-table-control' },
    ];

    for (const { kind, selector } of cases) {
      it(`should render the ${kind} control`, () => {
        fixture.componentRef.setInput('question', question(kind));
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector(selector)).not.toBeNull();
      });
    }
  });

  it('should pass the typed value up from the control', () => {
    fixture.componentRef.setInput('question', question('text'));
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'loads in under 2s';
    input.dispatchEvent(new Event('input'));

    expect(values).toEqual(['loads in under 2s']);
  });

  describe('navigation', () => {
    it('should emit next when the answer may advance', () => {
      fixture.componentRef.setInput('question', question('text'));
      fixture.componentRef.setInput('canAdvance', true);
      fixture.detectChanges();

      button('.panel-next')?.click();

      expect(nextCount).toBe(1);
    });

    it('should disable next while the answer is rejected', () => {
      fixture.componentRef.setInput('question', question('text'));
      fixture.componentRef.setInput('canAdvance', false);
      fixture.detectChanges();

      expect(button('.panel-next')?.disabled).toBe(true);
    });

    it('should replace next with a closing line on the last question', () => {
      fixture.componentRef.setInput('question', question('text'));
      fixture.componentRef.setInput('isLast', true);
      fixture.detectChanges();

      expect(button('.panel-next')).toBeNull();
      expect(text()).toContain('That is the last question.');
    });

    it('should emit back and disable it on the first question', () => {
      fixture.componentRef.setInput('question', question('text'));
      fixture.componentRef.setInput('isFirst', true);
      fixture.detectChanges();

      expect(button('.panel-back')?.disabled).toBe(true);

      fixture.componentRef.setInput('isFirst', false);
      fixture.detectChanges();
      button('.panel-back')?.click();

      expect(backCount).toBe(1);
    });
  });
});
