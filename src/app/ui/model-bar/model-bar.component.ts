import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ModelService, ShapingMode } from '../../state/model.service';
import { isDefault, isRecommended, vramLabel } from '../../model/models';

/**
 * The model picker.
 *
 * Defaults to off, shows what each model costs before it is downloaded, and says what the
 * browser can do. The VRAM number next to each name is the point: a person can decide
 * without installing anything, which is the only way "the model is optional" is true rather
 * than a slogan.
 */
@Component({
  selector: 'app-model-bar',
  standalone: true,
  template: `
    <section class="model-bar">
      <div class="row">
        <label class="mode">
          <span class="label">Model</span>
          <select class="mode-select" [value]="model.mode()" (change)="onMode($event)">
            <option value="off">Off</option>
            <option value="template">Template only</option>
            <option value="shape">Shape with a model</option>
          </select>
        </label>

        @if (model.mode() === 'shape') {
          <label class="picker">
            <span class="label">Model</span>
            <select class="model-select" [value]="model.selectedId()" (change)="onModel($event)">
              @for (entry of model.models(); track entry.id) {
                <option [value]="entry.id">
                  {{ entry.label }}, {{ cost(entry.vramBytes) }}{{ badge(entry.id) }}
                </option>
              }
            </select>
          </label>

          @if (model.selectedModel(); as chosen) {
            <p class="context" [attr.data-model]="chosen.id">
              {{ chosen.contextTokens }} context, {{ cost(chosen.vramBytes) }} to download
            </p>
          }
        } @else {
          <p class="quiet">{{ quietLine() }}</p>
        }
      </div>

      @if (model.mode() === 'shape' && model.banner()) {
        <p class="wasm-banner">{{ model.banner() }}</p>
      }

      @if (model.note()) {
        <p class="note">{{ model.note() }}</p>
      }
    </section>
  `,
  styles: [
    `
      .model-bar {
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 0.5rem 0.7rem;
        margin-top: 0.75rem;
        font-size: 0.85rem;
        background: #fbfbf8;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        flex-wrap: wrap;
      }
      .label {
        color: #666;
        margin-right: 0.3rem;
      }
      .quiet,
      .context {
        margin: 0;
        color: #666;
      }
      .wasm-banner {
        margin: 0.4rem 0 0;
        color: #7a5b00;
      }
      .note {
        margin: 0.4rem 0 0;
        color: #a03030;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelBarComponent {
  readonly model = inject(ModelService);

  readonly quietLine = computed(() =>
    this.model.mode() === 'off'
      ? 'No model. The template path writes all three files from your answers alone.'
      : 'Template only. Nothing is downloaded and no request leaves this page.',
  );

  cost(bytes: number): string {
    return vramLabel(bytes);
  }

  /** The two marks the design asks for, next to the name rather than in a legend. */
  badge(id: string): string {
    const entry = this.model.models().find((candidate) => candidate.id === id);

    if (!entry) {
      return '';
    }

    if (isDefault(entry)) {
      return ' (default)';
    }

    return isRecommended(entry) ? ' (recommended)' : '';
  }

  onMode(event: Event): void {
    const target = event.target as HTMLSelectElement | null;

    this.model.setMode((target?.value ?? 'off') as ShapingMode);
  }

  onModel(event: Event): void {
    const target = event.target as HTMLSelectElement | null;

    if (target?.value) {
      this.model.selectModel(target.value);
    }
  }
}
