/**
 * The one setting the gate reads.
 *
 * Off by default, deliberately: the gate exists because an unreviewed inference
 * must not leave the app quietly. Turning this on is a person saying they accept
 * that risk for this run, and the export marks every unreviewed block so the
 * reader of the file can still see what was not vouched for.
 */

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly warnSignal = signal(false);

  /** When true, the gate reports blocks and lets the export through. */
  readonly warnInsteadOfBlock = this.warnSignal.asReadonly();

  setWarnInsteadOfBlock(warn: boolean): void {
    this.warnSignal.set(warn);
  }

  toggleWarnInsteadOfBlock(): void {
    this.warnSignal.update((warn) => !warn);
  }
}
