import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepRailComponent } from './step-rail.component';
import { RailStep } from '../../state/wizard-store.service';
import { Question } from '../../core/question-graph';

function baseQuestion(id: string, prompt: string): Question {
  return { id, step: 1, prompt, kind: 'text', required: true };
}

function adaptiveQuestion(id: string, prompt: string): Question {
  return {
    id,
    step: 7.0769,
    prompt,
    kind: 'text',
    required: false,
    adaptive: { triggerId: 'local_model', priority: 1 },
  };
}

describe('StepRailComponent', () => {
  let fixture: ComponentFixture<StepRailComponent>;
  let component: StepRailComponent;
  let selected: number[];

  const steps: RailStep[] = [
    {
      index: 0,
      question: baseQuestion('q.idea', 'What is the idea?'),
      status: 'answered',
      answered: true,
      reason: null,
    },
    {
      index: 1,
      question: baseQuestion('q.problem', 'What problem does it solve?'),
      status: 'current',
      answered: false,
      reason: null,
    },
    {
      index: 2,
      question: baseQuestion('q.scope_out', 'What is out of scope?'),
      status: 'pending',
      answered: false,
      reason: null,
    },
    {
      index: 3,
      question: adaptiveQuestion('a.ctx_window', 'Context window?'),
      status: 'pending',
      answered: false,
      reason: 'Asked because you mentioned ollama in step 7',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StepRailComponent] }).compileComponents();

    fixture = TestBed.createComponent(StepRailComponent);
    component = fixture.componentInstance;
    selected = [];
    component.select.subscribe((index) => selected.push(index));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render no item without steps', () => {
    expect(fixture.nativeElement.querySelectorAll('.rail-button').length).toBe(0);
  });

  it('should render every question in order with its number', () => {
    fixture.componentRef.setInput('steps', steps);
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.rail-button') as NodeListOf<HTMLButtonElement>,
    );

    expect(buttons.length).toBe(4);
    expect(buttons.map((entry) => entry.getAttribute('data-step-id'))).toEqual([
      'q.idea',
      'q.problem',
      'q.scope_out',
      'a.ctx_window',
    ]);
    expect(buttons[1].textContent).toContain('2');
    expect(buttons[1].textContent).toContain('What problem does it solve?');
  });

  it('should mark the pending, current and answered states', () => {
    fixture.componentRef.setInput('steps', steps);
    fixture.detectChanges();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.rail-state') as NodeListOf<HTMLElement>,
    ).map((element) => element.textContent?.trim());

    expect(labels).toEqual(['Answered', 'Current', 'Pending', 'Pending']);

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.rail-button') as NodeListOf<HTMLButtonElement>,
    );
    expect(buttons[1].classList.contains('is-current')).toBe(true);
    expect(buttons[1].getAttribute('aria-current')).toBe('step');
    expect(buttons[0].classList.contains('is-answered')).toBe(true);
    expect(buttons[2].classList.contains('is-answered')).toBe(false);
    expect(buttons[2].getAttribute('aria-current')).toBeNull();
  });

  it('should tag an adaptive question and show its reason', () => {
    fixture.componentRef.setInput('steps', steps);
    fixture.detectChanges();

    const tag = fixture.nativeElement.querySelector('.rail-tag') as HTMLElement;
    const reason = fixture.nativeElement.querySelector('.rail-reason') as HTMLElement;

    expect(tag.textContent).toContain('Follow-up');
    expect(reason.textContent).toContain('Asked because you mentioned ollama in step 7');
  });

  it('should emit the step index on click', () => {
    fixture.componentRef.setInput('steps', steps);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.rail-button',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[2].click();

    expect(selected).toEqual([2]);
  });

  it('should label the states it is asked about', () => {
    expect(component.stateLabel(steps[0])).toBe('Answered');
    expect(component.stateLabel(steps[1])).toBe('Current');
    expect(component.stateLabel(steps[2])).toBe('Pending');
  });
});
