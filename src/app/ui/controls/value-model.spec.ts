import {
  choiceOptions,
  emptyRow,
  parseList,
  parseTable,
  serializeList,
  serializeTable,
  TableRow,
} from './value-model';
import { Question } from '../../core/question-graph';

function choiceQuestion(help: string, id = 'q.test'): Question {
  return { id, step: 1, prompt: 'Pick one', help, kind: 'choice', required: false };
}

describe('list values', () => {
  it('should split a stored answer into one item per line', () => {
    expect(parseList('Angular\nNode.js\nDocker')).toEqual(['Angular', 'Node.js', 'Docker']);
  });

  it('should always offer one empty row', () => {
    expect(parseList('')).toEqual(['']);
  });

  it('should round trip a list through the stored form', () => {
    const items = ['Angular 20', 'Node.js', 'PostgreSQL'];

    expect(parseList(serializeList(items))).toEqual(items);
  });

  it('should keep blank lines, so an added row survives a re-render', () => {
    expect(parseList(serializeList(['Angular', '']))).toEqual(['Angular', '']);
  });
});

describe('table values', () => {
  it('should start with a single empty row', () => {
    expect(parseTable('')).toEqual([emptyRow()]);
  });

  it('should split cells on the pipe separator', () => {
    expect(parseTable('P99 latency | 100ms')).toEqual([{ label: 'P99 latency', value: '100ms' }]);
  });

  it('should keep a row with no separator as a label', () => {
    expect(parseTable('No constraints measured yet')).toEqual([
      { label: 'No constraints measured yet', value: '' },
    ]);
  });

  it('should round trip rows through the stored form', () => {
    const rows: TableRow[] = [
      { label: 'P99 latency', value: '100ms' },
      { label: 'Peak throughput', value: '10K qps' },
    ];

    expect(parseTable(serializeTable(rows))).toEqual(rows);
  });

  it('should trim the cells it reads back', () => {
    expect(parseTable('  Budget  |  $0  ')).toEqual([{ label: 'Budget', value: '$0' }]);
  });
});

describe('choiceOptions()', () => {
  it('should read quoted examples from the help text', () => {
    const question = choiceQuestion('E.g., "Stripe", "PayPal", "Square", "custom".');

    expect(choiceOptions(question)).toEqual(['Stripe', 'PayPal', 'Square', 'custom']);
  });

  it('should read a trailing either/or sentence', () => {
    const question = choiceQuestion('WASM is 5-20x slower but works everywhere. Yes or No.');

    expect(choiceOptions(question)).toEqual(['Yes', 'No']);
  });

  it('should drop a parenthetical from an option', () => {
    expect(choiceOptions(choiceQuestion('Required or Optional (WASM fallback).'))).toEqual([
      'Required',
      'Optional',
    ]);
    expect(choiceOptions(choiceQuestion('Yes or No (classic Nix).'))).toEqual(['Yes', 'No']);
  });

  it('should read a comma separated list', () => {
    expect(choiceOptions(choiceQuestion('E.g., Express, Fastify, or auto-detect.'))).toEqual([
      'Express',
      'Fastify',
      'auto-detect',
    ]);
  });

  it('should read a short either/or without a period', () => {
    expect(choiceOptions(choiceQuestion('Standalone or Modules'))).toEqual([
      'Standalone',
      'Modules',
    ]);
  });

  it('should dedupe repeated options', () => {
    expect(choiceOptions(choiceQuestion('Pick one. Yes or Yes'))).toEqual(['Yes']);
  });

  it('should return nothing when the question or help is missing', () => {
    expect(choiceOptions(null)).toEqual([]);
    expect(choiceOptions(choiceQuestion(''))).toEqual([]);
  });

  it('should refuse prose that only looks like options', () => {
    const question = choiceQuestion(
      'Be specific about who, not vague. "Developers building real-time dashboards" not "people".',
    );

    expect(choiceOptions(question)).toEqual([]);
  });

  it('should return nothing for a help line with no options', () => {
    expect(choiceOptions(choiceQuestion('E.g., 8, 16, 32. Larger models need more.'))).toEqual([]);
  });
});
