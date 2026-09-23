/**
 * Core types for the spec-forge interview and generation system.
 * Pure data structures with no dependencies on Angular, IndexedDB, or WebLLM.
 */

export type AnswerId = string; // 'q.idea', 'q.problem', 'a.ctx_window', etc.

export interface Answer {
  id: AnswerId;
  questionId: string;
  text: string;
  kind: 'text' | 'longtext' | 'number' | 'choice' | 'list' | 'table';
  askedAt: number; // timestamp in ms
  source: 'base' | 'adaptive' | 'promoted' | 'imported';
  trigger?: TriggerTrace; // present when source === 'adaptive'
  editedAt?: number; // timestamp in ms if edited after initial answer
}

export interface TriggerTrace {
  triggerId: string; // e.g., 'local_model'
  becauseAnswerId: AnswerId; // the answer that matched the pattern
  matchedPhrase: string; // the exact matched text from the answer
  matchedAt: number; // timestamp in ms
}

export interface Question {
  id: string; // unique within the graph
  step: number; // base questions are 1-9; a follow-up carries a fractional step just after the one that fired it
  prompt: string; // what to ask the user
  help?: string; // one line on what a good answer looks like
  kind: Answer['kind'];
  required: boolean;
  validate?: (text: string) => string | null; // returns error message or null
  adaptive?: { triggerId: string; priority: number }; // marks this as an adaptive question
}

export interface Trigger {
  id: string; // e.g., 'local_model'
  patterns: RegExp[]; // patterns to match against normalized answers
  questions: Question[];
  maxQuestions: number; // cap per trigger
  reasonTemplate: string; // 'You mentioned {phrase} in step {step}'
}

export type OriginKind = 'answer' | 'template' | 'model' | 'imported' | 'edited' | 'missing';

export type Origin =
  | { kind: 'answer'; answerIds: AnswerId[]; frame: string }
  | { kind: 'template'; frame: string; inputs: AnswerId[] }
  | { kind: 'model'; modelId: string; basedOn: AnswerId[]; temperature: number }
  | { kind: 'imported'; section: string }
  | { kind: 'edited'; derivedFrom?: Origin }
  | { kind: 'missing'; placeholder: string };

export type ReviewState = 'unreviewed' | 'confirmed' | 'rejected' | 'edited';

export interface Block {
  id: string; // e.g., 'proposal:goal:p0'
  file: 'proposal' | 'design' | 'tasks';
  section: string; // e.g., 'Goal'
  ord: number; // order within section
  text: string;
  origin: Origin;
  review: ReviewState;
  locked: boolean; // if true, regeneration never overwrites this block
}

export interface GeneratedDoc {
  file: Block['file'];
  blocks: Block[];
  version: number;
  generatedAt: number; // timestamp in ms
  path: 'template' | 'shaped' | 'mixed'; // which generation path was used
}

/** Narrow Origin by kind for type-safe handling */
export function narrowOrigin<K extends OriginKind>(origin: Origin, kind: K): Extract<Origin, { kind: K }> | null {
  return origin.kind === kind ? (origin as Extract<Origin, { kind: K }>) : null;
}

/** Check if an origin is sourced (human-written) vs inferred */
export function isSourced(origin: Origin): boolean {
  return origin.kind === 'answer' || origin.kind === 'template' || origin.kind === 'imported' || origin.kind === 'edited';
}

/** Check if a block is ready for export (not inferred and unreviewed, no missing placeholder) */
export function isBlockExportReady(block: Block): boolean {
  return isSourced(block.origin) || (block.origin.kind === 'model' && block.review !== 'unreviewed');
}
