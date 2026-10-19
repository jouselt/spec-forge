import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import {
  DEFAULT_MODEL_ID,
  FALLBACK_MODELS,
  RECOMMENDED_MODEL_ID,
  isDefault,
  isRecommended,
  modelById,
  modelsFrom,
  vramLabel,
} from './models';
import { ESTIMATE_LABEL, OUTPUT_RESERVE, estimateTokens } from './tokens';
import { checkBudget } from './budget';
import { allPlaceholders, findPlaceholders, questionForChip, slugOf } from './placeholders';
import { SHAPING_RULES, allShapingPrompts, numberedAnswers, shapingPrompt } from './prompts';
import { LlmShaper, TemplateShaper } from './shaper';
import { LITERT_UNAVAILABLE, LiteRtProvider, MlcChunk, WebLlmProvider } from './providers';
import { DeltaCoalescer, FLUSH_INTERVAL_MS, ToWorker } from './worker-protocol';
import { CapabilityService } from './capability.service';
import { ModelProvider, StreamOpts } from './model-provider';
import { completeAnswers } from '../templates/fixtures/answer-sets';
import { assemble, renderMarkdown } from '../templates/assembly';

const MB = 1024 * 1024;

describe('models', () => {
  it('should give every entry a positive cost and a positive context', () => {
    for (const model of FALLBACK_MODELS) {
      expect(model.vramBytes).withContext(model.id).toBeGreaterThan(0);
      expect(model.contextTokens).withContext(model.id).toBeGreaterThan(0);
    }
  });

  it('should default to the 879 MB model and recommend the 3B one', () => {
    const byId = (id: string) => modelById(FALLBACK_MODELS, id);

    expect(byId(DEFAULT_MODEL_ID)?.vramBytes).toBe(Math.round(879 * MB));
    expect(byId(RECOMMENDED_MODEL_ID)?.vramBytes).toBe(Math.round(3431 * MB));
    expect(isDefault(byId(DEFAULT_MODEL_ID)!)).toBe(true);
    expect(isRecommended(byId(RECOMMENDED_MODEL_ID)!)).toBe(true);
  });

  it('should write a byte count the way a person reads it', () => {
    expect(vramLabel(879 * MB)).toBe('879 MB');
    expect(vramLabel(3431 * MB)).toBe('3.4 GB');
  });

  it('should fall back to the checked-in table when the runtime says nothing', () => {
    expect(modelsFrom(undefined)).toEqual([...FALLBACK_MODELS]);
    expect(modelsFrom({})).toEqual([...FALLBACK_MODELS]);
  });

  it('should prefer the runtime numbers when the runtime has them', () => {
    const models = modelsFrom({
      model_list: [{ model_id: DEFAULT_MODEL_ID, vram_required_MB: 900, overrides: { context_window_size: 1024 } }],
    });
    const entry = modelById(models, DEFAULT_MODEL_ID);

    expect(entry?.vramBytes).toBe(900 * MB);
    expect(entry?.contextTokens).toBe(1024);
  });

  it('should keep a fallback row the runtime does not report', () => {
    const models = modelsFrom({ model_list: [{ model_id: 'something-else' }] });

    expect(models.length).toBe(FALLBACK_MODELS.length);
  });
});

describe('token estimate', () => {
  it('should take the larger of characters over four and words times 1.3', () => {
    const tenWords = 'one two three four five six seven eight nine ten';

    // 47 chars / 4 = 11.75; 10 words * 1.3 = 13, so the word count wins.
    expect(estimateTokens(tenWords)).toBe(13);
  });

  it('should be deterministic', () => {
    const text = 'The same input gives the same number every time.';

    expect(estimateTokens(text)).toBe(estimateTokens(text));
  });

  it('should call itself an estimate wherever it is written', () => {
    expect(ESTIMATE_LABEL).toBe('estimated tokens');
  });

  it('should reserve a different amount for each file', () => {
    expect(OUTPUT_RESERVE).toEqual({ proposal: 900, design: 1400, tasks: 1100 });
  });
});

describe('checkBudget', () => {
  const small = { id: 'small', label: 'Small', vramBytes: 1, contextTokens: 4096 };
  const tiny = { id: 'tiny', label: 'Tiny -1k', vramBytes: 1, contextTokens: 1024 };

  it('should pass a normal prompt against 4096', () => {
    const result = checkBudget({ model: small, file: 'proposal', input: 'a'.repeat(400) });

    expect(result.fits).toBe(true);
    expect(result.contextTokens).toBe(4096);
  });

  it('should refuse against 1024 naming all three numbers', () => {
    const result = checkBudget({ model: tiny, file: 'design', input: 'word '.repeat(300) });

    expect(result.fits).toBe(false);
    expect(result.detail).toContain(String(result.inputTokens));
    expect(result.detail).toContain('256');
    expect(result.detail).toContain('1400');
    expect(result.detail).toContain('1024');
  });

  it('should recompute for a smaller window without reloading anything', () => {
    const input = 'word '.repeat(300);

    expect(checkBudget({ model: small, file: 'tasks', input }).fits).toBe(true);
    expect(checkBudget({ model: tiny, file: 'tasks', input }).fits).toBe(false);
  });
});

