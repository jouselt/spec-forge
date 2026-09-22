import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepStepperComponent } from './step-stepper.component';
import { RailStep } from '../../state/wizard-store.service';
import { Question } from '../../core/question-graph';

function baseQuestion(id: string, prompt: string): Question {
  return { id, step: 1, prompt, kind: 'text', required: true };
}

function step(index: number, id: string, overrides: Partial<RailStep> = {}): RailStep {
  return {
    index,
    question: baseQuestion(id, `Prompt for ${id}`),
    status: 'pending',
    answered: false,
    reason: null,
    ...overrides,
  };
}

describe('StepStepperComponent', () => {
  let fixture: ComponentFixture<StepStepperComponent>;
  let component: StepStepperComponent;

  function segments(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.stepper-segment') as NodeListOf<HTMLElement>,
    );
  }

  function count(): string {
    return (fixture.nativeElement.querySelector('.stepper-count') as HTMLElement).textContent?.trim() ?? '';
  }

  const steps: RailStep[] = [
    step(0, 'q.idea', { status: 'answered', answered: true }),
    step(1, 'q.problem', { status: 'current' }),
    step(2, 'q.workaround'),
    step(3, 'a.ctx_window', { question: { ...baseQuestion('a.ctx_window', 'Context window?'), adaptive: { triggerId: 'local_model', priority: 1 } } }),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StepStepperComponent] }).compileComponents();

    fixture = TestBed.createComponent(StepStepperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render no segment and a zero count without steps', () => {
    expect(segments().length).toBe(0);
    expect(count()).toBe('0 out of 0');
  });

  it('should render one segment per question in order', () => {
    fixture.componentRef.setInput('steps', steps);
    fixture.detectChanges();

    expect(segments().length).toBe(4);
    expect(segments().map((segment) => segment.getAttribute('data-step-id'))).toEqual([
      'q.idea',
      'q.problem',
      'q.workaround',
      'a.ctx_window',
    ]);
  });

  it('should mark the answered, current and pending segments', () => {
    fixture.componentRef.setInput('steps', steps);
    fixture.detectChanges();

    const [answered, current, pending] = segments();

    expect(answered.classList.contains('is-answered')).toBe(true);
    expect(answered.classList.contains('is-current')).toBe(false);
    expect(current.classList.contains('is-current')).toBe(true);
    expect(current.classList.contains('is-answered')).toBe(false);
    expect(pending.classList.contains('is-current')).toBe(false);
    expect(pending.classList.contains('is-answered')).toBe(false);
  });

  it('should count the current position from one', () => {
    fixture.componentRef.setInput('steps', steps);
    fixture.detectChanges();

    expect(count()).toBe('2 out of 4');
    expect(component.position).toBe(2);
  });

  it('should let the current state win over answered', () => {
    fixture.componentRef.setInput('steps', [
      step(0, 'q.idea', { status: 'current', answered: true }),
      step(1, 'q.problem'),
    ]);
    fixture.detectChanges();

    expect(segments()[0].classList.contains('is-current')).toBe(true);
    expect(segments()[0].classList.contains('is-answered')).toBe(true);
    expect(component.position).toBe(1);
  });

  it('should add a segment and raise the total when a follow-up is inserted', () => {
    fixture.componentRef.setInput('steps', [step(0, 'q.idea', { status: 'current' })]);
    fixture.detectChanges();

    expect(segments().length).toBe(1);
    expect(count()).toBe('1 out of 1');

    fixture.componentRef.setInput('steps', [
      step(0, 'q.idea', { status: 'answered', answered: true }),
      step(1, 'q.stack', { status: 'current', answered: true }),
      step(2, 'a.ctx_window'),
      step(3, 'a.vram_gb'),
    ]);
    fixture.detectChanges();

    expect(segments().length).toBe(4);
    expect(count()).toBe('2 out of 4');
  });

  it('should keep the segment row decorative while the count carries the position', () => {
    fixture.componentRef.setInput('steps', steps);
    fixture.detectChanges();

    const track = fixture.nativeElement.querySelector('.stepper-track') as HTMLElement;

    expect(track.getAttribute('aria-hidden')).toBe('true');
    expect((fixture.nativeElement.querySelector('footer') as HTMLElement).getAttribute('aria-label')).toBe(
      'Interview progress',
    );
  });
});
