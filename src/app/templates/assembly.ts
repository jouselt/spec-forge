/**
 * Assembly: an answer set in, three documents out, no model involved.
 *
 * `assemble()` walks the section registry in `core/mapping.ts`, renders the
 * frames in `templates/*.tpl.ts`, and tags every block with the answers it read.
 * Three properties are load-bearing and each has a test:
 * - deterministic: the same answers produce byte-identical markdown;
 * - sourced: no block carries a `model` origin on this path;
 * - honest: a section with nothing to say becomes a `{{MISSING: ...}}` gap, never
 *   invented prose.
 *
 * The pure core rule holds here: no Angular, no IndexedDB, no WebLLM.
 */

import { Answer, AnswerId, Block, GeneratedDoc } from '../core/question-graph';
import {
  SectionSpec,
  SpecFile,
  allQuestions,
  questionById,
  sectionsFor,
} from '../core/mapping';
import { missingBlock, templateBlock } from '../core/provenance';
import {
  AnswerShape,
  DEPLOY_STACK_PATTERN,
  FrameContext,
  FrameEntry,
  FrameKind,
  MODEL_STACK_PATTERN,
  NON_GOAL_PATTERN,
  STORAGE_STACK_PATTERN,
  TemplateFrame,
  TemplateSection,
  frameTokens,
  renderFrame,
} from './frame';
import { PROPOSAL_TEMPLATE } from './proposal.tpl';
import { DESIGN_TEMPLATE } from './design.tpl';
import { TASKS_TEMPLATE, itemLine } from './tasks.tpl';

export interface AssemblyOptions {
  /** Fixed clock, so a test can compare whole documents and not only markdown. */
  readonly now?: number;
  readonly version?: number;
}

const FILES: readonly SpecFile[] = ['proposal', 'design', 'tasks'];

const FILE_TEMPLATES: Readonly<Record<SpecFile, readonly TemplateSection[]>> = {
  proposal: PROPOSAL_TEMPLATE,
  design: DESIGN_TEMPLATE,
  tasks: TASKS_TEMPLATE,
};

/** Leading filler a person writes and a spec does not need. Checked in, not guessed. */
export const FILLER_PREFIXES: readonly string[] = [
  'i want to',
  'i would like to',
  'i am building',
  'i plan to',
  'we want to',
  'we are building',
  'the goal is to',
  'the idea is',
  'the point is to',
  'this project will',
  'this tool will',
  'it should',
  'this should',
];

/** A line that markdown joins to the one above it instead of starting a paragraph. */
const ADJACENT_LINE = /^(- |\* |\d+\. |\|)/;

export function templatesFor(file: SpecFile): readonly TemplateSection[] {
  return FILE_TEMPLATES[file];
}

/** Answers are keyed by question id: the store writes `answer.id === question.id`. */
export function indexAnswers(answers: Answer[]): Map<AnswerId, Answer> {
  const index = new Map<AnswerId, Answer>();

  for (const answer of answers) {
    index.set(answer.questionId, answer);
  }

  return index;
}

function answerText(index: Map<AnswerId, Answer>, id: AnswerId): string {
  return index.get(id)?.text.trim() ?? '';
}

/** Split prose into sentences, punctuation trimmed off each one. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/[.!?]+$/, '').trim())
    .filter((sentence) => sentence.length > 0);
}

export function firstSentence(text: string): string {
  return sentences(text)[0] ?? '';
}

/** Drop a leading filler phrase, repeatedly, so "I want to build X" becomes "build X". */
export function stripFiller(text: string): string {
  let result = text.trim();

  for (let pass = 0; pass < FILLER_PREFIXES.length; pass++) {
    const prefix = FILLER_PREFIXES.find((candidate) =>
      result.toLowerCase().startsWith(candidate),
    );

    if (prefix === undefined) {
      break;
    }

    result = result.slice(prefix.length).trim();
  }

  return result;
}

/** Leading words a person writes and a project name does not need. */
const NAME_STOPWORDS: readonly string[] = ['build', 'create', 'make', 'ship', 'write', 'design', 'a', 'an', 'the', 'this', 'my', 'our'];

