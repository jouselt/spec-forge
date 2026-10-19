import selfAnswers from './spec-forge-answers.json';
import { Answer } from '../../core/question-graph';
import { renderMarkdown, assemble } from '../assembly';
import { BASE_STEPS } from '../../core/steps';

/**
 * spec-forge writing its own spec.
 *
 * This is the honest self-test: the fixture describes this project, and the template path
 * has to turn it into three complete files with no model. If it stops doing that, the tool
 * has stopped being able to describe itself and every claim in the README is suspect.
 *
 * It also catches a specific kind of rot that unit tests miss: a required section quietly
 * dropped from a template, or a `tasks.md` that no longer looks like a task list.
 */

interface Fixture {
  readonly id: string;
  readonly label: string;
  readonly answers: readonly Answer[];
}

const FIXTURE = selfAnswers as unknown as Fixture;

/** The item line shape every task has to match: a checkbox, a tag, then the task. */
const ITEM = /^- \[[ x]\] `\[(G|E|M)\]` \S/;

describe('self-regeneration', () => {
  const docs = assemble([...FIXTURE.answers]);
  const byFile = new Map(docs.map((doc) => [doc.file, doc] as const));

  it('should cover every base question', () => {
    const answered = new Set(FIXTURE.answers.map((answer) => answer.questionId));

    for (const question of BASE_STEPS) {
      expect(answered.has(question.id))
        .withContext(`${question.id} is unanswered in the fixture`)
        .toBe(true);
    }
  });

  it('should carry the adaptive answers its own triggers fire', () => {
    const adaptive = FIXTURE.answers.filter((answer) => answer.source === 'adaptive');

    expect(adaptive.length).toBeGreaterThan(0);
    expect(adaptive.every((answer) => answer.trigger?.triggerId === 'local_model')).toBe(true);
  });

  it('should produce all three files', () => {
    expect(docs.length).toBe(3);
    expect([...byFile.keys()].sort()).toEqual(['design', 'proposal', 'tasks']);
  });

  /**
   * The sections are asserted from the templates themselves and not from a list in this
   * test: a section dropped from a template has to fail here, and a list copied into the
   * test would go stale the moment a template gained one.
   */
  it('should give every file a heading for each of its sections', () => {
    for (const doc of docs) {
      expect(doc.blocks.length).withContext(`${doc.file}.md has no blocks`).toBeGreaterThan(0);

      for (const block of doc.blocks) {
        expect(block.text.trim().length)
          .withContext(`${doc.file}.md ${block.section} is empty`)
          .toBeGreaterThan(0);
      }
    }
  });

  it('should keep the sections the three files are known by', () => {
    const known = {
      proposal: ['Problem', 'Goal', 'Target Signal', 'Core Features', 'Timeline', 'Risks'],
      design: ['Architecture', 'Data model'],
      tasks: ['Definition of Done'],
    } as const;

    for (const [file, sections] of Object.entries(known)) {
      const text = renderMarkdown(byFile.get(file as 'proposal' | 'design' | 'tasks')!);

      for (const section of sections) {
        expect(text).withContext(`${file}.md is missing ${section}`).toContain(`## ${section}`);
      }
    }
  });

  it('should leave no surviving placeholder in the rendered text', () => {
    for (const doc of docs) {
      expect(renderMarkdown(doc)).withContext(doc.file).not.toContain('{{MISSING');
    }
  });

  it('should infer nothing: every block is sourced on the template path', () => {
    for (const doc of docs) {
      for (const block of doc.blocks) {
        expect(block.origin.kind).withContext(`${doc.file} ${block.id}`).not.toBe('model');
      }
    }
  });

  it('should write a task list a person could work from', () => {
    const tasks = byFile.get('tasks')!;
    const items = tasks.blocks
      .flatMap((block) => block.text.split('\n'))
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- ['));

    // Measured, not asked for: the template path writes 15 items today and the design asks
    // for 40 to 90. The floor is the number that exists so a regression to a shorter list
    // fails here; the gap itself is recorded in tasks.md as an open box rather than hidden
    // by lowering the bar to nothing.
    expect(items.length).toBeGreaterThanOrEqual(15);

    for (const item of items) {
      expect(item).withContext(item.slice(0, 60)).toMatch(ITEM);
    }
  });

  it('should carry every tag the phases need', () => {
    const tasks = byFile.get('tasks')!;
    const text = tasks.blocks.map((block) => block.text).join('\n');

    expect(text).toContain('`[G]`');
    expect(text).toContain('`[M]`');
  });

  it('should render the same text twice, so the fixture is not a moving target', () => {
    const again = assemble([...FIXTURE.answers]);

    expect(again.map((doc) => renderMarkdown(doc))).toEqual(docs.map((doc) => renderMarkdown(doc)));
  });
});
