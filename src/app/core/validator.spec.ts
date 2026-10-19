import { Block, GeneratedDoc, narrowOrigin } from './question-graph';
import { SpecFile, sectionsFor } from './mapping';
import { assemble } from '../templates/assembly';
import { completeAnswers } from '../templates/fixtures/answer-sets';
import {
  TASK_ITEM_RANGE,
  hasCheckableShape,
  validate,
  validateDoc,
} from './validator';

describe('validator', () => {
  function baseline(): GeneratedDoc[] {
    return assemble(completeAnswers());
  }

  function fileOf(docs: GeneratedDoc[], file: SpecFile): GeneratedDoc {
    const found = docs.find((doc) => doc.file === file);

    if (!found) {
      throw new Error(`No ${file} document`);
    }

    return found;
  }

  function withoutSection(docs: GeneratedDoc[], file: SpecFile, section: string): GeneratedDoc[] {
    return docs.map((doc) =>
      doc.file === file
        ? { ...doc, blocks: doc.blocks.filter((block) => block.section !== section) }
        : doc,
    );
  }

  function withBlocks(docs: GeneratedDoc[], file: SpecFile, blocks: Block[]): GeneratedDoc[] {
    return docs.map((doc) => (doc.file === file ? { ...doc, blocks: [...doc.blocks, ...blocks] } : doc));
  }

  function item(text: string, id: string, section = 'Phase 1: Contracts and scaffold'): Block {
    return {
      id,
      file: 'tasks',
      section,
      ord: 0,
      text,
      origin: { kind: 'template', frame: 'item', inputs: ['q.idea'] },
      review: 'unreviewed',
      locked: false,
    };
  }

  function codesOf(docs: GeneratedDoc[]): string[] {
    return validate(docs).map((finding) => finding.code);
  }

  it('should find nothing blocking on a complete run', () => {
    const findings = validate(baseline());

    expect(findings.filter((finding) => finding.severity === 'block')).toEqual([]);
  });

  it('should flag a criterion without a number, unit, identifier or comparison', () => {
    const passing = [
      'The export button is disabled while 1 unreviewed block exists',
      'Cold load under 2s on a 4 year old laptop',
      'The gate runs in 250 ms',
      '`evaluate()` returns a blocking array',
      'Test coverage stays above 80%',
      'The bundle stays under 500 kB',
      'Zero network requests after the first load',
      'The diff view shows fewer than 5 removed lines',
      'Answers survive a reload in 3 clicks or fewer',
      'The report lists at least 1 warning per file',
    ];
    const failing = [
      'The app should feel fast',
      'It needs to be secure',
      'The code should be clean and easy to read',
      'Everything works as expected',
      'The user is happy with the result',
      'It handles edge cases well',
    ];

    for (const text of passing) {
      expect(hasCheckableShape(text)).withContext(text).toBe(true);
    }

    for (const text of failing) {
      expect(hasCheckableShape(text)).withContext(text).toBe(false);
    }
  });

  it('should flag a weak criterion without deleting it', () => {
    const docs = baseline();
    const tasks = fileOf(docs, 'proposal');
    const section = tasks.blocks.find((block) => block.section === 'Acceptance Criteria');

    if (!section) {
      throw new Error('No Acceptance Criteria section');
    }

    const weak: Block = { ...section, id: 'proposal:acceptance:weak', text: '- It should work well' };
    const patched = withBlocks(docs, 'proposal', [weak]);
    const findings = validate(patched).filter(
      (finding) => finding.code === 'acceptance-criterion-shape',
    );

    expect(findings.map((finding) => finding.blockId)).toEqual(['proposal:acceptance:weak']);
    expect(findings[0].severity).toBe('warn');

    const kept = fileOf(patched, 'proposal').blocks.find((block) => block.id === 'proposal:acceptance:weak');
    expect(kept?.text).toBe('- It should work well');
  });

  it('should flag each missing required proposal section on its own', () => {
    const required = sectionsFor('proposal').filter((section) => section.required);
    const docs = baseline();
    const present = new Set(fileOf(docs, 'proposal').blocks.map((block) => block.section));

    expect(required.length).toBe(10);

    for (const section of required.filter((candidate) => present.has(candidate.name))) {
      const findings = validateDoc(fileOf(withoutSection(docs, 'proposal', section.name), 'proposal'));

      expect(findings.map((finding) => finding.code)).withContext(section.name).toEqual([
        'missing-required-section',
      ]);
      expect(findings[0].section).withContext(section.name).toBe(section.name);
    }
  });

  it('should flag each missing required design section on its own', () => {
    const required = sectionsFor('design').filter((section) => section.required);
    const docs = baseline();
    const present = new Set(fileOf(docs, 'design').blocks.map((block) => block.section));

    expect(required.length).toBe(10);

    for (const section of required.filter((candidate) => present.has(candidate.name))) {
      const findings = validateDoc(fileOf(withoutSection(docs, 'design', section.name), 'design'));

      expect(findings.map((finding) => finding.code)).withContext(section.name).toEqual([
        'missing-required-section',
      ]);
    }
  });

  it('should accept the older spelling of an aliased section', () => {
    const docs = baseline().map((doc) =>
      doc.file === 'proposal'
        ? {
            ...doc,
            blocks: doc.blocks.map((block) =>
              block.section === 'Target Signal'
                ? { ...block, section: 'Target Recruiter Signal' }
                : block,
            ),
          }
        : doc,
    );

    expect(codesOf(docs)).not.toContain('missing-required-section');
  });

  it('should flag a surviving placeholder as blocking', () => {
    const docs = baseline().map((doc) =>
      doc.file === 'proposal'
        ? {
            ...doc,
            blocks: doc.blocks.map((block) =>
              block.ord === 0 && block.section === 'Goal'
                ? {
                    ...block,
                    text: '{{MISSING: Why does this exist?}}',
                    origin: narrowOrigin(block.origin, 'missing') ?? block.origin,
                  }
                : block,
            ),
          }
        : doc,
    );

    const findings = validate(docs).filter((finding) => finding.code === 'placeholder-survives');

    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('block');
  });

  it('should flag a task list with fewer than 3 phases', () => {
    const docs = baseline().map((doc) =>
      doc.file === 'tasks'
        ? {
            ...doc,
            blocks: doc.blocks.filter(
              (block) =>
                !block.section.startsWith('Phase ') ||
                block.section === 'Phase 1: Contracts and scaffold' ||
                block.section === 'Phase 2: Core implementation',
            ),
          }
        : doc,
    );

    expect(codesOf(docs)).toContain('tasks-too-few-phases');
  });

  it('should flag a list item that is not a checkbox', () => {
    const docs = withBlocks(baseline(), 'tasks', [item('- `[G]` not a checkbox', 'tasks:bad:1')]);
    const findings = validate(docs).filter(
      (finding) =>
        finding.code === 'tasks-item-not-checkbox' || finding.code === 'tasks-item-untagged',
    );

    expect(findings.map((finding) => finding.code)).toEqual(['tasks-item-not-checkbox']);
  });

  it('should flag a list item with no tag', () => {
    const docs = withBlocks(baseline(), 'tasks', [item('- [ ] no tag here', 'tasks:bad:2')]);
    const findings = validate(docs).filter(
      (finding) =>
        finding.code === 'tasks-item-not-checkbox' || finding.code === 'tasks-item-untagged',
    );

    expect(findings.map((finding) => finding.code)).toEqual(['tasks-item-untagged']);
  });

  it('should flag a task list that does not end with a definition of done', () => {
    const docs = baseline().map((doc) =>
      doc.file === 'tasks'
        ? { ...doc, blocks: doc.blocks.filter((block) => block.section !== 'Definition of Done') }
        : doc,
    );

    expect(codesOf(docs)).toContain('tasks-missing-definition-of-done');
  });

  it('should warn outside 40 to 90 items and stay quiet at both edges', () => {
    const single = item('- [ ] `[G]` item', 'tasks:count:0');
    const docs = baseline();
    const base = fileOf(docs, 'tasks');
    const filler = base.blocks.filter((block) => block.text.trim().startsWith('-'));

    function withCount(count: number): GeneratedDoc[] {
      const extra: Block[] = [];

      for (let index = filler.length; index < count; index += 1) {
        extra.push({ ...single, id: `tasks:count:${index}` });
      }

      const kept = base.blocks.filter((block) => !block.text.trim().startsWith('-'));
      const items = [...filler, ...extra].slice(0, count);

      return docs.map((doc) => (doc.file === 'tasks' ? { ...doc, blocks: [...items, ...kept] } : doc));
    }

    const counts = [20, 39, 40, 90, 91];

    for (const count of counts) {
      const finds = validate(withCount(count)).filter((finding) => finding.code === 'tasks-item-count');

      if (count < TASK_ITEM_RANGE.min || count > TASK_ITEM_RANGE.max) {
        expect(finds.length).withContext(`${count} items`).toBe(1);
        expect(finds[0].severity).withContext(`${count} items`).toBe('warn');
      } else {
        expect(finds.length).withContext(`${count} items`).toBe(0);
      }
    }
  });
});