/**
 * A short name for the project, derived from the idea answer only. The name is
 * composed copy rather than the user's own sentence, so dashes are normalized and
 * a leading verb or article is dropped: it is read mid-sentence, not as a title.
 */
export function deriveName(idea: string): string {
  const source = firstSentence(stripFiller(idea));
  const clause = source.split(/\s+(?:that|which|who|to|for|with|so|when|where)\s+|[,;:]/i)[0] ?? '';
  const words = clause.split(/\s+/).filter((word) => word.length > 0);

  while (words.length > 1 && NAME_STOPWORDS.includes(words[0].toLowerCase())) {
    words.shift();
  }

  const shortened = words.slice(0, 8).join(' ').trim();
  const spoken = shortened.length >= 3 ? shortened : 'project';

  return spoken.replace(/[\u2014\u2013]/g, '-');
}

/** Lines of a list answer, one entry each. */
export function listEntries(text: string): FrameEntry[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ text: line, label: line, value: '' }));
}

/** Rows of a table answer: `label | value` per line, as the table control writes them. */
export function tableEntries(text: string): FrameEntry[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separator = line.indexOf('|');
      const label = separator < 0 ? line : line.slice(0, separator).trim();
      const value = separator < 0 ? '' : line.slice(separator + 1).trim();

      return { text: value.length > 0 ? `${label}: ${value}` : label, label, value };
    })
    .filter((entry) => entry.label.length > 0);
}

/** The shape predicates the frames read. */
export function buildShape(answers: Answer[]): AnswerShape {
  const index = indexAnswers(answers);

  return {
    has: (id) => answerText(index, id).length > 0,
    count: (id) => {
      const text = answerText(index, id);

      if (text.length === 0) {
        return 0;
      }

      const kind = index.get(id)?.kind ?? 'text';

      return kind === 'list' || kind === 'table' ? entriesFor(text, kind).length : 1;
    },
    matches: (id, pattern) => pattern.test(answerText(index, id)),
  };
}

function entriesFor(text: string, kind: Answer['kind']): FrameEntry[] {
  return kind === 'table' ? tableEntries(text) : listEntries(text);
}

/** Bulleted lines from a list answer. */
function bullets(entries: FrameEntry[]): string {
  return entries.map((entry) => `- ${entry.label}`).join('\n');
}

