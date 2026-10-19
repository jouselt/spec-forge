/**
 * Writing on a timer, without writing on every keystroke.
 *
 * Two behaviours, because they answer two different risks.
 *
 * An answer being typed is frequent and cheap to lose for 400 ms, so it is debounced: the
 * twentieth keystroke cancels the previous nineteen writes.
 *
 * A step change is rare and expensive to lose, because it is the moment a person believes
 * their work is safe, so it flushes at once and does not wait.
 *
 * The sink is an interface and not the database, so the debounce is testable with
 * `fakeAsync` and no IndexedDB at all. The database test lives next to the database.
 */

import { Answer, TriggerTrace } from '../core/question-graph';

/** How long a keystroke waits before it is written. */
export const AUTOSAVE_DELAY_MS = 400;

/** What gets written. */
export interface DraftPayload {
  readonly id: string;
  readonly step: number;
  readonly answers: readonly Answer[];
  readonly traces: readonly TriggerTrace[];
  readonly updatedAt: number;
}

/** Anything that can store a payload. The database, in the app; a spy, in a test. */
export interface DraftSink {
  write(payload: DraftPayload): Promise<void> | void;
}

/** What happened, for a test and for the "saved" line. */
export interface AutosaveStats {
  readonly scheduled: number;
  readonly written: number;
}

export class Autosaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: DraftPayload | null = null;
  private scheduledCount = 0;
  private writtenCount = 0;

  constructor(
    private readonly sink: DraftSink,
    private readonly delay = AUTOSAVE_DELAY_MS,
  ) {}

  /** Queue a payload. Twenty calls inside the delay produce one write. */
  schedule(payload: DraftPayload): void {
    this.pending = payload;
    this.scheduledCount += 1;

    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.flush();
    }, this.delay);
  }

  /**
   * Write now, cancelling any timer, and hand back the write.
   *
   * The promise matters: a caller that says "save now" and returns before the write lands
   * is telling the person their work is safe when it is not. The timer path ignores the
   * promise because there is nobody to tell.
   */
  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = null;

    const payload = this.pending;

    if (!payload) {
      return;
    }

    this.pending = null;
    this.writtenCount += 1;
    await this.sink.write(payload);
  }

  /** Drop what is queued without writing. */
  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = null;
    this.pending = null;
  }

  /** Is there anything waiting? */
  hasPending(): boolean {
    return this.pending !== null;
  }

  stats(): AutosaveStats {
    return { scheduled: this.scheduledCount, written: this.writtenCount };
  }
}
