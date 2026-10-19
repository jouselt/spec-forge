import {
  BUNDLE_NAME,
  ZIP_NAME,
  bundleMarkdown,
  copyText,
  fileMarker,
  filesFor,
  orderedDocs,
  zipMarkdown,
} from './export';
import { filenameFor, MARKDOWN_TYPE } from './download';
import { GeneratedDoc } from './question-graph';
import { assemble, renderMarkdown } from '../templates/assembly';
import { completeAnswers } from '../templates/fixtures/answer-sets';
import { importSpec } from './import-spec';

describe('download filenames', () => {
  it('should name the three files as the reader expects', () => {
    expect(filenameFor('proposal')).toBe('proposal.md');
    expect(filenameFor('design')).toBe('design.md');
    expect(filenameFor('tasks')).toBe('tasks.md');
  });

  it('should call a markdown file markdown', () => {
    expect(MARKDOWN_TYPE).toBe('text/markdown');
  });

  it('should name the bundle and the zip', () => {
    expect(BUNDLE_NAME).toBe('spec-bundle.md');
    expect(ZIP_NAME).toBe('spec-bundle.zip');
  });
});

describe('orderedDocs', () => {
  function docs(): GeneratedDoc[] {
    return assemble(completeAnswers());
  }

  it('should read proposal, design, tasks in that order whatever the input order', () => {
    const shuffled = [docs()[2], docs()[0], docs()[1]];

    expect(orderedDocs(shuffled).map((doc) => doc.file)).toEqual([
      'proposal',
      'design',
      'tasks',
    ]);
  });

  it('should drop the files that do not exist yet', () => {
    const imported = importSpec('## Problem\n\nMine.\n');

    expect(orderedDocs([imported.doc]).map((doc) => doc.file)).toEqual(['proposal']);
  });

  it('should keep the documents it was given', () => {
    const all = docs();

    expect(orderedDocs(all).length).toBe(3);
  });
});

describe('bundleMarkdown', () => {
  it('should separate the three files with a marker naming each', () => {
    const docs = assemble(completeAnswers());
    const bundle = bundleMarkdown(docs);

    expect(bundle).toContain(fileMarker('proposal'));
    expect(bundle).toContain(fileMarker('design'));
    expect(bundle).toContain(fileMarker('tasks'));
    expect(bundle.indexOf('<!-- FILE: proposal.md -->')).toBeLessThan(
      bundle.indexOf('<!-- FILE: design.md -->'),
    );
    expect(bundle.indexOf('<!-- FILE: design.md -->')).toBeLessThan(
      bundle.indexOf('<!-- FILE: tasks.md -->'),
    );
  });

  it('should carry the same text the single download would', () => {
    const docs = assemble(completeAnswers());
    const bundle = bundleMarkdown(docs);

    for (const doc of docs) {
      expect(bundle).toContain(renderMarkdown(doc));
    }
  });

  it('should mark unreviewed inferences when asked to', () => {
    const docs = assemble(completeAnswers());
    const marked = docs.map((doc) => ({
      ...doc,
      blocks: doc.blocks.map((block, index) =>
        index === 0
          ? {
              ...block,
              origin: {
                kind: 'model' as const,
                modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1',
                basedOn: [],
                temperature: 0.2,
              },
            }
          : block,
      ),
    }));

    expect(bundleMarkdown(marked, { markUnreviewedInferred: true })).toContain(
      '<!-- INFERRED: unreviewed -->',
    );
    expect(bundleMarkdown(marked)).not.toContain('<!-- INFERRED: unreviewed -->');
  });

  it('should be empty when there is nothing to export', () => {
    expect(bundleMarkdown([])).toBe('');
  });

  it('should export a single imported file without empty headers for the others', () => {
    const imported = importSpec('## Problem\n\nMine.\n');
    const bundle = bundleMarkdown([imported.doc]);

    expect(bundle).toContain(fileMarker('proposal'));
    expect(bundle).not.toContain('design.md -->');
    expect(bundle).toContain('Mine.');
  });
});

describe('filesFor', () => {
  it('should produce one entry per file, named for a zip', () => {
    const files = filesFor(assemble(completeAnswers()));

    expect(Object.keys(files)).toEqual(['proposal.md', 'design.md', 'tasks.md']);
  });

  it('should hold the rendered text, not the blocks', () => {
    const docs = assemble(completeAnswers());
    const files = filesFor(docs);

    expect(files['proposal.md']).toBe(renderMarkdown(docs[0]));
  });
});

describe('zipMarkdown', () => {
  it('should produce a zip whose entries are the three files', async () => {
    const { unzipSync, strFromU8 } = await import('fflate');
    const docs = assemble(completeAnswers());
    const bytes = await zipMarkdown(docs);
    const entries = unzipSync(bytes);

    expect(Object.keys(entries).sort()).toEqual(['design.md', 'proposal.md', 'tasks.md']);
    expect(strFromU8(entries['proposal.md'])).toBe(renderMarkdown(docs[0]));
  });

  it('should start with the zip magic number', async () => {
    const bytes = await zipMarkdown(assemble(completeAnswers()));

    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
  });

  it('should carry an imported file with its provenance intact', async () => {
    const { unzipSync, strFromU8 } = await import('fflate');
    const bytes = await zipMarkdown([importSpec('## Problem\n\nA sentence of mine.\n').doc]);
    const entries = unzipSync(bytes);

    expect(Object.keys(entries)).toEqual(['proposal.md']);
    expect(strFromU8(entries['proposal.md'])).toContain('A sentence of mine.');
  });
});

describe('copyText', () => {
  it('should write the text and hand it back', async () => {
    const written: string[] = [];
    const sink = {
      writeText: async (text: string) => {
        written.push(text);
      },
    };

    const copied = await copyText('the whole document', sink);

    expect(written).toEqual(['the whole document']);
    expect(copied).toBe('the whole document');
  });

  it('should say what to do instead when the clipboard is unavailable', async () => {
    await expectAsync(copyText('anything', null)).toBeRejectedWithError(
      /clipboard is unavailable.*Use Download instead/s,
    );
  });

  it('should copy the bundle exactly as it would be downloaded', async () => {
    const docs = assemble(completeAnswers());
    let copied = '';

    await copyText(bundleMarkdown(docs), {
      writeText: async (text: string) => {
        copied = text;
      },
    });

    expect(copied).toBe(bundleMarkdown(docs));
  });
});