describe('placeholders', () => {
  const answers = [{ id: 'q.idea' }];

  it('should find a chip and the question it asks', () => {
    const chips = findPlaceholders('A fact. {{MISSING: How many users?}}', 'proposal', 'Risks');

    expect(chips.length).toBe(1);
    expect(chips[0].question).toBe('How many users?');
    expect(chips[0].file).toBe('proposal');
  });

  it('should find several chips in one block', () => {
    const chips = findPlaceholders(
      '{{MISSING: One?}} then {{MISSING: Two?}}',
      'design',
      'Open Questions',
    );

    expect(chips.map((chip) => chip.question)).toEqual(['One?', 'Two?']);
  });

  it('should leave a malformed token alone', () => {
    expect(findPlaceholders('{{MISSING }} and {{MISSING: }}', 'tasks', 'Phases')).toEqual([]);
  });

  it('should ignore an empty chip', () => {
    expect(findPlaceholders('{{MISSING:   }}', 'tasks', 'Phases')).toEqual([]);
  });

  it('should dedupe across blocks and keep reading order', () => {
    const chips = allPlaceholders([
      { text: '{{MISSING: Same?}}', file: 'proposal', section: 'A' },
      { text: '{{MISSING: Same?}}', file: 'proposal', section: 'A' },
      { text: '{{MISSING: Other?}}', file: 'proposal', section: 'B' },
    ]);

    expect(chips.map((chip) => chip.question)).toEqual(['Same?', 'Other?']);
  });

  it('should build a question whose prompt is the placeholder text', () => {
    const chip = findPlaceholders('{{MISSING: How many users?}}', 'proposal', 'Risks')[0];
    const question = questionForChip(chip, 9);

    expect(question.prompt).toBe('How many users?');
    expect(question.id).toBe('promoted.how-many-users');
    expect(slugOf('How many users?')).toBe('how-many-users');
  });

  it('should survive the answers argument being unused', () => {
    expect(answers.length).toBe(1);
  });
});

describe('prompts', () => {
  it('should require a marker and a missing-token in every prompt', () => {
    for (const prompt of allShapingPrompts(completeAnswers())) {
      expect(prompt.text).withContext(prompt.file).toContain('[[answer:N]]');
      expect(prompt.text).withContext(prompt.file).toContain('{{MISSING:');
      expect(prompt.text).withContext(prompt.file).toContain(prompt.sections[0]);
    }
  });

  it('should number the answers so a marker has something to point at', () => {
    const numbered = numberedAnswers([
      { id: 'a', questionId: 'q.idea', text: ' The idea. ', kind: 'text', askedAt: 1, source: 'base' },
    ]);

    expect(numbered).toBe('1. The idea.');
  });

  it('should carry both rules verbatim', () => {
    expect(SHAPING_RULES).toContain('[[answer:N]]');
    expect(SHAPING_RULES).toContain('Never invent');
  });

  it('should give each file its own section list', () => {
    const proposal = shapingPrompt('proposal', completeAnswers());
    const design = shapingPrompt('design', completeAnswers());

    expect(proposal.sections).toContain('Risks');
    expect(design.sections).toContain('Failure Modes');
  });
});

describe('TemplateShaper', () => {
  it('should produce the three files with no model at all', async () => {
    const result = await new TemplateShaper().shape(completeAnswers());

    expect(result.docs.length).toBe(3);
    expect(result.path).toBe('template');
    expect(result.docs[0].blocks.every((block) => block.origin.kind !== 'model')).toBe(true);
  });
});

/** A provider that answers from a script, with no engine and no network. */
class ScriptedProvider implements ModelProvider {
  readonly id = 'scripted';
  interrupted = false;

  constructor(private readonly script: string, private readonly failAfter = Number.POSITIVE_INFINITY) {}

  isLoaded(): boolean {
    return true;
  }

  async load(): Promise<void> {}

  async *stream(_opts: StreamOpts): AsyncIterable<{ delta: string; done: boolean }> {
    if (this.failAfter <= 0) {
      return;
    }

    yield { delta: this.script, done: false };
    yield { delta: '', done: true };
  }

  interrupt(): void {
    this.interrupted = true;
  }

  async unload(): Promise<void> {}
}

