/**
 * The seam between this app and any model.
 *
 * Nothing outside `model/` knows which backend is running, and the template path never
 * touches this file at all. That is the arrangement that makes the model optional rather
 * than load-bearing: the app's promises (provenance, the gate, the export) hold with the
 * model switched off, and the model only ever changes where a sentence came from.
 *
 * No `any` anywhere in here on purpose. A provider that lies about its shape is worse
 * than a provider that does not compile.
 */

/** What a model costs and what it can hold. Both numbers are read from the runtime when available. */
export interface ModelInfo {
  /** The id the runtime knows it by, e.g. `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`. */
  readonly id: string;
  /** What a person reads in the picker. */
  readonly label: string;
  /** Weights on disk, in bytes. */
  readonly vramBytes: number;
  /** Total context window, in tokens. */
  readonly contextTokens: number;
}

/** How far a load has got, for a progress bar and a sentence. */
export interface LoadProgress {
  readonly progress: number;
  readonly text: string;
}

/** One delta from a stream, or the end of it. */
export interface StreamChunk {
  readonly delta: string;
  readonly done: boolean;
}

/** The knobs a shaping run is allowed to set. */
export interface StreamOpts {
  readonly prompt: string;
  readonly temperature: number;
  readonly maxTokens: number;
  /** Checked between decode steps. Cancelling is cooperative, never a kill. */
  readonly signal?: AbortSignal;
}

/** Anything that can produce text. */
export interface ModelProvider {
  readonly id: string;
  isLoaded(): boolean;
  load(onProgress?: (progress: LoadProgress) => void): Promise<void>;
  stream(opts: StreamOpts): AsyncIterable<StreamChunk>;
  /** Stop the run in flight, leaving the engine loaded. */
  interrupt(): void;
  unload(): Promise<void>;
}

/** What the browser can do, decided once and shown as a banner when it cannot. */
export interface Capabilities {
  readonly webgpu: boolean;
  readonly adapterInfo?: string;
  readonly maxBufferSize?: number;
}

/** The measured slowdown of the WASM path, as a range, because it is a range. */
export const WASM_SLOWDOWN = '5 to 20x';

/** What the banner says when WebGPU is missing. */
export function wasmBanner(capabilities: Capabilities): string | null {
  if (capabilities.webgpu) {
    return null;
  }

  const safari =
    typeof navigator !== 'undefined' && /Safari/i.test(navigator.userAgent)
      ? ' Safari needs a recent version with WebGPU enabled.'
      : '';

  return `WebGPU is not available here, so shaping would fall back to WASM at ${WASM_SLOWDOWN} slower.${safari} The template path is unaffected.`;
}
