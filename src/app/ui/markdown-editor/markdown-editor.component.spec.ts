import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkdownEditorComponent } from './markdown-editor.component';

describe('MarkdownEditorComponent', () => {
  let fixture: ComponentFixture<MarkdownEditorComponent>;
  let component: MarkdownEditorComponent;
  let values: string[];

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function content(): HTMLElement {
    const element = host().querySelector('.cm-content');

    if (!element) {
      throw new Error('The editor has no CodeMirror content element');
    }

    return element as HTMLElement;
  }

  /** The document as the user sees it, one line per rendered line. */
  function text(): string {
    return Array.from(host().querySelectorAll('.cm-line'))
      .map((line) => line.textContent ?? '')
      .join('\n');
  }

  /** A real paste event into the editor DOM, the way a browser delivers one. */
  function paste(value: string): void {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    content().dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MarkdownEditorComponent] }).compileComponents();

    fixture = TestBed.createComponent(MarkdownEditorComponent);
    component = fixture.componentInstance;
    values = [];
    component.valueChange.subscribe((value) => values.push(value));
  });

  it('should create', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should render the value it is given', () => {
    fixture.componentRef.setInput('value', '# Title\n\nBody text.');
    fixture.detectChanges();

    expect(text()).toContain('# Title');
    expect(text()).toContain('Body text.');
  });

  it('should render a value that arrives after the editor exists', () => {
    fixture.componentRef.setInput('value', 'First draft.');
    fixture.detectChanges();
    expect(text()).toContain('First draft.');

    fixture.componentRef.setInput('value', 'Second draft.');
    fixture.detectChanges();

    expect(text()).toContain('Second draft.');
    expect(text()).not.toContain('First draft.');
  });

  it('should not render an empty editor twice', () => {
    fixture.detectChanges();

    expect(host().querySelectorAll('.cm-content').length).toBe(1);
  });

  it('should emit the new text after a paste', () => {
    fixture.componentRef.setInput('value', 'alpha');
    fixture.detectChanges();

    paste('beta ');

    expect(values).toEqual(['beta alpha']);
  });

  it('should emit once per edit, not once per value change', () => {
    fixture.componentRef.setInput('value', 'alpha');
    fixture.detectChanges();

    paste('b');
    paste('c');

    expect(values.length).toBe(2);
    expect(values[values.length - 1]).toBe(text());
    expect(text().length).toBe(7);
  });

  it('should not emit for a value set programmatically', () => {
    fixture.componentRef.setInput('value', 'alpha');
    fixture.detectChanges();

    fixture.componentRef.setInput('value', 'gamma');
    fixture.detectChanges();

    expect(text()).toContain('gamma');
    expect(values).toEqual([]);
  });

  it('should drop the editor when the component is destroyed', () => {
    fixture.detectChanges();

    fixture.destroy();

    expect(host().querySelector('.cm-content')).toBeNull();
  });
});