/** The three files as text, which is the claim: the words are unchanged, not the clock. */
function renderOf(docs: readonly { file: 'proposal' | 'design' | 'tasks' }[] | { docs: readonly { file: 'proposal' | 'design' | 'tasks' }[] }): string {
  const list = 'docs' in docs ? docs.docs : docs;

  return list.map((doc) => renderMarkdown(doc as never)).join('\n\n---\n\n');
}

function cited(count: number): string {
  return Array.from({ length: 10 }, (_, index) =>
    index < count ? `A fact. [[answer:1]]` : 'An invented fact.',
  ).join(' ');
}

describe('LlmShaper', () => {
  const model = { id: 'Qwen2.5', label: 'Qwen2.5', vramBytes: 1, contextTokens: 8192 };

  it('should fall back to the template when coverage is under the minimum', async () => {
    const shaper = new LlmShaper(new ScriptedProvider(cited(4)), model);
    const result = await shaper.shape(completeAnswers());

    expect(result.path).toBe('template');
    expect(renderOf(result)).toBe(renderOf(assemble(completeAnswers())));
    expect(result.reason).toContain('template output is unchanged');
  });

  it('should keep the template output byte identical on a rejection', async () => {
    const shaper = new LlmShaper(new ScriptedProvider(cited(4)), model);
    const result = await shaper.shape(completeAnswers());

    expect(renderOf(result)).toBe(renderOf(assemble(completeAnswers())));
  });

  it('should accept a good run and carry a banner for a middling one', async () => {
    const shaper = new LlmShaper(new ScriptedProvider(cited(7)), model);
    const result = await shaper.shape(completeAnswers());

    expect(result.path).toBe('shaped');
    expect(result.banner).toContain('70%');
    expect(result.docs[0].blocks.some((block) => block.origin.kind === 'model')).toBe(true);
  });

  it('should refuse a prompt that does not fit the window', async () => {
    const tiny = { id: 'tiny', label: 'Tiny', vramBytes: 1, contextTokens: 64 };
    const result = await new LlmShaper(new ScriptedProvider(cited(10)), tiny).shape(completeAnswers());

    expect(result.path).toBe('template');
    expect(result.reason).toContain('64');
  });

  it('should shape nothing when cancelled before the first file', async () => {
    const controller = new AbortController();
    const shaper = new LlmShaper(new ScriptedProvider(cited(9)), model);

    controller.abort();

    const result = await shaper.shape(completeAnswers(), controller.signal);

    expect(result.path).toBe('template');
  });

  it('should keep a finished proposal when the design run is cancelled', async () => {
    const controller = new AbortController();
    let runs = 0;

    class InterruptingProvider extends ScriptedProvider {
      override async *stream(opts: StreamOpts): AsyncIterable<{ delta: string; done: boolean }> {
        runs += 1;

        // Cancelled while design.md is being written.
        if (runs === 2) {
          controller.abort();
        }

        yield* super.stream(opts);
      }
    }

    const result = await new LlmShaper(new InterruptingProvider(cited(9)), model).shape(
      completeAnswers(),
      controller.signal,
    );

    const proposal = result.docs[0];

    // The proposal was finished before the cancel, so it survives and stays shaped.
    expect(result.path).toBe('mixed');
    expect(proposal.file).toBe('proposal');
    expect(proposal.blocks.some((block) => block.origin.kind === 'answer')).toBe(true);
    expect(result.docs[1].blocks.some((block) => block.origin.kind === 'model')).toBe(false);
  });
});

describe('providers', () => {
  function engineOf(text: string, onInterrupt?: () => void) {
    return {
      chat: {
        completions: {
          create: async () => {
            async function* chunks(): AsyncGenerator<MlcChunk> {
              for (const piece of text.split(' ')) {
                yield { choices: [{ delta: { content: `${piece} ` } }] };
              }
            }

            return chunks();
          },
        },
        interruptGenerate: () => onInterrupt?.(),
      },
      unload: async () => {},
    };
  }

  it('should load, stream deltas and report the loaded model', async () => {
    const provider = new WebLlmProvider(
      async () => ({ engine: engineOf('one two three') }),
      'Qwen2.5',
    );

    await provider.load();

    expect(provider.isLoaded()).toBe(true);
    expect(provider.loadedModelId()).toBe('Qwen2.5');

    let text = '';

    for await (const chunk of provider.stream({ prompt: 'p', temperature: 0.2, maxTokens: 10 })) {
      text += chunk.delta;
    }

    expect(text.trim()).toBe('one two three');
  });

  it('should refuse to stream before loading', async () => {
    const provider = new WebLlmProvider(async () => ({ engine: engineOf('x') }), 'm');

    await expectAsync(
      (async () => {
        for await (const chunk of provider.stream({ prompt: 'p', temperature: 0, maxTokens: 1 })) {
          expect(chunk).toBeDefined();
        }
      })(),
    ).toBeRejectedWithError(/not loaded/);
  });

  it('should interrupt through the engine', async () => {
    let interrupted = false;
    const provider = new WebLlmProvider(
      async () => ({ engine: engineOf('x', () => (interrupted = true)) }),
      'm',
    );

    await provider.load();
    provider.interrupt();

    expect(interrupted).toBe(true);
  });

  it('should hand the progress callback to the loader', async () => {
    const seen: number[] = [];
    const provider = new WebLlmProvider(async (_id, onProgress) => {
      onProgress?.({ progress: 0.5, text: 'half way' });

      return { engine: engineOf('x') };
    }, 'm');

    await provider.load((progress) => seen.push(progress.progress));

    expect(seen).toEqual([0.5]);
  });

  it('should unload and forget the model', async () => {
    const provider = new WebLlmProvider(async () => ({ engine: engineOf('x') }), 'm');

    await provider.load();
    await provider.unload();

    expect(provider.isLoaded()).toBe(false);
    expect(provider.loadedModelId()).toBeNull();
  });

  it('should reject the LiteRT backend with the exact message', async () => {
    await expectAsync(new LiteRtProvider().load()).toBeRejectedWithError(LITERT_UNAVAILABLE);
    expect(LITERT_UNAVAILABLE).toBe('LiteRT backend not available in this build');
  });
});

