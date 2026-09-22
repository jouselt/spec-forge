import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { WizardStore } from './state/wizard-store.service';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let store: WizardStore;

  function panel(): HTMLElement {
    return fixture.nativeElement.querySelector('app-question-panel') as HTMLElement;
  }

  function railButtons(): HTMLButtonElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.rail-button') as NodeListOf<HTMLButtonElement>,
    );
  }

  function nextButton(): HTMLButtonElement {
    return panel().querySelector('.panel-next') as HTMLButtonElement;
  }

  function backButton(): HTMLButtonElement {
    return panel().querySelector('.panel-back') as HTMLButtonElement;
  }

  /** Type into whichever control the current question kind renders. */
  function fill(text: string): void {
    const control = panel().querySelector(
      'textarea, .table-cell, .list-input, input',
    ) as HTMLInputElement | HTMLTextAreaElement;
    control.value = text;
    control.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function clickNext(): void {
    nextButton().click();
    fixture.detectChanges();
  }

  /**
   * A valid answer for the kind of control that renders. A number input rejects
   * text, so a numeric question needs a numeric answer to keep the answer stored.
   */
  function answerFor(question: { id: string; kind: string }): string {
    if (question.id === 'q.stack') {
      return 'Ollama on device, PostgreSQL, Docker';
    }

    return question.kind === 'number' ? '16' : 'loads in under 2s';
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AppComponent] }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(WizardStore);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have title property', () => {
    expect(component.title).toBe('spec-forge');
  });

  it('should render the nine base questions in the rail in order', () => {
    const ids = railButtons().map((button) => button.getAttribute('data-step-id'));

    expect(ids).toEqual([
      'q.idea',
      'q.problem',
      'q.workaround',
      'q.goal',
      'q.proof',
      'q.constraints',
      'q.stack',
      'q.scope_out',
      'q.risk',
    ]);
  });

  it('should mark the first question as the current one', () => {
    const buttons = railButtons();

    expect(buttons[0].getAttribute('aria-current')).toBe('step');
    expect(buttons[0].textContent).toContain('Current');
    expect(buttons[1].textContent).toContain('Pending');
  });

  it('should open on the first question', () => {
    expect(panel().textContent).toContain('What is the idea? One paragraph.');
    expect(panel().textContent).toContain('Question 1 of 9');
  });

  it('should count the answered questions', () => {
    const progress = (): string =>
      (fixture.nativeElement.querySelector('.progress') as HTMLElement).textContent ?? '';

    expect(progress()).toContain('0 of 9 answered');

    fill('A wizard that interviews you first.');

    expect(progress()).toContain('1 of 9 answered');
  });

  it('should accept typing on every question kind', () => {
    const kinds = new Set<string>();

    // Ollama in the stack answer fires the number and choice follow-ups, so a
    // single walk over the list touches all six kinds.
    for (let guard = 0; guard < 20 && !store.isLast(); guard += 1) {
      const question = store.current();
      expect(question).not.toBeNull();
      kinds.add(question!.kind);
      fill(answerFor(question!));
      clickNext();
    }
    kinds.add(store.current()!.kind);

    expect(Array.from(kinds).sort()).toEqual([
      'choice',
      'list',
      'longtext',
      'number',
      'table',
      'text',
    ]);
    // The walk stops on the last question, which is left for the visitor to answer.
    expect(panel().textContent).toContain('That is the last question.');
    expect(store.answeredCount()).toBe(store.total() - 1);
  });

  it('should reject a vague proof and accept a measurable one', () => {
    store.jumpToQuestion('q.proof');
    fixture.detectChanges();

    fill('it works');

    expect(nextButton().disabled).toBe(true);
    expect(panel().textContent).toContain('Name a number, a unit, or an observable behavior.');

    fill('loads in under 2s');

    expect(nextButton().disabled).toBe(false);
    expect(panel().textContent).not.toContain('Name a number, a unit');
  });

  it('should add the follow-ups right after the question that mentioned ollama', () => {
    store.jumpToQuestion('q.stack');
    fixture.detectChanges();

    fill('Ollama on device, PostgreSQL, Docker');

    const ids = railButtons().map((button) => button.getAttribute('data-step-id'));
    expect(ids.slice(6, 10)).toEqual(['q.stack', 'a.ctx_window', 'a.vram_gb', 'a.wasm_fallback']);
    expect(store.total()).toBe(12);

    clickNext();

    expect(panel().textContent).toContain('What is the model context window');
    expect(panel().textContent).toContain('Asked because you mentioned ollama in step 7');
  });

  it('should show a follow-up reason in the rail', () => {
    store.jumpToQuestion('q.stack');
    fixture.detectChanges();
    fill('Ollama on device, PostgreSQL, Docker');

    const reason = fixture.nativeElement.querySelector('.rail-reason') as HTMLElement;

    expect(reason.textContent).toContain('Asked because you mentioned ollama in step 7');
  });

  it('should go back and jump from the rail', () => {
    fill('A wizard that interviews you first.');
    clickNext();

    expect(store.current()?.id).toBe('q.problem');

    backButton().click();
    fixture.detectChanges();

    expect(store.current()?.id).toBe('q.idea');

    railButtons()[4].click();
    fixture.detectChanges();

    expect(store.current()?.id).toBe('q.proof');
    expect(panel().textContent).toContain('Question 5 of 9');
  });

  it('should keep the rail open on a wide viewport', () => {
    expect(component.railOpen()).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('#step-rail') as HTMLElement).classList.contains(
        'is-hidden',
      ),
    ).toBe(false);
  });

  it('should collapse and reveal the rail from the toggle', () => {
    const toggle = fixture.nativeElement.querySelector('.rail-toggle') as HTMLButtonElement;
    const aside = fixture.nativeElement.querySelector('#step-rail') as HTMLElement;
    const wasHidden = aside.classList.contains('is-hidden');

    toggle.click();
    fixture.detectChanges();

    expect(aside.classList.contains('is-hidden')).toBe(!wasHidden);
    expect(toggle.getAttribute('aria-expanded')).toBe(String(wasHidden));
  });
});
