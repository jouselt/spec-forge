/**
 * Two ways to turn answers into three files.
 *
 * `TemplateShaper` needs nothing: it is `assemble()`, which the app already had. It is the
 * default and it stays the default, because it cannot be wrong about a fact it was handed.
 *
 * `LlmShaper` puts a model in front of the same answers and then checks its work with
 * `measureCoverage`. Under 0.60 it returns nothing and the template output stays on screen
 * byte for byte, which is the only kind of failure that is safe.
 *
 * Both satisfy one interface so the rest of the app never learns which one it is talking to.
 */

import { Answer, GeneratedDoc } from '../core/question-graph';
import { SpecFile } from '../core/mapping';
import { ModelInfo, ModelProvider } from './model-provider';
import { checkBudget } from './budget';
import { measureCoverage, shapedDoc } from './markers';
import { shapingPrompt } from './prompts';
import { assemble } from '../templates/assembly';

/** What a shaping run reports, so the UI can say something true about it. */
export interface ShaperResult {
  readonly docs: readonly GeneratedDoc[];
  /** `template` when the model was not used, or when it was and did not pass. */
  readonly path: 'template' | 'shaped' | 'mixed';
  readonly banner: string | null;
  /** Why the run fell back, when it did. */
  readonly reason: string | null;
}

/** Anything that can produce the three documents from the answers. */
export interface Shaper {
  readonly id: string;
  shape(answers: readonly Answer[], signal?: AbortSignal): Promise<ShaperResult>;
}

/** The default. No model, no network, no waiting. */
export class TemplateShaper implements Shaper {
  readonly id = 'template';

  async shape(answers: readonly Answer[]): Promise<ShaperResult> {
    return { docs: assemble([...answers]), path: 'template', banner: null, reason: null };
  }
}

/** Coalesce a stream into a string, checking the signal between chunks. */
async function collect(
  provider: ModelProvider,
  prompt: string,
  temperature: number,
  maxTokens: number,
  signal: AbortSignal | undefined,
): Promise<string | null> {
  let text = '';

  for await (const chunk of provider.stream({ prompt, temperature, maxTokens, signal })) {
    if (signal?.aborted) {
      return null;
    }

    text += chunk.delta;
  }

  return text;
}

export class LlmShaper implements Shaper {
  readonly id = 'llm';

  constructor(
    private readonly provider: ModelProvider,
    private readonly model: ModelInfo,
    private readonly temperature = 0.2,
    /** Output room per file, reused from the budget so the two cannot disagree. */
    private readonly maxTokensFor: (file: SpecFile) => number = () => 900,
  ) {}

  async shape(answers: readonly Answer[], signal?: AbortSignal): Promise<ShaperResult> {
    const template = assemble([...answers]);
    const shaped: GeneratedDoc[] = [];
    const banners: string[] = [];

    for (const file of ['proposal', 'design', 'tasks'] as const) {
      if (signal?.aborted) {
        break;
      }

      const prompt = shapingPrompt(file, answers);
      const budget = checkBudget({ model: this.model, file, input: prompt.text });

      if (!budget.fits) {
        return {
          docs: template,
          path: 'template',
          banner: null,
          reason: budget.detail,
        };
      }

      const text = await collect(
        this.provider,
        prompt.text,
        this.temperature,
        this.maxTokensFor(file),
        signal,
      );

      // A cancelled run leaves what it already produced in place, which is why the loop
      // appends instead of replacing: a cancelled design.md must not cost a finished
      // proposal.md.
      if (text === null) {
        break;
      }

      const report = measureCoverage(text);

      if (report.verdict === 'reject') {
        return {
          docs: template,
          path: 'template',
          banner: null,
          reason: report.banner,
        };
      }

      const doc = shapedDoc(
        text,
        file,
        prompt.sections[0] ?? file,
        this.model.id,
        answers,
        this.temperature,
      );

      if (!doc) {
        return { docs: template, path: 'template', banner: null, reason: report.banner };
      }

      shaped.push(doc);

      if (report.banner) {
        banners.push(`${file}.md: ${report.banner}`);
      }
    }

    if (shaped.length === 0) {
      return { docs: template, path: 'template', banner: null, reason: 'Nothing was shaped.' };
    }

    const merged = template.map(
      (doc) => shaped.find((candidate) => candidate.file === doc.file) ?? doc,
    );

    return {
      docs: merged,
      path: shaped.length === template.length ? 'shaped' : 'mixed',
      banner: banners.length > 0 ? banners.join(' ') : null,
      reason: null,
    };
  }
}
