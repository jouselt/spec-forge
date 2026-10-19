import { importSpec } from './import-spec';
import { narrowOrigin } from './question-graph';
import { renderMarkdown } from '../templates/assembly';

/** A small file with the shapes an import has to survive. */
const SAMPLE = `# 01: A title that is not a section

## Problem

Traditional resumes are static.

## Goal

Build a thing:

1. First behaviour.
2. Second behaviour.

## Target Recruiter Signal

Evidence of judgment.
`;

describe('importSpec', () => {
  it('should turn every section into a locked, imported block', () => {
    const result = importSpec(SAMPLE);

    expect(result.doc.blocks.map((block) => block.section)).toEqual([
      'Problem',
      'Goal',
      'Target Signal',
    ]);
    expect(result.doc.blocks.every((block) => block.locked)).toBe(true);
    expect(result.doc.blocks.every((block) => block.origin.kind === 'imported')).toBe(true);
  });

  it('should keep the section body byte for byte, blank lines and lists included', () => {
    const result = importSpec(SAMPLE);
    const goal = result.doc.blocks[1];

    expect(goal.text).toBe(
      ['Build a thing:', '', '1. First behaviour.', '2. Second behaviour.'].join('\n'),
    );
  });

  it('should report the title and keep it out of the blocks', () => {
    const result = importSpec(SAMPLE);

    expect(result.title).toBe('01: A title that is not a section');
    expect(result.doc.blocks.some((block) => block.text.includes('A title that is not'))).toBe(false);
  });

  it('should accept the older spelling of an aliased heading', () => {
    const result = importSpec(SAMPLE);
    const imported = narrowOrigin(result.doc.blocks[2].origin, 'imported');

    expect(result.doc.blocks[2].section).toBe('Target Signal');
    expect(imported?.section).toBe('Target Recruiter Signal');
    expect(result.unmapped).toEqual([]);
  });

  it('should keep a heading the table does not know, and say so', () => {
    const text = '## Problem\n\nOne.\n\n## Why This Differentiates Anyone\n\nTwo.\n';
    const result = importSpec(text);

    expect(result.doc.blocks.map((block) => block.section)).toEqual([
      'Problem',
      'Why This Differentiates Anyone',
    ]);
    expect(result.unmapped).toEqual(['Why This Differentiates Anyone']);
    expect(result.doc.blocks[1].locked).toBe(true);
  });

  it('should give every block an id that no generated block would take', () => {
    const result = importSpec(SAMPLE);

    expect(result.doc.blocks.map((block) => block.id)).toEqual([
      'proposal:problem:imported',
      'proposal:goal:imported',
      'proposal:target-signal:imported',
    ]);
  });

  it('should survive a file with no sections at all', () => {
    const result = importSpec('# Just a title\n\nAnd a paragraph.\n');

    expect(result.doc.blocks).toEqual([]);
    expect(result.title).toBe('Just a title');
  });

  it('should keep a heading with an empty body rather than dropping it', () => {
    const result = importSpec('## Timeline\n\n## Risks\n\nSomething bad.\n');

    expect(result.doc.blocks.map((block) => block.section)).toEqual(['Timeline', 'Risks']);
    expect(result.doc.blocks[0].text).toBe('');
  });

  it('should render back to the sections it read, without mangling the bodies', () => {
    const result = importSpec(SAMPLE);
    const rendered = renderMarkdown(result.doc);

    expect(rendered).toContain('## Problem\n\nTraditional resumes are static.');
    expect(rendered).toContain(
      '## Goal\n\nBuild a thing:\n\n1. First behaviour.\n2. Second behaviour.',
    );
  });
});
