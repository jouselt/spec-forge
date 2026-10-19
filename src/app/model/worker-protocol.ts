/**
 * The worker protocol, and the thing that keeps the main thread free.
 *
 * A model produces tokens one at a time. Rendering each one would repaint the page hundreds
 * of times for one paragraph, so deltas are coalesced and flushed on a 60 ms tick: fast
 * enough to read as streaming, slow enough that layout runs about sixteen times a second
 * instead of a hundred.
 *
 * The two message types are declared here rather than in the worker so both sides import
 * the same shapes and a change breaks the compile instead of the runtime.
 */

import { StreamChunk } from './model-provider';

/** Main thread to worker. */
export type ToWorker =
  | { readonly type: 'load'; readonly modelId: string }
  | {
      readonly type: 'generate';
      readonly runId: string;
      readonly prompt: string;
      readonly temperature: number;
      readonly maxTokens: number;
    }
  | { readonly type: 'interrupt'; readonly runId: string }
  | { readonly type: 'unload' };

/** Worker to main thread. */
export type FromWorker =
  | { readonly type: 'progress'; readonly progress: number; readonly text: string }
  | { readonly type: 'delta'; readonly runId: string; readonly text: string }
  | { readonly type: 'done'; readonly runId: string }
  | { readonly type: 'error'; readonly runId: string; readonly message: string };

/** How often a coalesced batch is flushed. */
export const FLUSH_INTERVAL_MS = 60;

/** Collects deltas and hands them over on a tick. */
export class DeltaCoalescer {
  private buffer = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushes = 0;

  constructor(
    private readonly flushTo: (text: string) => void,
    private readonly interval = FLUSH_INTERVAL_MS,
  ) {}

  /** Add one delta. One timer per batch, not one per delta. */
  push(delta: string): void {
    this.buffer += delta;

    if (this.timer !== null) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.interval);
  }

  /** Send whatever is buffered right now. */
  flush(): void {
    if (this.buffer.length === 0) {
      return;
    }

    const text = this.buffer;

    this.buffer = '';
    this.flushes += 1;
    this.flushTo(text);
  }

  /** Send the last of it and stop. Called on `done` so nothing is left in the buffer. */
  finish(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = null;
    this.flush();
  }

  /** How many flushes actually happened, for a test. */
  flushCount(): number {
    return this.flushes;
  }

  pending(): string {
    return this.buffer;
  }
}

/** Turn a coalesced string into the chunk shape the shaper consumes. */
export function toChunk(text: string, done = false): StreamChunk {
  return { delta: text, done };
}
