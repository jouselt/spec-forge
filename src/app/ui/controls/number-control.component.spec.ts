import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberControlComponent } from './number-control.component';
import { Question } from '../../core/question-graph';

describe('NumberControlComponent', () => {
  const question: Question = {
    id: 'a.vram_gb',
    step: 7.15,
    prompt: 'How much VRAM (GB) is available on your hardware?',
    kind: 'number',
    required: false,
  };

  let fixture: ComponentFixture<NumberControlComponent>;
  let component: NumberControlComponent;
  let emitted: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NumberControlComponent] }).compileComponents();

    fixture = TestBed.createComponent(NumberControlComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.valueChange.subscribe((value) => emitted.push(value));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a numeric input with the stored answer', () => {
    fixture.componentRef.setInput('value', '16');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.value).toBe('16');
  });

  it('should emit the typed number as text', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '32';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['32']);
  });

  it('should label the input with the question prompt', () => {
    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe(
      'How much VRAM (GB) is available on your hardware?',
    );
  });
});
