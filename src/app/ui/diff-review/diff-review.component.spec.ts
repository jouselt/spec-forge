import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiffReviewComponent } from './diff-review.component';
import { DocumentStore } from '../../state/document-store.service';
import { SnapshotStore } from '../../state/snapshot-store.service';
import { completeAnswers } from '../../templates/fixtures/answer-sets';
import { importSpec } from '../../core/import-spec';

describe('DiffReviewComponent', () => {
  let fixture: ComponentFixture<DiffReviewComponent>;
  let component: DiffReviewComponent;
  let store: DocumentStore;

  /** A generated run with one block rewritten by hand, then a proposal on top. */
  function proposeAfterEdit(): void {
    store.generate(completeAnswers());

    const goal = store.blocksFor('proposal').find((block) => block.section === 'Goal');

    if (!goal) {
      throw new Error('No Goal section');
    }

    store.setBlockText(goal.id, 'My own words, which I would rather keep.');
    store.propose(completeAnswers());
  }

  function sections(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.diff-section') as NodeListOf<HTMLElement>,
    );
  }

  function toggleFor(section: string): HTMLInputElement {
    const row = sections().find((candidate) => candidate.getAttribute('data-section') === section);

    if (!row) {
      throw new Error(`No diff row for ${section}`);
    }

    return row.querySelector('.accept-toggle') as HTMLInputElement;
  }

  function button(selector: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(selector) as HTMLButtonElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DiffReviewComponent] }).compileComponents();

    store = TestBed.inject(DocumentStore);
    TestBed.inject(SnapshotStore).clear();

    fixture = TestBed.createComponent(DiffReviewComponent);
    component = fixture.componentInstance;
  });

  it('should render nothing when there is no proposal', () => {
    store.generate(completeAnswers());
    fixture.detectChanges();

    expect(sections().length).toBe(0);
    expect(button('.apply-diff')).toBeNull();
  });

  it('should list the sections a regeneration would change, accepted by default', () => {
    proposeAfterEdit();
    fixture.detectChanges();

    expect(sections().length).toBeGreaterThan(0);
    expect(toggleFor('Goal').checked).toBe(true);
    expect(component.accepted().has('proposal:Goal')).toBe(true);
  });

  it('should apply only what is ticked', () => {
    proposeAfterEdit();
    fixture.detectChanges();

    toggleFor('Goal').click();
    fixture.detectChanges();

    expect(toggleFor('Goal').checked).toBe(false);

    // Tick it back on and apply: the generated text comes back.
    toggleFor('Goal').click();
    fixture.detectChanges();
    button('.apply-diff').click();
    fixture.detectChanges();

    const goal = store.blocksFor('proposal').find((block) => block.section === 'Goal');

    expect(goal?.text).not.toBe('My own words, which I would rather keep.');
    expect(store.proposal()).toBeNull();
  });

  it('should leave an unticked section exactly as it was', () => {
    proposeAfterEdit();
    fixture.detectChanges();

    toggleFor('Goal').click();
    fixture.detectChanges();
    component.apply();
    fixture.detectChanges();

    const goal = store.blocksFor('proposal').find((block) => block.section === 'Goal');

    expect(goal?.text).toBe('My own words, which I would rather keep.');
    expect(store.proposal()).toBeNull();
  });

  it('should disable the apply button when nothing is ticked', () => {
    proposeAfterEdit();
    fixture.detectChanges();

    for (const row of sections()) {
      const toggle = row.querySelector('.accept-toggle') as HTMLInputElement;

      if (!toggle.disabled && toggle.checked) {
        toggle.click();
      }
    }

    fixture.detectChanges();

    expect(button('.apply-diff').disabled).toBe(true);
  });

  it('should throw the proposal away on keep mine', () => {
    proposeAfterEdit();
    const before = store.blocksFor('proposal').map((block) => block.text);
    fixture.detectChanges();

    button('.keep-mine').click();
    fixture.detectChanges();

    expect(store.proposal()).toBeNull();
    expect(store.blocksFor('proposal').map((block) => block.text)).toEqual(before);
  });

  it('should show a locked section, name it as the reader text, and refuse to tick it', () => {
    const imported = importSpec('## Goal\n\nA goal I wrote and nobody may rewrite.\n');

    store.setDocs([imported.doc]);
    store.propose(completeAnswers());
    fixture.detectChanges();

    const row = sections().find((candidate) => candidate.getAttribute('data-section') === 'Goal');

    expect(row?.classList.contains('is-locked')).toBe(true);
    expect(row?.querySelector('.lock-badge')?.textContent?.trim()).toBe('This is your text');
    expect((row?.querySelector('.accept-toggle') as HTMLInputElement).disabled).toBe(true);
    expect(component.accepted().has('proposal:Goal')).toBe(false);
  });
});
