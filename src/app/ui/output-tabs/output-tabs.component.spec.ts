import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { EditorView } from '@codemirror/view';
import { OutputTabsComponent } from './output-tabs.component';
import { MarkdownEditorComponent } from '../markdown-editor/markdown-editor.component';
import { DocumentStore } from '../../state/document-store.service';
import { Block, narrowOrigin } from '../../core/question-graph';
import { renderMarkdown } from '../../templates/assembly';
import { completeAnswers } from '../../templates/fixtures/answer-sets';

describe('OutputTabsComponent', () => {
  let fixture: ComponentFixture<OutputTabsComponent>;
  let component: OutputTabsComponent;
  let store: DocumentStore;

  function tabButtons(): HTMLButtonElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.tab-button') as NodeListOf<HTMLButtonElement>,
    );
  }

  function tabPanels(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.tab-panel') as NodeListOf<HTMLElement>,
    );
  }

  function editors(): MarkdownEditorComponent[] {
    return fixture.debugElement
      .queryAll(By.directive(MarkdownEditorComponent))
      .map((debug) => debug.componentInstance as MarkdownEditorComponent);
  }

  function editorElements(): HTMLElement[] {
    return fixture.debugElement
      .queryAll(By.directive(MarkdownEditorComponent))
      .map((debug) => debug.nativeElement as HTMLElement);
  }

  /** What one editor holds, read from the editor rather than from the DOM. */
  function editorDoc(index: number): string {
    const element = editorElements()[index];

    if (!element) {
      throw new Error(`No editor at ${index}`);
    }

    const view = EditorView.findFromDOM(element);

    if (!view) {
      throw new Error(`No CodeMirror view at ${index}`);
    }

    return view.state.doc.toString();
  }

  function editorForBlock(id: string): MarkdownEditorComponent {
    const debug = fixture.debugElement
      .queryAll(By.directive(MarkdownEditorComponent))
      .find((candidate) => (candidate.nativeElement as HTMLElement).closest(`[data-block-id="${id}"]`));

    if (!debug) {
      throw new Error(`No editor for block ${id}`);
    }

    return debug.componentInstance as MarkdownEditorComponent;
  }

  function headings(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.section-heading') as NodeListOf<HTMLElement>,
    ).map((heading) => heading.textContent?.trim() ?? '');
  }

  function selectTab(label: string): void {
    const button = tabButtons().find((candidate) => candidate.textContent?.trim() === label);

    if (!button) {
      throw new Error(`No tab labelled ${label}`);
    }

    button.click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OutputTabsComponent] }).compileComponents();

    store = TestBed.inject(DocumentStore);
    store.generate(completeAnswers());

    fixture = TestBed.createComponent(OutputTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render one tab per generated file', () => {
    expect(tabButtons().map((button) => button.textContent?.trim())).toEqual([
      'proposal',
      'design',
      'tasks',
    ]);
    expect(tabPanels().length).toBe(3);
  });

  it('should open on the proposal tab', () => {
    expect(tabPanels()[0].hidden).toBe(false);
    expect(tabPanels()[1].hidden).toBe(true);
    expect(tabPanels()[2].hidden).toBe(true);
    expect(component.active()).toBe('proposal');
  });

  it('should show the selected tab and hide the others', () => {
    selectTab('design');

    expect(component.active()).toBe('design');
    expect(tabPanels()[0].hidden).toBe(true);
    expect(tabPanels()[1].hidden).toBe(false);
    expect(tabButtons()[1].getAttribute('aria-selected')).toBe('true');
    expect(tabButtons()[0].getAttribute('aria-selected')).toBe('false');
  });

  it('should render one editor per block of the active file', () => {
    expect(editors().length).toBe(store.blocksFor('proposal').length);
  });

  it('should hold exactly one block per editor, never a whole file', () => {
    const blocks = store.blocksFor('proposal');
    const wholeFile = renderMarkdown(store.docs()[0]);

    expect(blocks.length).toBeGreaterThan(1);

    blocks.forEach((block, index) => {
      expect(editorDoc(index)).toBe(block.text);
      expect(editorDoc(index)).not.toBe(wholeFile);
    });
  });

  it('should group the editors under their section heading, in document order', () => {
    const sections = store.blocksFor('proposal').map((block) => block.section);
    const distinct = sections.filter((section, index) => sections.indexOf(section) === index);

    expect(headings()).toEqual(distinct);
  });

  it('should show the origin kind of every block', () => {
    const kinds = Array.from(
      fixture.nativeElement.querySelectorAll('.block-kind') as NodeListOf<HTMLElement>,
    ).map((node) => node.getAttribute('data-kind'));

    expect(kinds).toEqual(store.blocksFor('proposal').map((block) => block.origin.kind));
  });

  it('should mark the block behind an edit as edited', () => {
    const before = store.blocksFor('proposal')[0];
    const others = store.blocksFor('proposal').slice(1);
    const design = store.blocksFor('design');

    editorForBlock(before.id).valueChange.emit(`${before.text} Plus one more sentence.`);
    fixture.detectChanges();

    const after = store.blocksFor('proposal')[0];
    const edited = narrowOrigin(after.origin, 'edited');

    expect(after.id).toBe(before.id);
    expect(after.text).toBe(`${before.text} Plus one more sentence.`);
    expect(after.review).toBe('edited');
    expect(edited?.derivedFrom).toEqual(before.origin);
    expect(store.blocksFor('proposal').slice(1)).toEqual(others);
    expect(store.blocksFor('design')).toEqual(design);
  });

  it('should ignore an edit that changes nothing', () => {
    const before = store.docs();
    const block: Block = store.blocksFor('proposal')[0];

    editorForBlock(block.id).valueChange.emit(block.text);
    fixture.detectChanges();

    expect(store.docs()).toEqual(before);
  });

  it('should keep an edit when the user leaves the tab and comes back', () => {
    const block = store.blocksFor('proposal')[0];

    editorForBlock(block.id).valueChange.emit('Rewritten by hand.');
    fixture.detectChanges();

    selectTab('tasks');
    expect(editors().length).toBe(store.blocksFor('tasks').length);

    selectTab('proposal');

    expect(store.blocksFor('proposal')[0].text).toBe('Rewritten by hand.');
    expect(editorDoc(0)).toBe('Rewritten by hand.');
  });

  it('should render no editors before a generate', () => {
    store.setDocs([]);
    fixture.detectChanges();

    expect(editors().length).toBe(0);
    expect(headings()).toEqual([]);
  });
});
