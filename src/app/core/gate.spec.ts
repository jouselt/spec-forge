import { Block, GeneratedDoc } from './question-graph';
import { SpecFile } from './mapping';
import { assemble } from '../templates/assembly';
import { completeAnswers } from '../templates/fixtures/answer-sets';
import { evaluate, groupBlocking, verdictLine } from './gate';

describe('gate', () => {
  function baseline(): GeneratedDoc[] {
    return assemble(completeAnswers());
  }

  function inferred(docs: GeneratedDoc[], review: Block['review'] = 'unreviewed'): GeneratedDoc[] {
    return docs.map((doc) =>
      doc.file === 'design'
        ? {
            ...doc,
            blocks: [
              ...doc.blocks,
              {
                id: 'design:architecture:inferred',
                file: 'design',
                section: 'Architecture',
                ord: 9,
                text: 'A shaped sentence with no answer behind it.',
                origin: {
                  kind: 'model',
                  modelId: 'Qwen2.5-0.5B',
                  basedOn: ['q.idea'],
                  temperature: 0.2,
                },
                review,
                locked: false,
              },
            ],
          }
        : doc,
    );
  }

  it('should let a fully sourced run export', () => {
    const result = evaluate(baseline());

    expect(result.blocking).toEqual([]);
    expect(result.canExport).toBe(true);
    expect(verdictLine(result)).toBe('Nothing is blocking the export.');
  });

  it('should block on one unreviewed inferred block, naming the file', () => {
    const result = evaluate(inferred(baseline()));

    expect(result.blocking.length).toBe(1);
    expect(result.blocking[0].kind).toBe('unreviewed-inferred');
    expect(result.blocking[0].file).toBe('design');
    expect(result.canExport).toBe(false);
    expect(verdictLine(result)).toBe(
      '1 inferred block needs your review. Export stays locked until then.',
    );
  });

  it('should say a gap needs answering, not reviewing', () => {
    const docs = baseline().map((doc) =>
      doc.file === 'proposal'
        ? { ...doc, blocks: doc.blocks.filter((block) => block.section !== 'Timeline') }
        : doc,
    );

    expect(verdictLine(evaluate(docs))).toBe(
      '1 structure problem in the files. Export stays locked until then.',
    );
  });

  it('should count each reason separately when several are present', () => {
    const docs = inferred(
      baseline().map((doc) =>
        doc.file === 'proposal'
          ? {
              ...doc,
              blocks: [
                ...doc.blocks,
                { ...doc.blocks[0], id: 'proposal:problem:gap', text: '{{MISSING: who has it?}}' },
              ],
            }
          : doc,
      ),
    );

    expect(verdictLine(evaluate(docs))).toBe(
      '1 inferred block needs your review and 1 gap is still unanswered. Export stays locked until then.',
    );
  });

  it('should group the blockers by file and kind', () => {
    const docs = baseline().map((doc) =>
      doc.file === 'proposal'
        ? {
            ...doc,
            blocks: [
              ...doc.blocks.filter((block) => block.section !== 'Risks'),
              { ...doc.blocks[0], id: 'proposal:problem:gap-1', text: '{{MISSING: one}}' },
              { ...doc.blocks[0], id: 'proposal:problem:gap-2', text: '{{MISSING: two}}' },
            ],
          }
        : doc,
    );
    const groups = groupBlocking(evaluate(docs).blocking);

    expect(groups.map((group) => `${group.file}:${group.kind}:${group.count}`)).toEqual([
      'proposal:placeholder:2',
      'proposal:structure:1',
    ]);
  });

  it('should stop blocking once the inferred block is confirmed', () => {
    const result = evaluate(inferred(baseline(), 'confirmed'));

    expect(result.blocking).toEqual([]);
    expect(result.canExport).toBe(true);
  });

  it('should keep blocking an inferred block that was rejected but left in place', () => {
    const result = evaluate(inferred(baseline(), 'rejected'));

    expect(result.blocking).toEqual([]);
    expect(result.canExport).toBe(true);
  });

  it('should block on a surviving placeholder', () => {
    const docs = baseline().map((doc) =>
      doc.file === 'proposal'
        ? {
            ...doc,
            blocks: doc.blocks.map((block) =>
              block.section === 'Risks' && block.ord === 0
                ? { ...block, text: '{{MISSING: Biggest risk?}}' }
                : block,
            ),
          }
        : doc,
    );
    const result = evaluate(docs);

    expect(result.blocking.map((blocker) => blocker.kind)).toContain('placeholder');
    expect(result.canExport).toBe(false);
  });

  it('should block on a missing required section', () => {
    const docs = baseline().map((doc) =>
      doc.file === 'proposal'
        ? { ...doc, blocks: doc.blocks.filter((block) => block.section !== 'Timeline') }
        : doc,
    );
    const result = evaluate(docs);

    expect(result.blocking.map((blocker) => blocker.kind)).toEqual(['structure']);
    expect(result.canExport).toBe(false);
  });

  it('should name the file and the section of every structural block', () => {
    const docs = baseline().map((doc) =>
      doc.file === 'design'
        ? { ...doc, blocks: doc.blocks.filter((block) => block.section !== 'Open Questions') }
        : doc,
    );
    const blocker = evaluate(docs).blocking[0];

    expect(blocker.kind).toBe('structure');
    expect(blocker.file).toBe('design');
    expect(blocker.detail).toContain('Open Questions');
  });

  it('should export anyway when the warning setting is on, and still report the blocks', () => {
    const result = evaluate(inferred(baseline()), { warnInsteadOfBlock: true });

    expect(result.canExport).toBe(true);
    expect(result.blocking.length).toBe(1);
    expect(verdictLine(result)).toBe(
      '1 problem left, exported anyway because the warning setting is on.',
    );
  });

  it('should keep warnings out of the blocking list', () => {
    const result = evaluate(baseline());

    expect(result.warnings.map((warning) => warning.code)).toContain('tasks-item-count');
    expect(result.blocking).toEqual([]);
  });

  it('should report per file, with counts that add up', () => {
    const docs = inferred(baseline());
    const result = evaluate(docs);

    expect(result.report.map((row) => row.file)).toEqual(['proposal', 'design', 'tasks']);

    for (const row of result.report) {
      const doc = docs.find((candidate) => candidate.file === row.file);

      if (!doc) {
        throw new Error(`No document for ${row.file}`);
      }

      expect(row.blocks).withContext(row.file).toBe(doc.blocks.length);
      expect(row.gaps)
        .withContext(row.file)
        .toBe(doc.blocks.filter((block) => block.text.includes('{{MISSING:')).length);
      expect(row.inferredUnreviewed + row.sourced)
        .withContext(row.file)
        .toBeLessThanOrEqual(row.blocks);
    }

    expect(result.report[1].inferredUnreviewed).toBe(1);
    expect(result.report[0].inferredUnreviewed).toBe(0);
    expect(result.report[2].inferredUnreviewed).toBe(0);
  });

  it('should report the style findings without blocking on them', () => {
    const docs = baseline().map((doc) =>
      doc.file === 'proposal'
        ? {
            ...doc,
            blocks: doc.blocks.map((block) =>
              block.section === 'Goal' && block.ord === 0
                ? { ...block, text: 'A robust plan.' }
                : block,
            ),
          }
        : doc,
    );
    const result = evaluate(docs);

    expect(result.styleFindings.map((finding) => finding.word)).toEqual(['robust']);
    expect(result.blocking).toEqual([]);
    expect(result.canExport).toBe(true);
  });

  it('should return an empty report and a live export for no documents', () => {
    const result = evaluate([]);

    expect(result.report).toEqual([]);
    expect(result.blocking).toEqual([]);
    expect(result.canExport).toBe(true);
  });
});
