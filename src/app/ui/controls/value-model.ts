/**
 * Pure value helpers shared by the question controls.
 *
 * Every control hands the store a plain string, because `Answer.text` is a
 * string. Lists are newline separated. A two column table is one row per line
 * with ` | ` between the cells. Choice options are read from the help text the
 * question already carries, so no new field is needed on `Question`.
 */

import { Question } from '../../core/question-graph';

/** Longest option accepted when options are parsed out of prose. */
const MAX_OPTION_WORDS = 4;
const MAX_OPTION_LENGTH = 32;

export interface TableRow {
  label: string;
  value: string;
}

export function emptyRow(): TableRow {
  return { label: '', value: '' };
}

/** Split a stored list answer into one item per line. Always at least one row. */
export function parseList(text: string): string[] {
  return text.length > 0 ? text.split('\n') : [''];
}

export function serializeList(items: string[]): string {
  return items.join('\n');
}

/** Split a stored table answer into two column rows. Always at least one row. */
export function parseTable(text: string): TableRow[] {
  if (text.length === 0) {
    return [emptyRow()];
  }

  return text.split('\n').map((line) => {
    const separator = line.indexOf('|');

    if (separator < 0) {
      return { label: line.trim(), value: '' };
    }

    return {
      label: line.slice(0, separator).trim(),
      value: line.slice(separator + 1).trim(),
    };
  });
}

export function serializeTable(rows: TableRow[]): string {
  return rows.map((row) => `${row.label} | ${row.value}`).join('\n');
}

/**
 * Candidate options for a `choice` question, read out of the help text.
 *
 * Two shapes are recognized, in order: quoted examples ("Stripe", "PayPal"),
 * and a short either/or tail sentence ("Yes or No", "Standalone or Modules.").
 * Anything else returns an empty list, and the choice control falls back to a
 * free text input.
 */
export function choiceOptions(question: Question | null): string[] {
  const help = question?.help?.trim() ?? '';

  if (help.length === 0) {
    return [];
  }

  const quoted = Array.from(help.matchAll(/"([^"]+)"/g))
    .map((match) => match[1].trim())
    .filter((option) => option.length > 0);

  if (quoted.length >= 2 && quoted.every(isShortOption)) {
    return dedupe(quoted);
  }

  const tail = lastSentence(help.replace(/\([^)]*\)/g, ' ')).replace(/^(e\.g\.|i\.e\.),?\s*/i, '');
  const parts = tail
    .split(/\s*,\s*|\s+or\s+/i)
    // After a comma split the conjunction can survive as a leading word ("or auto-detect").
    .map((part) => part.replace(/^[\s.,;:!]+|[\s.,;:!]+$/g, '').replace(/^(or|and)\s+/i, ''))
    .filter((part) => part.length > 0);

  if (parts.length < 2 || !parts.every(isShortOption)) {
    return [];
  }

  return dedupe(parts);
}

function lastSentence(text: string): string {
  const sentences = text
    .split('. ')
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  return sentences.length > 0 ? sentences[sentences.length - 1] : '';
}

function isShortOption(option: string): boolean {
  return option.split(/\s+/).length <= MAX_OPTION_WORDS && option.length <= MAX_OPTION_LENGTH;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}
