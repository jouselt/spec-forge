import { GeneratedDoc } from './question-graph';
import {
  applySectionChoices,
  changedSections,
  diffLines,
  diffSections,
  sectionKey,
} from './diff';
import { importSpec } from './import-spec';
import { assemble, renderMarkdown } from '../templates/assembly';
import { completeAnswers } from '../templates/fixtures/answer-sets';

describe('diffLines', () => {
  it('should report a line that only changed once', () => {
    const lines = diffLines('one\ntwo\nthree', 'one\nTWO\nthree');

    expect(lines).toEqual([
      { kind: 'same', text: 'one' },
      { kind: 'removed', text: 'two' },
      { kind: 'added', text: 'TWO' },
      { kind: 'same', text: 'three' },
    ]);
  });

  it('should report a pure addition', () => {
    const lines = diffLines('one', 'one\ntwo');

    expect(lines.filter((line) => line.kind === 'added').map((line) => line.text)).toEqual(['two']);
    expect(lines.filter((line) => line.kind === 'removed')).toEqual([]);
  });

  it('should report a pure removal', () => {
    const lines = diffLines('one\ntwo', 'one');

    expect(lines.filter((line) => line.kind === 'removed').map((line) => line.text)).toEqual(['two']);
  });

  it('should report nothing for identical text', () => {
    const lines = diffLines('same\nlines', 'same\nlines');

    expect(lines.every((line) => line.kind === 'same')).toBe(true);
  });
});

describe('diffSections', () => {
  function generated(): GeneratedDoc[] {
    return assemble(completeAnswers());
  }

  function withChangedGoal(docs: GeneratedDoc[]): GeneratedDoc[] {
    return docs.map((doc) =>
      doc.file === 'proposal'
        ? {
            ...doc,
            blocks: doc.blocks.map((block) =>
              block.section === 'Goal' && block.ord === 0
                ? { ...block, text: 'A different goal, written by whoever ran the generator.' }
                : block,
            ),
          }
        : doc,
    );
  }

  it('should report exactly one changed section when one changed', () => {
    const before = generated();
    const diffs = diffSections(before[0], withChangedGoal(before)[0]);
    const changed = diffs.filter((diff) => diff.changed);

    expect(changed.length).toBe(1);
    expect(changed[0].section).toBe('Goal');
    expect(diffs.length).toBeGreaterThan(1);
  });

  it('should report nothing changed between a document and itself', () => {
    expect(diffSections(generated()[0], generated()[0]).every((diff) => !diff.changed)).toBe(true);
  });

  it('should never call a locked section changed, however different the text is', () => {
    const imported = importSpec('## Goal\n\nMy own goal, which nobody may touch.\n');
    const candidate = withChangedGoal(generated())[0];
    const diffs = diffSections(imported.doc, candidate);
    const goal = diffs.find((diff) => diff.section === 'Goal');

    expect(goal?.locked).toBe(true);
    expect(goal?.changed).toBe(false);
  });

  it('should keep the current section order and append what the candidate adds', () => {
    const imported = importSpec('## A Section Of My Own\n\nMine.\n');
    const diffs = diffSections(imported.doc, generated()[0]);

    expect(diffs[0].section).toBe('A Section Of My Own');
    expect(diffs.map((diff) => diff.section)).toContain('Risks');
  });
});

describe('applySectionChoices', () => {
  function generated(): GeneratedDoc[] {
    return assemble(completeAnswers());
  }

  function candidate(): GeneratedDoc {
    return generated()
      .map((doc) =>
        doc.file === 'proposal'
          ? {
              ...doc,
              blocks: doc.blocks.map((block) =>
                block.section === 'Goal' && block.ord === 0
                  ? { ...block, text: 'The new goal.' }
                  : block.section === 'Timeline' && block.ord === 0
                    ? { ...block, text: 'The new timeline.' }
                    : block,
              ),
            }
          : doc,
      )
      .find((doc) => doc.file === 'proposal')!;
  }

  it('should take the accepted section and leave the rest', () => {
    const before = generated()[0];
    const after = applySectionChoices(before, candidate(), new Set(['proposal:Goal']));
    const goal = after.blocks.find((block) => block.section === 'Goal');
    const timeline = after.blocks.find((block) => block.section === 'Timeline');

    expect(goal?.text).toBe('The new goal.');
    expect(timeline?.text).toBe(
      before.blocks.find((block) => block.section === 'Timeline')?.text,
    );
  });

  it('should take nothing when nothing is accepted', () => {
    const before = generated()[0];
    const after = applySectionChoices(before, candidate(), new Set());

    expect(renderMarkdown(after)).toBe(renderMarkdown(before));
  });

  it('should take everything when everything is accepted', () => {
    const before = generated()[0];
    const target = candidate();
    const accepted = new Set(
      diffSections(before, target)
        .filter((diff) => diff.changed)
        .map((diff) => sectionKey('proposal', diff.section)),
    );
    const after = applySectionChoices(before, target, accepted);

    expect(renderMarkdown(after)).toBe(renderMarkdown(target));
  });

  it('should leave a locked section byte identical even when it is accepted', () => {
    const imported = importSpec('## Goal\n\nMy own goal, which nobody may touch.\n');
    const target = candidate();
    const accepted = new Set([sectionKey('proposal', 'Goal')]);
    const after = applySectionChoices(imported.doc, target, accepted);
    const goal = after.blocks.find((block) => block.section === 'Goal');

    expect(goal?.text).toBe('My own goal, which nobody may touch.');
    expect(goal?.locked).toBe(true);
  });

  it('should accept a section the current document does not have', () => {
    const imported = importSpec('## Goal\n\nMine.\n');
    const target = candidate();
    const after = applySectionChoices(imported.doc, target, new Set([sectionKey('proposal', 'Risks')]));

    expect(after.blocks.some((block) => block.section === 'Risks')).toBe(true);
    expect(after.blocks.find((block) => block.section === 'Goal')?.text).toBe('Mine.');
  });

  it('should name the sections a person would have to decide about', () => {
    expect(changedSections(generated()[0], candidate())).toEqual(['Goal', 'Timeline']);
  });
});
