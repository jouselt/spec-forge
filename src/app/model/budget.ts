/**
 * Does this run fit in the window?
 *
 * The check is `estimate(input) + 256 + outputReserve <= contextTokens`, and when it fails
 * it names all three numbers. A refusal that says "too long" sends a person looking for a
 * setting; a refusal that says "6200 estimated input, 256 overhead and 1400 reserved is
 * 7856 against a 4096 window" tells them to drop to a smaller file or a bigger model.
 *
 * Nothing here reloads anything. The numbers are computed from the model's own
 * `contextTokens`, so switching to a `-1k` variant recomputes and refuses without a
 * download.
 */

import { SpecFile } from '../core/mapping';
import { ModelInfo } from './model-provider';
import { ESTIMATE_LABEL, OUTPUT_RESERVE, PROMPT_OVERHEAD, estimateTokens } from './tokens';

export interface BudgetRequest {
  readonly model: ModelInfo;
  readonly file: SpecFile;
  /** The whole prompt, already assembled. */
  readonly input: string;
}

export interface BudgetResult {
  readonly fits: boolean;
  readonly inputTokens: number;
  readonly overheadTokens: number;
  readonly outputReserve: number;
  readonly contextTokens: number;
  /** The three numbers and the window, for the refusal sentence. */
  readonly total: number;
  readonly detail: string;
}

/** The check. */
export function checkBudget(request: BudgetRequest): BudgetResult {
  const inputTokens = estimateTokens(request.input);
  const overheadTokens = PROMPT_OVERHEAD;
  const outputReserve = OUTPUT_RESERVE[request.file];
  const contextTokens = request.model.contextTokens;
  const total = inputTokens + overheadTokens + outputReserve;
  const fits = total <= contextTokens;

  const detail = fits
    ? `${inputTokens} ${ESTIMATE_LABEL} of input, ${overheadTokens} of overhead and ${outputReserve} reserved fits in ${contextTokens}.`
    : `${request.file}.md does not fit: ${inputTokens} ${ESTIMATE_LABEL} of input plus ${overheadTokens} of overhead plus ${outputReserve} reserved is ${total}, against ${contextTokens} of context on ${request.model.label}.`;

  return { fits, inputTokens, overheadTokens, outputReserve, contextTokens, total, detail };
}