/** The context every frame reads. Every token is defined; unanswered ones are empty. */
export function buildContext(answers: Answer[]): FrameContext {
  const index = indexAnswers(answers);
  const values: Record<string, string> = {};
  const sources: Record<string, AnswerId[]> = {};
  const lists: Record<string, FrameEntry[]> = {};
  const listSources: Record<string, AnswerId[]> = {};

  const set = (token: string, value: string, from: AnswerId[]): void => {
    values[token] = value;
    sources[token] = from;
  };

  const addList = (token: string, entries: FrameEntry[], from: AnswerId[]): void => {
    lists[token] = entries;
    listSources[token] = from;
  };

  // Every question gets a token, so a frame can name any answer and resolution is
  // total. An unanswered question yields an empty string, and the frame's `when`
  // is what keeps that empty string out of the output.
  for (const question of allQuestions()) {
    set(question.id, answerText(index, question.id), [question.id]);
  }

  const idea = answerText(index, 'q.idea');
  const goal = answerText(index, 'q.goal');
  const risk = answerText(index, 'q.risk');

  for (const [token, id] of [
    ['idea', 'q.idea'],
    ['problem', 'q.problem'],
    ['workaround', 'q.workaround'],
    ['goal', 'q.goal'],
    ['proof', 'q.proof'],
    ['constraints', 'q.constraints'],
    ['stack', 'q.stack'],
    ['scope_out', 'q.scope_out'],
    ['risk', 'q.risk'],
  ] as const) {
    set(token, answerText(index, id), [id]);
  }

  set('name', deriveName(idea), ['q.idea']);
  set('goal_sentence', firstSentence(stripFiller(goal)), ['q.goal']);
  set('proof_sentence', firstSentence(stripFiller(answerText(index, 'q.proof'))), ['q.proof']);
  set('risk_sentence', firstSentence(stripFiller(risk)), ['q.risk']);
  set('problem_sentence', firstSentence(answerText(index, 'q.problem')), ['q.problem']);

  // Non-goals are the sentences that say what the work will not do. The goal
  // answer holds them; when it holds none, the token is empty and the frames that
  // read it do not fire.
  const nonGoals = sentences(goal).filter((sentence) => NON_GOAL_PATTERN.test(sentence));
  set('non_goals', nonGoals.length > 0 ? `${nonGoals.join('. ')}.` : '', ['q.goal']);

  // The clause of the risk answer that names what to build first.
  const alternative = sentences(risk).find((sentence) => /\b(instead|first)\b/i.test(sentence)) ?? '';
  set('alt_build', alternative.length > 0 ? `${alternative}.` : '', ['q.risk']);

  const stackEntries = listEntries(answerText(index, 'q.stack'));
  const stackItems = stackEntries.map((entry) => entry.label);
  set('stack_first', stackItems[0] ?? '', ['q.stack']);
  set('stack_list', bullets(stackEntries), ['q.stack']);
  set('stack_inline', stackItems.join(', '), ['q.stack']);
  set('storage', stackItems.filter((item) => STORAGE_STACK_PATTERN.test(item)).join(', '), ['q.stack']);
  set('provider', stackItems.filter((item) => MODEL_STACK_PATTERN.test(item)).join(', '), ['q.stack']);
  set('deploy_item', stackItems.filter((item) => DEPLOY_STACK_PATTERN.test(item))[0] ?? '', ['q.stack']);
  addList('stack_entries', stackEntries, ['q.stack']);

  const scopeEntries = listEntries(answerText(index, 'q.scope_out'));
  set('scope_out_list', bullets(scopeEntries), ['q.scope_out']);
  set('scope_out_inline', scopeEntries.map((entry) => entry.label).join(', '), ['q.scope_out']);
  addList('scope_entries', scopeEntries, ['q.scope_out']);

  const constraintEntries = tableEntries(answerText(index, 'q.constraints')).filter(
    (entry) => !/^(none|nothing|n\/a)$/i.test(entry.label) || entry.value.length > 0,
  );
  set('constraint_inline', entriesInline(constraintEntries), ['q.constraints']);
  set('constraint_rows', tableRows(constraintEntries), ['q.constraints']);
  addList('constraint_entries', constraintEntries, ['q.constraints']);

  // Adaptive answers are measured numbers, so they read as table rows. The label
  // is the checked-in question prompt, verbatim, minus its question mark.
  const hardwareIds = allQuestions()
    .filter((question) => question.id.startsWith('a.'))
    .filter((question) => answerText(index, question.id).length > 0)
    .map((question) => question.id);
  const hardwareEntries: FrameEntry[] = hardwareIds.map((id) => {
    const label = (questionById(id)?.prompt ?? id).replace(/\?$/, '');
    const value = answerText(index, id);

    return { text: `${label}: ${value}`, label, value };
  });
  set('hardware_rows', tableRows(hardwareEntries), hardwareIds);
  addList('hardware_entries', hardwareEntries, hardwareIds);

  return { values, lists, sources, listSources };
}

function entriesInline(entries: FrameEntry[]): string {
  return entries.map((entry) => (entry.value.length > 0 ? `${entry.label}: ${entry.value}` : entry.label)).join('; ');
}

function tableRows(entries: FrameEntry[]): string {
  return entries.map((entry) => `| ${entry.label} | ${entry.value} |`).join('\n');
}

interface RenderedBlock {
  readonly text: string;
  readonly frame: string;
  readonly inputs: AnswerId[];
}

/** The answers a frame names, read off the tokens it used. */
function inputsFor(frame: TemplateFrame, context: FrameContext): AnswerId[] {
  const inputs: AnswerId[] = [];

  for (const token of frameTokens(frame.text)) {
    const from =
      token === 'item' || token === 'item_label' || token === 'item_value'
        ? frame.each
          ? context.listSources[frame.each] ?? []
          : []
        : context.sources[token] ?? [];

    for (const id of from) {
      if (!inputs.includes(id)) {
        inputs.push(id);
      }
    }
  }

  return inputs;
}