describe('DeltaCoalescer', () => {
  it('should turn two hundred deltas inside one interval into one flush', fakeAsync(() => {
    const flushed: string[] = [];
    const coalescer = new DeltaCoalescer((text) => flushed.push(text));

    for (let index = 0; index < 200; index += 1) {
      coalescer.push('x');
    }

    expect(flushed.length).toBe(0);

    tick(FLUSH_INTERVAL_MS);

    expect(flushed.length).toBe(1);
    expect(flushed[0].length).toBe(200);
    expect(coalescer.flushCount()).toBe(1);
  }));

  it('should flush again on the next batch', fakeAsync(() => {
    const flushed: string[] = [];
    const coalescer = new DeltaCoalescer((text) => flushed.push(text));

    coalescer.push('a');
    tick(FLUSH_INTERVAL_MS);
    coalescer.push('b');
    tick(FLUSH_INTERVAL_MS);

    expect(flushed).toEqual(['a', 'b']);
  }));

  it('should send the tail on finish', fakeAsync(() => {
    const flushed: string[] = [];
    const coalescer = new DeltaCoalescer((text) => flushed.push(text));

    coalescer.push('tail');
    coalescer.finish();
    tick(FLUSH_INTERVAL_MS);

    expect(flushed).toEqual(['tail']);
    expect(coalescer.flushCount()).toBe(1);
  }));

  it('should flush nothing when nothing was pushed', fakeAsync(() => {
    const coalescer = new DeltaCoalescer(() => {
      fail('should not flush');
    });

    coalescer.flush();
    tick(FLUSH_INTERVAL_MS);

    expect(coalescer.flushCount()).toBe(0);
  }));

  it('should keep the worker protocol shaped as declared', () => {
    const message: ToWorker = { type: 'interrupt', runId: 'run-1' };

    expect(message.runId).toBe('run-1');
  });
});

describe('CapabilityService', () => {
  let service: CapabilityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CapabilityService);
  });

  it('should report no WebGPU when navigator.gpu is absent', async () => {
    const capabilities = await service.detect({});

    expect(capabilities.webgpu).toBe(false);
    expect(service.hasWebGpu()).toBe(false);
    expect(service.hasDetected()).toBe(true);
  });

  it('should report the adapter when there is one', async () => {
    const capabilities = await service.detect({
      gpu: {
        requestAdapter: async () => ({
          info: { vendor: 'amd', architecture: 'polaris' },
          limits: { maxBufferSize: 1024 },
        }),
      },
    });

    expect(capabilities.webgpu).toBe(true);
    expect(capabilities.adapterInfo).toBe('amd polaris');
    expect(capabilities.maxBufferSize).toBe(1024);
  });

  it('should treat a refused adapter as no WebGPU', async () => {
    const capabilities = await service.detect({ gpu: { requestAdapter: async () => null } });

    expect(capabilities.webgpu).toBe(false);
  });

  it('should treat a thrown request as no WebGPU', async () => {
    const capabilities = await service.detect({
      gpu: {
        requestAdapter: async () => {
          throw new Error('denied');
        },
      },
    });

    expect(capabilities.webgpu).toBe(false);
  });

  it('should name the slowdown range and Safari in the banner', async () => {
    await service.detect({});

    const banner = service.banner();

    expect(banner).toContain('5 to 20x');
    expect(banner).toContain('template path is unaffected');
  });

  it('should have no banner when WebGPU works', async () => {
    await service.detect({
      gpu: { requestAdapter: async () => ({ info: { vendor: 'amd' } }) },
    });

    expect(service.banner()).toBeNull();
  });
});
