import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SnapshotPanelComponent } from './snapshot-panel.component';
import { SnapshotStore } from '../../state/snapshot-store.service';
import { DocumentStore } from '../../state/document-store.service';
import { completeAnswers } from '../../templates/fixtures/answer-sets';
import { renderMarkdown } from '../../templates/assembly';

describe('SnapshotPanelComponent', () => {
  let fixture: ComponentFixture<SnapshotPanelComponent>;
  let store: DocumentStore;
  let snapshots: SnapshotStore;

  function rows(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.snapshot-row') as NodeListOf<HTMLElement>,
    );
  }

  function restoreButton(index: number): HTMLButtonElement {
    return rows()[index].querySelector('.restore-button') as HTMLButtonElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SnapshotPanelComponent] }).compileComponents();

    store = TestBed.inject(DocumentStore);
    snapshots = TestBed.inject(SnapshotStore);
    snapshots.clear();

    fixture = TestBed.createComponent(SnapshotPanelComponent);
    fixture.detectChanges();
  });

  it('should say there is nothing saved yet', () => {
    expect(fixture.nativeElement.querySelector('.empty')).not.toBeNull();
    expect(rows().length).toBe(0);
  });

  it('should list one row per snapshot, newest first', () => {
    store.generate(completeAnswers());
    store.generate(completeAnswers());
    fixture.detectChanges();

    expect(rows().length).toBe(2);
    expect(rows()[0].querySelector('.row-version')?.textContent?.trim()).toBe('v2');
    expect(rows()[1].querySelector('.row-version')?.textContent?.trim()).toBe('v1');
    expect(rows()[0].querySelector('.row-label')?.textContent?.trim()).toBe('before a generate');
  });

  it('should say how many lines differ from what is on screen', () => {
    store.generate(completeAnswers());
    store.generate(completeAnswers());
    fixture.detectChanges();

    // The newest snapshot is what was on screen before this generate, and a
    // regeneration from the same answers is byte identical, so nothing differs.
    expect(rows()[0].querySelector('.row-delta')?.textContent?.trim()).toBe('0 lines different');

    store.setBlockText(store.blocksFor('proposal')[0].id, 'A change.');
    fixture.detectChanges();

    expect(rows()[0].querySelector('.row-delta')?.textContent?.trim()).not.toBe('0 lines different');
  });

  it('should restore a snapshot and say so', () => {
    store.generate(completeAnswers());
    const first = renderMarkdown(store.docs()[0]);

    store.setBlockText(store.blocksFor('proposal')[0].id, 'A change worth losing.');
    store.generate(completeAnswers());
    fixture.detectChanges();

    // v2 is the state before the second generate, which includes the edit.
    restoreButton(0).click();
    fixture.detectChanges();

    expect(renderMarkdown(store.docs()[0])).toContain('A change worth losing.');
    expect(fixture.nativeElement.querySelector('.last-restored')?.textContent).toContain('Restored');

    restoreButton(1).click();
    fixture.detectChanges();

    expect(store.docs()).toEqual([]);
    expect(first.length).toBeGreaterThan(0);
  });

  it('should keep a snapshot in the list after restoring it', () => {
    store.generate(completeAnswers());
    fixture.detectChanges();

    expect(rows().length).toBe(1);
    restoreButton(0).click();
    fixture.detectChanges();

    expect(rows().length).toBe(1);
    expect(snapshots.count()).toBe(1);
  });
});
