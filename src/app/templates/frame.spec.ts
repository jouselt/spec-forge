import {
  ALTERNATIVE_PATTERN,
  AnswerShape,
  DEPLOY_STACK_PATTERN,
  FrameContext,
  MEASURABLE_PATTERN,
  MODEL_STACK_PATTERN,
  NON_GOAL_PATTERN,
  STORAGE_STACK_PATTERN,
  TemplateFrame,
  UNMEASURED_PATTERN,
  fillFrame,
  frameTokens,
  renderFrame,
} from './frame';

const context: FrameContext = {
  values: { name: 'notes vault', proof: '24 of 24 citations resolve' },
  lists: {
    stack_entries: [
      { text: 'Angular 20', label: 'Angular 20', value: '' },
      { text: 'SQLite', label: 'SQLite', value: '' },
      { text: '', label: '', value: '' },
    ],
  },
  sources: { name: ['q.idea'], proof: ['q.proof'] },
  listSources: { stack_entries: ['q.stack'] },
};

describe('template frames', () => {
  describe('frameTokens', () => {
    it('reads the tokens in order', () => {
      expect(frameTokens('{name}: {proof} in {name}')).toEqual(['name', 'proof']);
    });

    it('returns nothing for text without tokens', () => {
      expect(frameTokens('no tokens here')).toEqual([]);
    });
  });

  describe('fillFrame', () => {
    it('replaces every token from the context', () => {
      expect(fillFrame('Build {name}: {proof}.', context.values)).toBe('Build notes vault: 24 of 24 citations resolve.');
    });

    it('throws on a token the context does not define', () => {
      expect(() => fillFrame('Build {missing}', context.values)).toThrowError(/not in the render context/);
    });
  });

  describe('renderFrame', () => {
    it('renders a prose frame once', () => {
      const frame: TemplateFrame = { id: 'p', kind: 'prose', text: 'Proof: {proof}', when: () => true };

      expect(renderFrame(frame, context)).toEqual(['Proof: 24 of 24 citations resolve']);
    });

    it('renders a line frame once per entry', () => {
      const frame: TemplateFrame = { id: 's', kind: 'bullet', text: 'Add {item}', when: () => true, each: 'stack_entries' };

      expect(renderFrame(frame, context)).toEqual(['Add Angular 20', 'Add SQLite']);
    });

    it('renders a line frame once when it has no each list', () => {
      const frame: TemplateFrame = { id: 'c', kind: 'check', text: 'Assert {proof}', when: () => true };

      expect(renderFrame(frame, context)).toEqual(['Assert 24 of 24 citations resolve']);
    });

    it('renders nothing for an each list that is not in the context', () => {
      const frame: TemplateFrame = { id: 'x', kind: 'bullet', text: 'Add {item}', when: () => true, each: 'nope' };

      expect(renderFrame(frame, context)).toEqual([]);
    });

    it('exposes the label and the value of a table entry', () => {
      const tableContext: FrameContext = {
        ...context,
        lists: { constraint_entries: [{ text: 'p99: under 100ms', label: 'p99', value: 'under 100ms' }] },
      };
      const frame: TemplateFrame = { id: 't', kind: 'check', text: '{item_label}: {item_value}', when: () => true, each: 'constraint_entries' };

      expect(renderFrame(frame, tableContext)).toEqual(['p99: under 100ms']);
    });
  });

  describe('shape patterns', () => {
    it('reads a number as measurable', () => {
      expect(MEASURABLE_PATTERN.test('Loads in under 2s')).toBe(true);
      expect(MEASURABLE_PATTERN.test('It works')).toBe(false);
    });

    it('recognizes the unmeasured answer the help text asks for', () => {
      expect(UNMEASURED_PATTERN.test('none measured yet')).toBe(true);
      expect(UNMEASURED_PATTERN.test('None')).toBe(true);
      expect(UNMEASURED_PATTERN.test('n/a')).toBe(true);
      expect(UNMEASURED_PATTERN.test('p95 under 150 ms')).toBe(false);
    });

    it('recognizes a sentence that states what the work is not', () => {
      expect(NON_GOAL_PATTERN.test('Do not build a mobile client and do not add shared vaults.')).toBe(true);
      expect(NON_GOAL_PATTERN.test('Turn a highlight into a card in one gesture.')).toBe(false);
    });

    it('recognizes a stack answer that names inference or a datastore', () => {
      expect(MODEL_STACK_PATTERN.test('Ollama with mistral-nemo for card suggestions')).toBe(true);
      expect(MODEL_STACK_PATTERN.test('PostgreSQL 16 with pgvector')).toBe(false);
      expect(STORAGE_STACK_PATTERN.test('SQLite compiled to WASM for local storage')).toBe(true);
      expect(STORAGE_STACK_PATTERN.test('PostgreSQL 16 with pgvector')).toBe(true);
      expect(STORAGE_STACK_PATTERN.test('Angular 20 with signals')).toBe(false);
    });

    it('recognizes where the thing runs', () => {
      expect(DEPLOY_STACK_PATTERN.test('Cloudflare Pages for the static build')).toBe(true);
      expect(DEPLOY_STACK_PATTERN.test('NixOS module on the homelab behind Caddy')).toBe(true);
      expect(DEPLOY_STACK_PATTERN.test('Angular 20 with signals')).toBe(false);
    });

    it('recognizes the clause that names what to build first', () => {
      expect(ALTERNATIVE_PATTERN.test('Build the marker validator first instead.')).toBe(true);
      expect(ALTERNATIVE_PATTERN.test('The model may ignore the protocol.')).toBe(false);
    });
  });

  describe('AnswerShape', () => {
    it('is a plain predicate interface a template can be handed', () => {
      const shape: AnswerShape = {
        has: (id) => id === 'q.idea',
        count: (id) => (id === 'q.stack' ? 4 : 0),
        matches: (id, pattern) => pattern.test(id === 'q.proof' ? 'under 300 ms' : ''),
      };

      const frame: TemplateFrame = { id: 'f', kind: 'prose', text: '{name}', when: (candidate) => candidate.has('q.idea') };

      expect(frame.when(shape)).toBe(true);
      expect(shape.count('q.stack')).toBe(4);
    });
  });
});
