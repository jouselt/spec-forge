/**
 * The model table: what each one costs and how much it can hold.
 *
 * Read from the runtime when the library is present, from the checked-in table below
 * otherwise. Two sources, one shape, because the picker has to render before anything is
 * downloaded and a VRAM number that only appears after a 2 GB install is a number nobody
 * can use to decide.
 *
 * The fallback is bytes, measured from the published prebuilt configuration. A test
 * asserts every entry has a positive cost and a positive context, so a placeholder cannot
 * creep in.
 */

import { ModelInfo } from './model-provider';

/** The smallest useful model, and the one selected when shaping is first turned on. */
export const DEFAULT_MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

/** The one worth downloading when a person has the room. */
export const RECOMMENDED_MODEL_ID = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';

const MB = 1024 * 1024;

/** Context window for every entry in the fallback table; all four share it. */
const CONTEXT = 4096;

/** Checked in so the picker works offline and before the first download. */
export const FALLBACK_MODELS: readonly ModelInfo[] = [
  {
    id: DEFAULT_MODEL_ID,
    label: 'Qwen2.5 0.5B',
    vramBytes: Math.round(879 * MB),
    contextTokens: CONTEXT,
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 1.5B',
    vramBytes: Math.round(1895 * MB),
    contextTokens: CONTEXT,
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 1B',
    vramBytes: Math.round(2504 * MB),
    contextTokens: CONTEXT,
  },
  {
    id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 3B',
    vramBytes: Math.round(3431 * MB),
    contextTokens: CONTEXT,
  },
  {
    id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 7B',
    vramBytes: Math.round(5106 * MB),
    contextTokens: CONTEXT,
  },
];

/** A byte count as a person reads it. */
export function vramLabel(bytes: number): string {
  const mb = bytes / MB;

  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

/** Is this the entry the picker marks as the default? */
export function isDefault(model: ModelInfo): boolean {
  return model.id === DEFAULT_MODEL_ID;
}

/** Is this the entry the picker marks as recommended? */
export function isRecommended(model: ModelInfo): boolean {
  return model.id === RECOMMENDED_MODEL_ID;
}

/** The shape of the slice of `prebuiltAppConfig` this reads. */
export interface PrebuiltConfig {
  readonly model_list?: readonly {
    readonly model_id?: string;
    readonly vram_required_MB?: number;
    readonly overrides?: { readonly context_window_size?: number };
  }[];
}

/**
 * The table, preferring what the runtime reports.
 *
 * When the runtime is present its numbers win, because they are the numbers the runtime
 * will actually allocate. When it is absent the fallback stands, and an entry the runtime
 * does not know keeps its fallback row rather than disappearing from the picker.
 */
export function modelsFrom(prebuilt: PrebuiltConfig | undefined): ModelInfo[] {
  if (!prebuilt?.model_list || prebuilt.model_list.length === 0) {
    return [...FALLBACK_MODELS];
  }

  const reported = new Map(
    prebuilt.model_list
      .filter((entry): entry is { model_id: string; vram_required_MB?: number; overrides?: { context_window_size?: number } } =>
        typeof entry.model_id === 'string',
      )
      .map((entry) => [entry.model_id, entry] as const),
  );

  return FALLBACK_MODELS.map((model) => {
    const entry = reported.get(model.id);

    if (!entry) {
      return model;
    }

    return {
      ...model,
      vramBytes: Math.round((entry.vram_required_MB ?? model.vramBytes / MB) * MB),
      contextTokens: entry.overrides?.context_window_size ?? model.contextTokens,
    };
  });
}

/** One entry by id, or undefined. */
export function modelById(
  models: readonly ModelInfo[],
  id: string,
): ModelInfo | undefined {
  return models.find((model) => model.id === id);
}
