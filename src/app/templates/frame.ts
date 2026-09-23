/**
 * The template vocabulary: what a frame is, what an answer set looks like to a
 * frame, and the token replacement that turns a frame into text.
 *
 * A section carries two to four frames. A frame is either prose (the first one
 * whose `when` matches the answer shape wins) or an item (every matching frame
 * contributes, once per entry when it declares `each`). Frames never invent: a
 * frame's tokens are filled from answers, and a token that would have no value
 * makes `fillFrame` throw, so a broken frame fails a test instead of leaking
 * braces into a spec.
 */

import { AnswerId } from '../core/question-graph';

/** What a frame can ask about the shape of the answers. */
export interface AnswerShape {
  /** True when the question holds a non-blank answer. */
  has(id: AnswerId): boolean;
  /** Lines in a list or table answer; 1 for a single line of prose. */
  count(id: AnswerId): number;
  /** True when the answer text matches a pattern. False when it is absent. */
  matches(id: AnswerId, pattern: RegExp): boolean;
}

/** One repeatable entry: a list item, a table row, or a measured answer. */
export interface FrameEntry {
  /** The entry as it should read inline, e.g. `latency | p99 under 100ms`. */
  readonly text: string;
  /** Left cell of a table row, or the whole entry for a list item. */
  readonly label: string;
  /** Right cell of a table row, or empty for a list item. */
  readonly value: string;
}

/** Everything a frame can read. Every key is defined, empty when unanswered. */
export interface FrameContext {
  readonly values: Readonly<Record<string, string>>;
  readonly lists: Readonly<Record<string, FrameEntry[]>>;
  /**
   * The answers each value came from. A block's `origin.inputs` is computed from
   * the tokens its frame used, so the provenance names exactly what was read
   * rather than a hand-maintained list that can drift.
   */
  readonly sources: Readonly<Record<string, AnswerId[]>>;
  /** The answers each list came from, used for item blocks. */
  readonly listSources: Readonly<Record<string, AnswerId[]>>;
}

/**
 * `prose` frames are alternatives: the first one whose `when` matches wins, so a
 * section renders one paragraph. `bullet` and `check` frames accumulate, and they
 * render one line per entry when they declare `each`.
 */
export type FrameKind = 'prose' | 'bullet' | 'check';

export interface TemplateFrame {
  /** Stable id, recorded as `origin.frame`, e.g. `goal.measured`. */
  readonly id: string;
  readonly kind: FrameKind;
  /** Text with `{token}` placeholders. Item frames may use `{item}`. */
  readonly text: string;
  /** Chosen by the shape of the answers. */
  readonly when: (shape: AnswerShape) => boolean;
  /** Item frames render once per entry of this `lists` key. */
  readonly each?: string;
}

export interface TemplateSection {
  readonly section: string;
  /**
   * The question a gap names when no frame matches. It is the question that would
   * fill this section, so a promoted placeholder is answerable.
   */
  readonly gapQuestion: AnswerId;
  readonly frames: readonly TemplateFrame[];
}

/**
 * Shared shape patterns. They live here because a frame's `when` and the token it
 * reads have to agree: a frame that fires on `MODEL_STACK_PATTERN` is safe to read
 * `{provider}` only because the context builder uses the same pattern to fill it.
 */

/** A number, so the answer names something measurable. */
export const MEASURABLE_PATTERN = /\d/;

/** "none measured yet" and its variants, written the way the help text asks. */
export const UNMEASURED_PATTERN = /\b(none|nothing|no constraints?|n\/a)\b/i;

/** A sentence that states what the work is not. */
export const NON_GOAL_PATTERN = /\b(not|never|won't|will not|do not|does not|non-?goal|out of scope|no)\b/i;

/** A stack answer that names an inference runtime or a model host. */
export const MODEL_STACK_PATTERN = /\b(ollama|webllm|litert|llama|mistral|qwen|gemma|local model|inference|on-device)\b/i;

/** A stack answer that names a datastore. */
export const STORAGE_STACK_PATTERN =
  /\b(postgres|postgresql|pgvector|sqlite|indexeddb|mysql|mongo|redis|supabase|dynamo|s3|database|datastore|files?|blob storage)\b/i;

/** A stack answer that names where the thing runs. */
export const DEPLOY_STACK_PATTERN =
  /\b(deploy|docker|compose|nixos|kubernetes|vercel|netlify|fly\.io|cloudflare|pages|homelab|caddy|nginx)\b/i;

/** The clause of a risk answer that says what to build first. */
export const ALTERNATIVE_PATTERN = /\b(instead|first)\b/i;

const TOKEN_PATTERN = /\{([a-z0-9_.]+)\}/g;

const SINGLE_ENTRY: FrameEntry = { text: '', label: '', value: '' };

/** The tokens a frame's text needs, in order, without duplicates. */
export function frameTokens(text: string): string[] {
  const tokens: string[] = [];

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    if (!tokens.includes(match[1])) {
      tokens.push(match[1]);
    }
  }

  return tokens;
}

/** Replace every `{token}` from the context. An unknown token is a bug, not a gap. */
export function fillFrame(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(TOKEN_PATTERN, (_match, token: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, token)) {
      throw new Error(`Frame token {${token}} is not in the render context`);
    }
    return values[token];
  });
}

/**
 * Render one frame. Prose frames return one string; bullet and check frames
 * return one per entry of their `each` list, or one entry-less string when they
 * have no `each`.
 */
export function renderFrame(frame: TemplateFrame, context: FrameContext): string[] {
  if (frame.kind === 'prose') {
    return [fillFrame(frame.text, context.values)];
  }

  const entries = frame.each ? context.lists[frame.each] ?? [] : [SINGLE_ENTRY];

  return entries
    .filter((entry) => entry.text.trim().length > 0 || !frame.each)
    .map((entry) =>
      fillFrame(frame.text, {
        ...context.values,
        item: entry.text,
        item_label: entry.label,
        item_value: entry.value,
      }),
    );
}
