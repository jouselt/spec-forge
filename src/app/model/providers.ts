/**
 * The two backends, and the shape the app talks to them through.
 *
 * `@mlc-ai/web-llm` is not a dependency of this project. That is deliberate: it is several
 * megabytes, it downloads a model from a CDN at runtime, and it only does anything where
 * WebGPU exists. The app therefore talks to a narrow `MlcEngine` interface, and the module
 * that would `import('@mlc-ai/web-llm')` is resolved at runtime and nowhere earlier.
 *
 * The practical consequence is that `WebLlmProvider` is fully testable with a fake engine,
 * and CI never downloads a byte.
 */

import { LoadProgress, ModelProvider, StreamChunk, StreamOpts } from './model-provider';
import { PrebuiltConfig } from './models';

/** The one method this app needs from a chat completion stream. */
export interface MlcChunk {
  readonly choices?: readonly { readonly delta?: { readonly content?: string } }[];
}

/** The slice of an MLC engine the provider uses. */
export interface MlcEngine {
  readonly chat: {
    readonly completions: {
      create(request: {
        readonly messages: readonly { readonly role: 'system' | 'user'; readonly content: string }[];
        readonly stream: true;
        readonly temperature: number;
        readonly max_tokens: number;
      }): Promise<AsyncIterable<MlcChunk> | MlcChunk>;
    };
    readonly interruptGenerate: () => void;
  };
  readonly unload: () => Promise<void>;
}

/** What a loader hands back, plus the table the runtime reports. */
export interface LoadedEngine {
  readonly engine: MlcEngine;
  readonly prebuilt?: PrebuiltConfig;
}

/** Anything that can produce an engine. The real one imports the library; a test passes a stub. */
export type EngineLoader = (
  modelId: string,
  onProgress?: (progress: LoadProgress) => void,
) => Promise<LoadedEngine>;

/** The error message a backend that is not in this build gives. */
export const LITERT_UNAVAILABLE = 'LiteRT backend not available in this build';

export class WebLlmProvider implements ModelProvider {
  readonly id = 'webllm';

  private engine: MlcEngine | null = null;
  private loadedModel: string | null = null;

  constructor(
    private readonly loader: EngineLoader,
    private readonly modelId: string,
  ) {}

  isLoaded(): boolean {
    return this.engine !== null;
  }

  loadedModelId(): string | null {
    return this.loadedModel;
  }

  async load(onProgress?: (progress: LoadProgress) => void): Promise<void> {
    if (this.engine) {
      return;
    }

    const loaded = await this.loader(this.modelId, onProgress);

    this.engine = loaded.engine;
    this.loadedModel = this.modelId;
  }

  async *stream(opts: StreamOpts): AsyncIterable<StreamChunk> {
    const engine = this.engine;

    if (!engine) {
      throw new Error('The model is not loaded. Load it before shaping.');
    }

    const response = await engine.chat.completions.create({
      messages: [{ role: 'user', content: opts.prompt }],
      stream: true,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    });

    // A fake engine in a test may answer all at once; the real one streams.
    if (!isAsyncIterable(response)) {
      yield { delta: textOf(response), done: true };
      return;
    }

    for await (const chunk of response) {
      if (opts.signal?.aborted) {
        engine.chat.interruptGenerate();
        return;
      }

      const delta = textOf(chunk);

      if (delta.length > 0) {
        yield { delta, done: false };
      }
    }

    yield { delta: '', done: true };
  }

  interrupt(): void {
    this.engine?.chat.interruptGenerate();
  }

  async unload(): Promise<void> {
    if (!this.engine) {
      return;
    }

    await this.engine.unload();
    this.engine = null;
    this.loadedModel = null;
  }
}

function isAsyncIterable(value: unknown): value is AsyncIterable<MlcChunk> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

function textOf(chunk: MlcChunk | AsyncIterable<MlcChunk>): string {
  if (!('choices' in chunk)) {
    return '';
  }

  return chunk.choices?.[0]?.delta?.content ?? '';
}

/**
 * The backend this build does not have.
 *
 * It exists rather than being absent so the picker can offer it, be chosen, and fail with a
 * sentence a person can act on. A backend that is missing from a list is indistinguishable
 * from a bug.
 */
export class LiteRtProvider implements ModelProvider {
  readonly id = 'litert';

  isLoaded(): boolean {
    return false;
  }

  async load(): Promise<void> {
    throw new Error(LITERT_UNAVAILABLE);
  }

  // eslint-disable-next-line require-yield
  async *stream(): AsyncIterable<StreamChunk> {
    throw new Error(LITERT_UNAVAILABLE);
  }

  interrupt(): void {
    // Nothing is running.
  }

  async unload(): Promise<void> {
    // Nothing was loaded.
  }
}
