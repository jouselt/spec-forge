import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReviewPanelComponent } from './review-panel.component';
import { DocumentStore } from '../../state/document-store.service';
import { narrowOrigin } from '../../core/question-graph';
import { isPlaceholder } from '../../core/provenance';
import { renderMarkdown } from '../../templates/assembly';
import { block, doc } from '../fixtures/blocks';

const INFERRED_TEXT = 'A reading list that turns highlights into review cards.';

describe('ReviewPanelComponent', () => {
  let fixture: ComponentFixture<ReviewPanelComponent>;
  let store: DocumentStore;

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.review-row') as NodeListOf<HTMLElement>);
  }

  function rowAt(index: number): HTMLElement {
    const row = rows()[index];

    if (!row) {
      throw new Error(`No review row at ${index}`);
    }

    return row;
  }

  function buttonIn(row: HTMLElement, kind: 'confirm' | 'edit' | 'reject'): HTMLButtonElement {
    const button = row.querySelector(`.review-${kind}`) as HTMLButtonElement | null;

    if (!button) {
      throw new Error(`No ${kind} button in the row`);
    }

    return button;
  }

  function storeBlock(id: string) {
    return store
      .docs()
      .flatMap((candidate) => candidate.blocks)
      .find((candidate) => candidate.id === id);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReviewPanelComponent] }).compileComponents();

    store = TestBed.inject(DocumentStore);
    store.setDocs([
      doc('proposal', [
        block('proposal', 'Goal', 0, 'model', INFERRED_TEXT),
        block('proposal', 'Problem', 0, 'model', 'Readers lose their highlights.'),
        block('proposal', 'Timeline', 0, 'template', 'Four weeks.'),
      ]),
      doc('design', []),
      doc('tasks', []),
    ]);

    fixture = TestBed.createComponent(ReviewPanelComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render one row per inferred block and none for the template block', () => {
    expect(rows().length).toBe(2);

    const sections = rows().map(
      (row) => row.querySelector('.review-section')?.textContent?.trim() ?? '',
    );

    expect(sections).toEqual(['Goal', 'Problem']);
  });

  it('should name the review state of each row', () => {
    expect(rowAt(0).querySelector('.review-state')?.textContent?.trim()).toBe('unreviewed');
  });

  it('should confirm the block behind a row', () => {
    const id = rowAt(0).getAttribute('data-block-id') ?? '';

    buttonIn(rowAt(0), 'confirm').click();
    fixture.detectChanges();

    expect(storeBlock(id)?.review).toBe('confirmed');
    expect(rowAt(0).querySelector('.review-state')?.textContent?.trim()).toBe('confirmed');
  });

  it('should record a hand edit of the block behind a row', () => {
    const id = rowAt(1).getAttribute('data-block-id') ?? '';

    buttonIn(rowAt(1), 'edit').click();
    fixture.detectChanges();

    expect(storeBlock(id)?.review).toBe('edited');
  });

  it('should reject an inference into a gap and drop its row', () => {
    const id = rowAt(0).getAttribute('data-block-id') ?? '';
    const before = renderMarkdown(store.docs()[0]);

    buttonIn(rowAt(0), 'reject').click();
    fixture.detectChanges();

    const rejected = storeBlock(id);

    expect(rejected?.review).toBe('rejected');
    expect(isPlaceholder(rejected?.text ?? '')).toBe(true);
    expect(narrowOrigin(rejected?.origin ?? { kind: 'edited' }, 'missing')).not.toBeNull();
    expect(rows().length).toBe(1);

    // The heading survives and the prose is gone, so nothing inferred is left to export.
    const after = renderMarkdown(store.docs()[0]);

    expect(before).toContain(INFERRED_TEXT);
    expect(after).not.toContain(INFERRED_TEXT);
    expect(after).toContain('## Goal');
  });

  it('should say so when nothing was inferred', () => {
    store.setDocs([doc('proposal', [block('proposal', 'Goal', 0, 'template')])]);
    fixture.detectChanges();

    expect(rows().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.review-empty')).not.toBeNull();
  });
});
