/**
 * Which shaper runs, and with what.
 *
 * Off by default, for the same reason the template path is the default: the app's promises
 * hold without a model, and a person should not download a gigabyte to find that out.
 *
 * Three modes rather than a checkbox, because "off" and "template only" mean different
 * things to a reader: off hides the machinery, template only says out loud that this run
 * will not use it.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { Answer } from '../core/question-graph';
import { CapabilityService } from '../model/capability.service';
import { ModelInfo, ModelProvider } from '../model/model-provider';
import {
  DEFAULT_MODEL_ID,
  FALLBACK_MODELS,
  RECOMMENDED_MODEL_ID,
  modelById,
  modelsFrom,
} from '../model/models';
import { EngineLoader, WebLlmProvider } from '../model/providers';
import { LlmShaper, Shaper, ShaperResult, TemplateShaper } from '../model/shaper';
import { OUTPUT_RESERVE } from '../model/tokens';

export type ShapingMode = 'off' | 'template' | 'shape';

/** What the runtime loader would do, in a build that has the runtime. */
const NOT_BUNDLED = new Error(
  'The WebLLM runtime is not bundled in this build, so shaping is unavailable. The template path produced these files.',
);

/** Nothing is downloaded by this build. A build that installs the library passes its loader. */
const notBundledLoader: EngineLoader = async () => {
  throw NOT_BUNDLED;
};

@Injectable({ providedIn: 'root' })
export class ModelService {
  private readonly capabilities = inject(CapabilityService);

  private readonly modeState = signal<ShapingMode>('off');
  private readonly modelList = signal<ModelInfo[]>([...FALLBACK_MODELS]);
  private readonly selected = signal<string>(DEFAULT_MODEL_ID);
  private readonly noteState = signal<string | null>(null);
  /** One provider for the selected model, kept so a second run does not reload it. */
  private provider: ModelProvider | null = null;
  private providerModelId: string | null = null;

  readonly mode = this.modeState.asReadonly();
  readonly models = this.modelList.asReadonly();
  readonly selectedId = this.selected.asReadonly();
  readonly note = this.noteState.asReadonly();

  readonly selectedModel = computed(() => modelById(this.modelList(), this.selected()));
  readonly recommendedId = computed(() => RECOMMENDED_MODEL_ID);
  readonly defaultId = computed(() => DEFAULT_MODEL_ID);
  readonly banner = computed(() => this.capabilities.banner());
  readonly canShape = computed(() => this.modeState() === 'shape');

  /** The output room per file, shown next to the model so the budget is not a mystery. */
  readonly reserveFor = computed(() => OUTPUT_RESERVE);

  setMode(mode: ShapingMode): void {
    this.modeState.set(mode);

    if (mode === 'shape') {
      void this.capabilities.detect();

      return;
    }

    // Turning it off frees the weights rather than holding a gigabyte for a mode nobody is
    // using.
    void this.unload();
  }

  selectModel(id: string): void {
    this.selected.set(id);
  }

  /** Read the runtime's own table when a runtime exists. */
  adoptRuntimeTable(prebuilt: Parameters<typeof modelsFrom>[0]): void {
    this.modelList.set(modelsFrom(prebuilt));
  }

  /**
   * The provider for the selected model, created once and kept.
   *
   * Kept because loading a model is a download: building a fresh provider per run would
   * make every second generate pay for the weights again. It is replaced when the selection
   * changes, and only then.
   */
  providerFor(loader: EngineLoader = notBundledLoader): ModelProvider {
    if (!this.provider || this.providerModelId !== this.selected()) {
      this.provider = new WebLlmProvider(loader, this.selected());
      this.providerModelId = this.selected();
    }

    return this.provider;
  }

  /** The shaper for the current mode. */
  shaper(loader?: EngineLoader): Shaper {
    if (!this.canShape()) {
      return new TemplateShaper();
    }

    const model = this.selectedModel();

    if (!model) {
      return new TemplateShaper();
    }

    return new LlmShaper(this.providerFor(loader), model, 0.2, (file) => OUTPUT_RESERVE[file]);
  }

  /**
   * Shape, or fall back with a reason. Never throws: a shaping failure is a reason to keep
   * the template output, not a reason to lose the page.
   */
  async shape(answers: readonly Answer[], loader?: EngineLoader): Promise<ShaperResult> {
    try {
      // Load before shaping. Without this the first run throws "the model is not loaded",
      // which is what a person would see instead of the real reason a backend is missing.
      if (this.canShape()) {
        await this.providerFor(loader).load();
      }

      const result = await this.shaper(loader).shape(answers);

      this.noteState.set(result.reason ?? result.banner);

      return result;
    } catch (error) {
      const result = await new TemplateShaper().shape(answers);

      this.noteState.set(error instanceof Error ? error.message : String(error));

      return result;
    }
  }

  clearNote(): void {
    this.noteState.set(null);
  }

  /** Drop the loaded model. Called when someone turns shaping off. */
  async unload(): Promise<void> {
    await this.provider?.unload();
    this.provider = null;
    this.providerModelId = null;
  }
}