function renderSection(
  spec: SectionSpec,
  template: TemplateSection,
  shape: AnswerShape,
  context: FrameContext,
): RenderedBlock[] {
  const blocks: RenderedBlock[] = [];
  let proseTaken = false;

  for (const frame of template.frames) {
    if (!frame.when(shape)) {
      continue;
    }

    // Prose frames are alternatives and the first match wins, so a section reads
    // as one paragraph instead of a stack of near-synonyms. Line frames accumulate.
    if (frame.kind === 'prose') {
      if (proseTaken) {
        continue;
      }
      proseTaken = true;
    }

    const inputs = inputsFor(frame, context);

    if (inputs.length === 0) {
      throw new Error(`Frame ${frame.id} names no answer, so its block would have no provenance`);
    }

    for (const text of renderFrame(frame, context)) {
      if (text.trim().length === 0) {
        continue;
      }

      blocks.push({ text: lineFor(spec.file, frame.kind, text), frame: frame.id, inputs });
    }
  }

  return blocks;
}

/** How a line frame lands in markdown: a task item carries a tag, a bullet does not. */
function lineFor(file: SpecFile, kind: FrameKind, text: string): string {
  if (kind === 'prose') {
    return text;
  }

  if (kind === 'bullet') {
    return `- ${text}`;
  }

  return file === 'tasks' ? itemLine(text) : `- [ ] ${text}`;
}

function templateFor(file: SpecFile, section: string): TemplateSection {
  const template = templatesFor(file).find((candidate) => candidate.section === section);

  if (!template) {
    throw new Error(`No template for ${file} section "${section}"`);
  }

  return template;
}

/** The question a gap names: the one that would fill the section. */
export function gapQuestionFor(file: SpecFile, section: string): string {
  const template = templateFor(file, section);
  return questionById(template.gapQuestion)?.prompt ?? template.gapQuestion;
}

/**
 * The no-model path: answers in, three documents out. Every block names the
 * answers it read, and a section with nothing to say becomes a gap.
 */
export function assemble(answers: Answer[], options: AssemblyOptions = {}): GeneratedDoc[] {
  const shape = buildShape(answers);
  const context = buildContext(answers);
  const version = options.version ?? 1;
  const generatedAt = options.now ?? Date.now();
  const docs: GeneratedDoc[] = [];

  for (const file of FILES) {
    const blocks: Block[] = [];

    for (const spec of sectionsFor(file)) {
      const rendered = renderSection(spec, templateFor(file, spec.name), shape, context);

      if (rendered.length === 0) {
        // Required sections keep their heading and say what would fill it.
        // An optional section with nothing behind it is left out entirely.
        if (!spec.required) {
          continue;
        }

        blocks.push(
          missingBlock({
            file,
            section: spec.name,
            ord: 0,
            question: gapQuestionFor(file, spec.name),
          }),
        );
        continue;
      }

      rendered.forEach((block, ord) => {
        blocks.push(
          templateBlock({
            file,
            section: spec.name,
            ord,
            frame: block.frame,
            inputs: block.inputs,
            text: block.text,
          }),
        );
      });
    }

    docs.push({ file, blocks, version, generatedAt, path: 'template' });
  }

  return docs;
}

/** `## Section` headings, with list items joined and paragraphs kept apart. */
export function renderMarkdown(doc: GeneratedDoc): string {
  const lines: string[] = [];
  let section: string | null = null;
  let previous: Block | null = null;

  for (const block of doc.blocks) {
    if (block.section !== section) {
      if (section !== null) {
        lines.push('');
      }
      lines.push(`## ${block.section}`, '');
      section = block.section;
      previous = null;
    } else if (previous && !(ADJACENT_LINE.test(previous.text) && ADJACENT_LINE.test(block.text))) {
      lines.push('');
    }

    lines.push(block.text);
    previous = block;
  }

  return `${lines.join('\n')}\n`;
}

/** The three files as markdown, in the order they are exported. */
export function assembleMarkdown(answers: Answer[], options: AssemblyOptions = {}): Record<SpecFile, string> {
  const markdown = { proposal: '', design: '', tasks: '' } as Record<SpecFile, string>;

  for (const doc of assemble(answers, options)) {
    markdown[doc.file] = renderMarkdown(doc);
  }

  return markdown;
}
