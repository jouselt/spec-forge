import { classifyTag, itemLine } from './tasks.tpl';

/**
 * Fifteen items copied from the sibling specs in `portfolio-projects`, each with
 * the tag its own author gave it. The classifier is keyword-based and the tag is
 * always editable, so the bar is "mostly right", not "always right".
 *
 * Two of the fifteen miss, and both are honest misses rather than bugs:
 * - an `[E]` item whose wording ends "test the text is present" reads as a gate
 *   test, and the classifier takes the word `test`;
 * - a `[G]` item that writes a migration file without ever saying "migration"
 *   has no keyword a classifier can read.
 *
 * The threshold of 12 of 15 is the one the task list sets.
 */
const REAL_ITEMS: readonly { from: string; tag: 'G' | 'E' | 'M'; text: string }[] = [
  {
    from: '12-spec-forge',
    tag: 'G',
    text: 'The follow-up reason: `describeTrigger()` renders "Asked because you mentioned {phrase} in step {step}", or "in a follow-up question" when the answer that fired the trace was itself adaptive; the panel shows it as a paragraph, the rail shows it under the prompt with a "Follow-up" tag, and the store spec asserts the sentence from a real trace',
  },
  {
    from: '12-spec-forge',
    tag: 'G',
    text: 'Test the counters that ship: the header reads "N of M answered", the panel "Question N of M", and the footer "N out of M". Tests cover 0 of 9, the growth to 12 when the `local_model` follow-ups appear, the shrink back to 9 when the keyword goes, and the moving current segment',
  },
  {
    from: '12-spec-forge',
    tag: 'M',
    text: 'Kill the tab at step 7, reopen, confirm nothing was lost including the adaptive badge state',
  },
  {
    from: '12-spec-forge',
    tag: 'E',
    text: 'Readability eval: assemble 5 real answer sets; a human rates each generated `proposal.md` 1 to 5 on "reads like a person wrote it"; record the mean and require at least 3.0 for the template path to ship as the default',
  },
  {
    from: '12-spec-forge',
    tag: 'M',
    text: 'DevTools Performance: main thread idle while shaping; typing in an answer input never blocks',
  },
  {
    from: '12-spec-forge',
    tag: 'E',
    text: 'WASM fallback banner states the 5 to 20x slowdown range and names Safari when applicable; test the text is present',
  },
  {
    from: '12-spec-forge',
    tag: 'M',
    text: 'Complete a full interview with no model loaded and confirm zero inferred blocks appear',
  },
  {
    from: 'md-skill-forge',
    tag: 'G',
    text: 'Scaffold Angular 20 app: `ng new md-skill-forge --standalone --style=scss --routing=false`; enable `"strict": true` and `"strictTemplates": true` in `tsconfig.json`; confirm `npm run build` succeeds',
  },
  {
    from: 'md-skill-forge',
    tag: 'G',
    text: 'Install CodeMirror 6 (`codemirror`, `@codemirror/lang-markdown`, `@codemirror/view`, `@codemirror/state`); wrap in `MarkdownEditorComponent` with `[value]` input and `(valueChange)` output; test that a value set programmatically appears in the editor',
  },
  {
    from: 'md-skill-forge',
    tag: 'G',
    text: 'Test `estimate()` is deterministic (10 identical calls, 1 result) and monotonic (adding text never lowers the estimate)',
  },
  {
    from: 'md-skill-forge',
    tag: 'M',
    text: 'Tooltip states the exact formula and the words "estimate, not a tokenizer"',
  },
  {
    from: 'md-skill-forge',
    tag: 'M',
    text: 'Verify on Chrome with `--disable-unsafe-webgpu`: banner appears, app still runs',
  },
  {
    from: 'md-skill-forge',
    tag: 'G',
    text: '`CapabilityService`: `detect()` returns `{ webgpu: boolean, adapterInfo?: string, maxBufferSize?: number }` using `navigator.gpu` and `requestAdapter()`; test the absent-`navigator.gpu` branch by deleting the property',
  },
  {
    from: 'md-skill-forge',
    tag: 'E',
    text: 'Shaping eval: 5 answer sets, 3B model, 15 files; assert at least 12 of 15 runs score marker coverage at or above 0.80, and a human judge finds zero facts in the marked sentences that the cited answer does not support',
  },
  {
    from: '01-ai-digital-twin-portfolio',
    tag: 'G',
    text: 'Write `infra/sql/001_init.sql`: `CREATE EXTENSION vector`, `projects`, `chunks` with `embedding vector(768) NOT NULL`, `content_hash char(64)`, `UNIQUE (project_id, ord)`, `leads`.',
  },
];

describe('the tasks tag classifier', () => {
  it('is fed fifteen real items from the sibling specs', () => {
    expect(REAL_ITEMS.length).toBe(15);
  });

  it('matches at least 12 of the 15 tags its authors gave them', () => {
    const matches = REAL_ITEMS.filter((item) => classifyTag(item.text) === item.tag);

    expect(matches.length).withContext(`matched ${matches.length} of ${REAL_ITEMS.length}`).toBeGreaterThanOrEqual(12);
  });

  it('tags an item that names a threshold as an eval', () => {
    expect(classifyTag('Record the p95 latency and compare it against the threshold.')).toBe('E');
    expect(classifyTag('Sample 20 runs and record the mean.')).toBe('E');
    expect(classifyTag('Call the model and check the marker coverage.')).toBe('E');
  });

  it('tags an item a unit test or a fixture can hold as a gate', () => {
    expect(classifyTag('Add a fixture for the parser and assert the output.')).toBe('G');
    expect(classifyTag('confirm `npm run build` succeeds')).toBe('G');
    expect(classifyTag('Write the schema migration and run it against a throwaway database.')).toBe('G');
  });

  it('tags everything else as manual verification', () => {
    expect(classifyTag('Kill the tab at step 7 and reopen it.')).toBe('M');
    expect(classifyTag('Deploy with Cloudflare Pages and open the built site.')).toBe('M');
  });

  it('writes the item line the corpus uses', () => {
    expect(itemLine('Add a fixture for the parser.', 'G')).toBe('- [ ] `[G]` Add a fixture for the parser.');
  });

  it('guesses the tag when the caller does not pass one', () => {
    expect(itemLine('Add a fixture for the parser.')).toBe('- [ ] `[G]` Add a fixture for the parser.');
    expect(itemLine('Kill the tab and reopen it.')).toBe('- [ ] `[M]` Kill the tab and reopen it.');
  });

  it('produces a tagged line for every item the generator emits', () => {
    for (const item of REAL_ITEMS) {
      expect(itemLine(item.text)).toMatch(/^- \[ \] `\[(G|E|M)\]` /);
    }
  });
});
