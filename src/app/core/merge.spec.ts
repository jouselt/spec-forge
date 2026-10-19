import { GeneratedDoc } from './question-graph';
import { hasLockedBlocks, lockedSections, mergeGeneration } from './merge';
import { importSpec } from './import-spec';
import { assemble, renderMarkdown } from '../templates/assembly';
import { completeAnswers } from '../templates/fixtures/answer-sets';

const IMPORTED = `# A proposal somebody already wrote

## Problem

A sentence a person wrote and nobody may rewrite.

## Goal

Another sentence a person wrote.
`;

describe('mergeGeneration', () => {
  function generated(): GeneratedDoc[] {
    return assemble(completeAnswers());
  }

  function importedDocs(): GeneratedDoc[] {
    const imported = importSpec(IMPORTED);

    return [imported.doc, ...generated().filter((doc) => doc.file !== 'proposal')];
  }

  it('should list the sections that hold a lock', () => {
    const docs = importedDocs();

    expect([...lockedSections(docs[0])]).toEqual(['Problem', 'Goal']);
    expect(hasLockedBlocks(docs)).toBe(true);
  });

  it('should keep an imported section byte for byte through a regeneration', () => {
    const before = importedDocs();
    const after = mergeGeneration(before, generated());
    const problem = after[0].blocks.find((block) => block.section === 'Problem');

    expect(problem?.text).toBe('A sentence a person wrote and nobody may rewrite.');
    expect(problem?.origin.kind).toBe('imported');
    expect(problem?.locked).toBe(true);
  });

  it('should fill the sections nobody locked', () => {
    const after = mergeGeneration(importedDocs(), generated());
    const sections = after[0].blocks.map((block) => block.section);

    expect(sections).toContain('Problem');
    expect(sections).toContain('Timeline');
    expect(sections).toContain('Risks');
  });

  it('should not duplicate a locked section with generated text', () => {
    const after = mergeGeneration(importedDocs(), generated());
    const problemBlocks = after[0].blocks.filter((block) => block.section === 'Problem');

    expect(problemBlocks.length).toBe(1);
  });

  it('should keep a locked section the generator does not emit at all', () => {
    const imported = importSpec('## A Section Of My Own\n\nMine.\n');
    const before: GeneratedDoc[] = [
      imported.doc,
      ...generated().filter((doc) => doc.file !== 'proposal'),
    ];
    const after = mergeGeneration(before, generated());

    expect(after[0].blocks.some((block) => block.section === 'A Section Of My Own')).toBe(true);
  });

  it('should leave an unlocked document alone', () => {
    const before = generated();
    const after = mergeGeneration(before, generated());

    expect(renderMarkdown(after[0])).toBe(renderMarkdown(before[0]));
    expect(after.every((doc) => doc.blocks.every((block) => !block.locked))).toBe(true);
  });

  it('should leave the other two files untouched when only one was imported', () => {
    const before = importedDocs();
    const after = mergeGeneration(before, generated());

    expect(renderMarkdown(after[1])).toBe(renderMarkdown(generated()[1]));
    expect(renderMarkdown(after[2])).toBe(renderMarkdown(generated()[2]));
  });

  it('should hold the line on the motivating failure: import, regenerate, nothing lost', () => {
    const before = importedDocs();
    const importedText = renderMarkdown(before[0]);
    const after = mergeGeneration(before, generated());
    const afterText = renderMarkdown(after[0]);

    for (const sentence of [
      'A sentence a person wrote and nobody may rewrite.',
      'Another sentence a person wrote.',
    ]) {
      expect(importedText).toContain(sentence);
      expect(afterText).withContext(sentence).toContain(sentence);
    }
  });
});
