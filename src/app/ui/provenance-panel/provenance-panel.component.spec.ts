import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProvenancePanelComponent } from './provenance-panel.component';
import { DocumentStore } from '../../state/document-store.service';
import { Block, OriginKind } from '../../core/question-graph';
import { block, doc } from '../fixtures/blocks';

/** 18 blocks over 4 kinds: 6 template, 5 answer, 4 imported, 3 edited. */
const FIXTURE: Record<string, OriginKind[]> = {
  'Block One': ['template', 'template', 'answer'],
  'Block Two': ['template', 'answer', 'imported'],
  'Block Three': ['template', 'answer', 'imported'],
  'Block Four': ['template', 'answer', 'imported'],
  'Block Five': ['template', 'answer', 'imported'],
  'Block Six': ['edited', 'edited', 'edited'],
};

const COUNTS: Record<OriginKind, number> = {
  answer: 5,
  template: 6,
  model: 0,
  imported: 4,
  edited: 3,
  missing: 0,
};

describe('ProvenancePanelComponent', () => {
  let fixture: ComponentFixture<ProvenancePanelComponent>;
  let store: DocumentStore;

  function eighteenBlocks(): Block[] {
    const blocks: Block[] = [];

    for (const [section, kinds] of Object.entries(FIXTURE)) {
      kinds.forEach((kind, ord) => blocks.push(block('proposal', section, ord, kind)));
    }

    return blocks;
  }

  /** The rows of one file, by the file name the panel prints. */
  function rowsOf(file: string): HTMLElement[] {
    const sections = Array.from(
      fixture.nativeElement.querySelectorAll('.provenance-file') as NodeListOf<HTMLElement>,
    );
    const section = sections.find(
      (candidate) => candidate.querySelector('.provenance-name')?.textContent?.trim() === file,
    );

    if (!section) {
      throw new Error(`No provenance section for ${file}`);
    }

    return Array.from(section.querySelectorAll('.provenance-kind') as NodeListOf<HTMLElement>);
  }

  function countFor(file: string, kind: OriginKind): number {
    const row = rowsOf(file).find((candidate) => candidate.getAttribute('data-kind') === kind);

    if (!row) {
      throw new Error(`No provenance row for ${kind}`);
    }

    return Number(row.querySelector('.provenance-count')?.textContent?.trim());
  }

  function fileTotal(file: string): string {
    const sections = Array.from(
      fixture.nativeElement.querySelectorAll('.provenance-file') as NodeListOf<HTMLElement>,
    );
    const section = sections.find(
      (candidate) => candidate.querySelector('.provenance-name')?.textContent?.trim() === file,
    );

    return section?.querySelector('.provenance-total')?.textContent?.trim() ?? '';
  }

  function grandTotal(): string {
    return (
      fixture.nativeElement.querySelector('.provenance-grand-total')?.textContent?.trim() ?? ''
    );
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProvenancePanelComponent],
    }).compileComponents();

    store = TestBed.inject(DocumentStore);
    store.setDocs([doc('proposal', eighteenBlocks()), doc('design', []), doc('tasks', [])]);

    fixture = TestBed.createComponent(ProvenancePanelComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render one section per file', () => {
    expect(fixture.nativeElement.querySelectorAll('.provenance-file').length).toBe(3);
  });

  it('should render one row per origin kind, including the kinds at zero', () => {
    expect(rowsOf('proposal').length).toBe(6);
    expect(countFor('proposal', 'model')).toBe(0);
    expect(countFor('proposal', 'missing')).toBe(0);
  });

  it('should render the count of every kind the fixture uses', () => {
    for (const [kind, expected] of Object.entries(COUNTS) as [OriginKind, number][]) {
      expect(countFor('proposal', kind)).toBe(expected);
    }
  });

  it('should sum to the block total the fixture holds', () => {
    const sum = (Object.keys(COUNTS) as OriginKind[]).reduce(
      (total, kind) => total + countFor('proposal', kind),
      0,
    );

    expect(sum).toBe(18);
    expect(fileTotal('proposal')).toBe('18 in this file');
    expect(grandTotal()).toBe('18 in total');
  });

  it('should follow the store when the documents are replaced', () => {
    store.setDocs([
      doc('proposal', [block('proposal', 'Goal', 0, 'missing')]),
      doc('design', []),
      doc('tasks', []),
    ]);
    fixture.detectChanges();

    expect(countFor('proposal', 'missing')).toBe(1);
    expect(countFor('proposal', 'template')).toBe(0);
    expect(grandTotal()).toBe('1 in total');
  });
});
