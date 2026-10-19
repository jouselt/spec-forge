import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SnapshotStore } from '../../state/snapshot-store.service';
import { DocumentStore } from '../../state/document-store.service';

/**
 * The version list.
 *
 * A snapshot is only useful if a person can see what restoring it would cost, so each
 * row says how many lines of each file would change before the button is pressed.
 * Restore is the one action here, and it is undoable: restoring writes nothing, it
 * replaces what is in the store, and the snapshot that was there before is still in
 * the list.
 */
@Component({
  selector: 'app-snapshot-panel',
  standalone: true,
  template: `
    <section class="snapshots">
      <header class="panel-head">
        <h3 class="panel-title">Versions</h3>
        <p class="panel-count">{{ rows().length }} saved</p>
      </header>

      @if (rows().length === 0) {
        <p class="empty">Nothing saved yet. Every generation and every import saves one first.</p>
      } @else {
        <ul class="snapshot-list">
          @for (row of rows(); track row.id) {
            <li class="snapshot-row" [attr.data-snapshot-id]="row.id">
              <div class="row-main">
                <span class="row-version">v{{ row.version }}</span>
                <span class="row-label">{{ row.label }}</span>
                <span class="row-delta">
                  {{ row.changed }}{{ row.changed === 1 ? ' line' : ' lines' }} different
                </span>
              </div>
              <button
                type="button"
                class="restore-button"
                [attr.data-snapshot-id]="row.id"
                (click)="restore(row.id)"
              >
                Restore
              </button>
            </li>
          }
        </ul>
      }

      @if (lastRestored()) {
        <p class="last-restored">Restored {{ lastRestored() }}.</p>
      }
    </section>
  `,
  styles: [
    `
      .snapshots {
        margin-top: 1.5rem;
        border-top: 1px solid #d0d0d0;
        padding-top: 1rem;
      }
      .panel-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
      }
      .panel-title {
        margin: 0;
        font-size: 1rem;
      }
      .panel-count {
        margin: 0;
        font-size: 0.8rem;
        color: #666;
      }
      .empty {
        margin: 0.4rem 0 0;
        font-size: 0.85rem;
        color: #666;
      }
      .snapshot-list {
        margin: 0.4rem 0 0;
        padding: 0;
        list-style: none;
      }
      .snapshot-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.25rem 0;
        border-bottom: 1px solid #eee;
        font-size: 0.85rem;
      }
      .row-main {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
      }
      .row-version {
        font-family: ui-monospace, monospace;
        color: #666;
      }
      .row-delta {
        color: #666;
        font-size: 0.8rem;
      }
      .restore-button {
        padding: 0.15rem 0.6rem;
        cursor: pointer;
      }
      .last-restored {
        margin: 0.5rem 0 0;
        font-size: 0.85rem;
        color: #2b6b2b;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SnapshotPanelComponent {
  private readonly snapshots = inject(SnapshotStore);
  private readonly store = inject(DocumentStore);

  private readonly restoredId = signal<string | null>(null);

  readonly rows = computed(() => {
    const previews = this.snapshots.preview(this.store.docs());
    const byId = new Map(previews.map((preview) => [preview.id, preview] as const));

    return this.snapshots.snapshots().map((snapshot) => {
      const preview = byId.get(snapshot.id);
      const changed = preview
        ? preview.changedLines.proposal + preview.changedLines.design + preview.changedLines.tasks
        : 0;

      return {
        id: snapshot.id,
        version: snapshot.version,
        label: snapshot.label,
        changed,
      };
    });
  });

  readonly lastRestored = computed(() => {
    const id = this.restoredId();

    return id ? (this.rows().find((row) => row.id === id)?.label ?? id) : null;
  });

  restore(id: string): void {
    if (this.store.restoreSnapshot(id)) {
      this.restoredId.set(id);
    }
  }
}
