/**
 * The export gate: three documents in, one decision out.
 *
 * `blocking` is the reason the download stays disabled. It is a union rather than
 * a `Block[]` because two of the three reasons are not blocks: a required section
 * that is missing has no block to point at, and pretending otherwise would mean
 * inventing one in a report a person reads.
 *
 * Warnings never block. A thin task list and a criterion with no number are worth
 * saying out loud, and holding the export hostage to them would make the safe path
 * the slow path for no gain.
 */

import { Block, GeneratedDoc, isSourced } from './question-graph';
import { SpecFile } from './mapping';
import { StyleFinding, lintStyle } from './style-lint';
import { ValidationCode, ValidationFinding, validate } from './validator';

/** What one file contributes to the report. */
export interface FileReport {
  readonly file: SpecFile;
  readonly blocks: number;
  readonly sourced: number;
  readonly inferredUnreviewed: number;
  readonly gaps: number;
  readonly warnings: number;
}

export type GateBlocker =
  | {
      readonly kind: 'unreviewed-inferred';
      readonly file: SpecFile;
      readonly block: Block;
      readonly detail: string;
    }
  | {
      readonly kind: 'placeholder';
      readonly file: SpecFile;
      readonly block: Block;
      readonly detail: string;
    }
  | {
      readonly kind: 'structure';
      readonly file: SpecFile;
      readonly code: ValidationCode;
      readonly detail: string;
    };

export interface GateOptions {
  /**
   * The "warn instead of block" setting. Off by default: the whole point of the
   * gate is that an unreviewed inference cannot leave the app quietly.
   */
  readonly warnInsteadOfBlock?: boolean;
}

export interface GateResult {
  readonly blocking: readonly GateBlocker[];
  readonly warnings: readonly ValidationFinding[];
  readonly styleFindings: readonly StyleFinding[];
  readonly report: readonly FileReport[];
  readonly canExport: boolean;
}

const PLACEHOLDER = /\{\{MISSING:/;

function isEmptyPlaceholder(block: Block): boolean {
  return PLACEHOLDER.test(block.text);
}

function reportFor(doc: GeneratedDoc, findings: readonly ValidationFinding[]): FileReport {
  const inferredUnreviewed = doc.blocks.filter(
    (block) => block.origin.kind === 'model' && block.review === 'unreviewed',
  );

  return {
    file: doc.file,
    blocks: doc.blocks.length,
    sourced: doc.blocks.filter((block) => isSourced(block.origin)).length,
    inferredUnreviewed: inferredUnreviewed.length,
    gaps: doc.blocks.filter(isEmptyPlaceholder).length,
    warnings: findings.filter((finding) => finding.severity === 'warn').length,
  };
}

/** Evaluate the three documents and decide whether an export may proceed. */
export function evaluate(
  docs: readonly GeneratedDoc[],
  options: GateOptions = {},
): GateResult {
  const findings = validate(docs);
  const blocking: GateBlocker[] = [];

  for (const doc of docs) {
    for (const block of doc.blocks) {
      if (block.origin.kind === 'model' && block.review === 'unreviewed') {
        blocking.push({
          kind: 'unreviewed-inferred',
          file: doc.file,
          block,
          detail: `${block.section}: inferred text nobody has reviewed yet`,
        });
      }

      if (isEmptyPlaceholder(block)) {
        blocking.push({
          kind: 'placeholder',
          file: doc.file,
          block,
          detail: `${block.section}: ${block.text.trim()}`,
        });
      }
    }
  }

  for (const finding of findings) {
    if (finding.severity === 'block') {
      blocking.push({
        kind: 'structure',
        file: finding.file,
        code: finding.code,
        detail: finding.detail,
      });
    }
  }

  return {
    blocking,
    warnings: findings.filter((finding) => finding.severity === 'warn'),
    styleFindings: lintStyle(docs),
    report: docs.map((doc) =>
      reportFor(
        doc,
        findings.filter((finding) => finding.file === doc.file),
      ),
    ),
    canExport: blocking.length === 0 || options.warnInsteadOfBlock === true,
  };
}

/** The one-line verdict a person reads first. */
export function verdictLine(result: GateResult): string {
  if (result.blocking.length === 0) {
    return 'Nothing is blocking the export.';
  }

  if (result.canExport) {
    return `${result.blocking.length} ${
      result.blocking.length === 1 ? 'problem' : 'problems'
    } left, exported anyway because the warning setting is on.`;
  }

  return `${result.blocking.length} ${
    result.blocking.length === 1 ? 'block needs' : 'blocks need'
  } your review before export.`;
}
