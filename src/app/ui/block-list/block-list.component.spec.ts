import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlockListComponent } from './block-list.component';
import { StepRailComponent } from '../step-rail/step-rail.component';
import { DocumentStore } from '../../state/document-store.service';
import { WizardStore } from '../../state/wizard-store.service';
import { Origin } from '../../core/question-graph';
import { block, doc } from '../fixtures/blocks';

/** The rail and the block list together, which is how the click-through works. */
@Component({
  selector: 'app-block-list-host',
  standalone: true,
  imports: [BlockListComponent, StepRailComponent],
  template: `
    <app-step-rail [steps]="wizard.rail()" [highlighted]="wizard.highlighted()" />
    <app-block-list />
  `,
})
class HostComponent {
  readonly wizard = inject(WizardStore);
}

const GOAL_ORIGIN: Origin = { kind: 'template', frame: 'goal-frame', inputs: ['q.goal'] };
const INFERRED_TEXT = 'A reading list that turns highlights into review cards.';

describe('BlockListComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let store: DocumentStore;
  let wizard: WizardStore;

  function rows(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.block-row') as NodeListOf<HTMLElement>,
    );
  }

  function rowOfKind(kind: string): HTMLElement {
    const row = rows().find((candidate) => candidate.getAttribute('data-kind') === kind);

    if (!row) {
      throw new Error(`No block row of kind ${kind}`);
    }

    return row;
  }

  function highlightedRailIds(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll(
        '.rail-button.is-highlighted',
      ) as NodeListOf<HTMLElement>,
    ).map((button) => button.getAttribute('data-step-id') ?? '');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    store = TestBed.inject(DocumentStore);
    wizard = TestBed.inject(WizardStore);

    store.setDocs([
      doc('proposal', [
        { ...block('proposal', 'Goal', 0, 'template', 'Four weeks.'), origin: GOAL_ORIGIN },
        block('proposal', 'Target Signal', 0, 'model', INFERRED_TEXT),
        block('proposal', 'Problem', 0, 'missing'),
      ]),
      doc('design', []),
      doc('tasks', []),
    ]);

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('should render one row per block, grouped by file', () => {
    expect(rows().length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.block-file').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.block-empty')).not.toBeNull();
  });

  it('should tag an inferred block with a distinct class and the badge', () => {
    const inferred = rowOfKind('model');

    expect(inferred.classList).toContain('is-inferred');
    expect(inferred.querySelector('.model-inferred')?.textContent?.trim()).toBe('model-inferred');
  });

  it('should leave a sourced block untagged and without the badge', () => {
    const sourced = rowOfKind('template');

    expect(sourced.classList).not.toContain('is-inferred');
    expect(sourced.querySelector('.model-inferred')).toBeNull();
  });

  it('should mark the answer behind a block when its source button is clicked', () => {
    const source = rowOfKind('template').querySelector('.block-source') as HTMLButtonElement;

    expect(wizard.highlighted()).toBeNull();

    source.click();
    fixture.detectChanges();

    expect(wizard.highlighted()).toBe('q.goal');
    expect(highlightedRailIds()).toEqual(['q.goal']);
    // The rail index moves to the question behind the sentence.
    expect(wizard.index()).toBe(
      wizard.questions().findIndex((question) => question.id === 'q.goal'),
    );
  });

  it('should offer no source button on a gap and no badge either', () => {
    const gap = rowOfKind('missing');

    expect(gap.querySelector('.block-source')).toBeNull();
    expect(gap.querySelector('.model-inferred')).toBeNull();
  });
});
