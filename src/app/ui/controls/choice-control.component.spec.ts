import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChoiceControlComponent } from './choice-control.component';
import { Question } from '../../core/question-graph';

describe('ChoiceControlComponent', () => {
  const question: Question = {
    id: 'a.wasm_fallback',
    step: 7.23,
    prompt: 'Is a WASM fallback acceptable if WebGPU is unavailable?',
    help: 'WASM is 5-20x slower but works everywhere. Yes or No.',
    kind: 'choice',
    required: false,
  };

  const proseQuestion: Question = {
    id: 'a.freeform',
    step: 7.5,
    prompt: 'Which build tool?',
    help: 'Name the tool you already use.',
    kind: 'choice',
    required: false,
  };

  let fixture: ComponentFixture<ChoiceControlComponent>;
  let component: ChoiceControlComponent;
  let emitted: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ChoiceControlComponent] }).compileComponents();

    fixture = TestBed.createComponent(ChoiceControlComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.valueChange.subscribe((value) => emitted.push(value));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should offer the options parsed from the help text', () => {
    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('select option') as NodeListOf<HTMLOptionElement>,
    ).map((option) => option.value);

    expect(options).toEqual(['', 'Yes', 'No']);
  });

  it('should emit the picked option', () => {
    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'No';
    select.dispatchEvent(new Event('change'));

    expect(emitted).toEqual(['No']);
  });

  it('should show the stored option as selected', () => {
    fixture.componentRef.setInput('question', question);
    fixture.componentRef.setInput('value', 'Yes');
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('Yes');
    expect(component.customText).toBe('');
  });

  it('should keep a custom answer in the text input', () => {
    fixture.componentRef.setInput('question', question);
    fixture.componentRef.setInput('value', 'Only on desktop');
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(select.value).toBe('');
    expect(input.value).toBe('Only on desktop');
  });

  it('should emit a typed custom answer', () => {
    fixture.componentRef.setInput('question', question);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'Only on desktop';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['Only on desktop']);
  });

  it('should fall back to a text input when the help names no options', () => {
    fixture.componentRef.setInput('question', proseQuestion);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    expect(fixture.nativeElement.querySelector('input')).not.toBeNull();
  });
});
