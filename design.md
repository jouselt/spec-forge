# 12: spec-forge: Design

A 100% client-side Angular 20.3 app that interviews the user about an idea and emits three markdown files: `proposal.md`, `design.md`, `tasks.md`. No backend, no API key, static deploy to GitHub Pages.

The proposal sets the priority order: **interview first, generate second, and never invent.** Every section below exists to make that enforceable rather than aspirational. The interesting engineering is not prompt writing. It is the provenance model, the export gate, and the regression guard.

## Architecture

```
+-------------------------------- UI (Angular 20.3, standalone, signals) -------------------------------+
|                                                                                                     |
|  +----------------------------+   +---------------------------+   +-------------------------------+ |
|  | WizardComponent            |   | ReviewPanelComponent      |   | OutputTabsComponent           | |
|  | QuestionCard per step      |   | inferred blocks, states   |   | proposal | design | tasks     | |
|  | progress + adaptive badge  |   | jump to source answer     |   | CodeMirror 6, editable        | |
|  +----------------------------+   +---------------------------+   +-------------------------------+ |
|                                                                                                     |
|  +----------------------------+   +---------------------------+   +-------------------------------+ |
|  | ProvenancePanelComponent   |   | DiffReviewComponent       |   | ModelBarComponent             | |
|  | counts by origin kind      |   | per-section before apply  |   | off | template | shape, VRAM   | |
|  +----------------------------+   +---------------------------+   +-------------------------------+ |
|                                                                                                     |
|  +-------------------------------------------------------------------------------------------+      |
|  | ExportGateComponent: report of sourced / inferred / unreviewed, blocks the download        |      |
|  +-------------------------------------------------------------------------------------------+      |
+-----------------------------------------------------------------------------------------------------+
        |                                                       ^ streaming deltas + events
        v postMessage                                           |
+---------------------------+   +---------------------------+   +---------------------------+
| inference.worker.ts       |   | InterviewStore (signals)  |   | specDb (idb)              |
| ModelProvider facade      |   | answers, triggers, meta   |   | drafts, answers,          |
|  - WebLlmProvider         |   | derived: sections, proven |   | sections, snapshots       |
|  - LiteRtProvider (alt)   |   +---------------------------+   +---------------------------+
+---------------------------+
        |
        v
 Cache API: model weights     |     IndexedDB: everything the user typed

+-----------------------------------------------------------------------------------------------------+
| Pure core (no model, no I/O, unit tested)                                                            |
|  question-graph.ts  triggers.ts  mapping.ts  templates/  assembly.ts  provenance.ts                  |
|  validator.ts  gate.ts  diff.ts  style-lint.ts  export.ts                                            |
+-----------------------------------------------------------------------------------------------------+
```

The main thread owns the interview and the prose. The worker owns the model. The pure core owns correctness. Nothing in the pure core imports Angular, IndexedDB, or WebLLM.

The diagram names the planned components. What exists today: `AppComponent` plus `QuestionPanelComponent` with one control per question kind, `StepRailComponent`, and `StepStepperComponent` (the "N out of M" footer) under `src/app/ui/`, and `WizardStore` in `src/app/state/wizard-store.service.ts`. The review panel, output tabs, provenance panel, diff review, model bar and export gate are not built.

## Package layout

The layout is the plan. The lines marked `done` exist today; everything else is unbuilt.

```
src/app/
  core/
    question-graph.ts      core types only: Answer, Question, Trigger, TriggerTrace,
                           Origin, Block, ReviewState, plus narrowOrigin, isSourced,
                           isBlockExportReady                                     done
    steps.ts               the nine base questions and validateBaseSteps          done
    triggers.ts            the trigger table, normalize(), evaluateTriggers()      done
    mapping.ts             answer id -> (file, section) mapping table           planned
    answers.ts             AnswerSet, answer ids, normalization                 planned
    provenance.ts          block tagging helpers                                planned
                           (Origin, Block and ReviewState already live in
                           question-graph.ts; only the tagging helpers move)
    validator.ts           required sections, acceptance-criteria shape, style   planned
    gate.ts                export gate evaluation                              planned
    diff.ts                line-level diff and section-level apply             planned
    style-lint.ts          em dash + banned word check                         planned
    export.ts              blob building, bundle concatenation, zip            planned
  templates/
    proposal.tpl.ts        section frames for proposal.md                      planned
    design.tpl.ts          section frames for design.md                        planned
    tasks.tpl.ts           phase and item frames for tasks.md                  planned
    assembly.ts            renders an AnswerSet into Blocks with provenance     planned
  model/
    model-provider.ts      interface, same seam as project 11                  planned
    prompts/               shaping prompts per file, marker + placeholder protocol  planned
    markers.ts             [[answer:N]] parsing and coverage scoring           planned
    placeholders.ts        {{MISSING: ...}} parsing and promotion              planned
    inference-client.ts    main-thread facade over the worker                 planned
    inference.worker.ts    WebWorkerMLCEngineHandler                           planned
  state/
    wizard-store.service.ts  signals: answers, questions, traces, index; rail and totals  done
    trigger-reason.ts        the follow-up reason sentence                     done
    review-store.ts        per-block review state                             planned
    snapshot-store.ts      versioned generated docs, locks, restore            planned
  persistence/
    spec-db.ts             idb schema and migrations                           planned
    autosave.ts            debounced writer                                    planned
  ui/
    question-panel/        prompt, help, reason, control, validation, nav       done
    step-rail/             every question in order, with state and reason       done
    step-stepper/          segment row plus the "N out of M" footer             done
    controls/              text, longtext, number, choice, list, table          done
    review-panel/  output-tabs/  provenance-panel/  diff-review/
    model-bar/  export-gate/  style-lint-panel/                              planned
```

No NgRx. One store with a few signals covers it; a store library would add indirection without solving anything this app has.

## Data model

The interview is a flat answer set, not a form model. Flat answers are what provenance needs to reference, and they serialize without ceremony.

```ts
export type AnswerId = string;   // 'q.goal', 'a.ctx_window', 'a.vram_gb'

export interface Answer {
  id: AnswerId;
  questionId: string;
  text: string;
  kind: 'text' | 'longtext' | 'number' | 'choice' | 'list' | 'table';
  askedAt: number;
  source: 'base' | 'adaptive' | 'promoted' | 'imported';
  trigger?: TriggerTrace;        // present when source === 'adaptive'
  editedAt?: number;
}

export interface TriggerTrace {
  triggerId: string;             // 'local_model'
  becauseAnswerId: AnswerId;     // 'q.idea'
  matchedPhrase: string;         // 'ollama'
  matchedAt: number;
}

export interface Question {
  id: string;
  step: number;
  prompt: string;
  help?: string;                 // one line on what a good answer looks like
  kind: Answer['kind'];
  required: boolean;
  validate?: (text: string) => string | null;   // returns a message, not a boolean
  adaptive?: { triggerId: string; priority: number };
}
```

Provenance attaches to blocks, not to files. A file is a list of blocks.

```ts
export type Origin =
  | { kind: 'answer';   answerIds: AnswerId[]; frame: string }
  | { kind: 'template'; frame: string; inputs: AnswerId[] }
  | { kind: 'model';    modelId: string; basedOn: AnswerId[]; temperature: number }
  | { kind: 'imported'; section: string }
  | { kind: 'edited';   derivedFrom?: Origin }
  | { kind: 'missing';  placeholder: string };

export type ReviewState = 'unreviewed' | 'confirmed' | 'rejected' | 'edited';

export interface Block {
  id: string;                    // 'proposal:goal:p0'
  file: 'proposal' | 'design' | 'tasks';
  section: string;              // 'Goal'
  ord: number;
  text: string;
  origin: Origin;
  review: ReviewState;
  locked: boolean;              // user pinned; generation never overwrites
}

export interface GeneratedDoc {
  file: Block['file'];
  blocks: Block[];
  version: number;
  generatedAt: number;
  path: 'template' | 'shaped' | 'mixed';
}
```

An `Origin` of kind `answer` or `template` is sourced. `model` is inferred and starts `unreviewed`. `imported` and `edited` count as sourced because the human wrote them. `missing` is a placeholder, never text.

## The question graph and triggers

Nine base steps. The order matters: constraints before stack, proof before features, so the wizard never asks for a number the user has not had a chance to think about yet.

| Step | Question | Kind | Required | Notes |
| --- | --- | --- | --- | --- |
| 1 | What is the idea? One paragraph. | longtext | yes | Triggers most adaptive branches |
| 2 | What problem does it solve, and who has it? | longtext | yes | |
| 3 | What do those people do today instead? | longtext | yes | Produces the honest framing in Problem |
| 4 | What is the goal, and what are the non-goals? | longtext | yes | Non-goals become Scope Boundary |
| 5 | What proves it worked? Name a metric or an observable behavior. | text | yes | Rejects vague answers, see below |
| 6 | Which constraints can you measure before starting? | table | yes | Numbers with units, or "none measured yet" |
| 7 | Stack: framework, language, storage, deployment | list | yes | |
| 8 | What is explicitly out of scope? | list | yes | |
| 9 | Biggest risk, and what you would build first instead | longtext | yes | Feeds Risks and trade-offs |

Nine steps is the whole interview. `steps.ts` defines exactly those nine, `validateBaseSteps()` returns an error if the count is not nine, and the shipped footer reads "1 out of 9". **Risks and Trade-offs** and **Acceptance Criteria and Timeline** are not steps: neither exists in the code, and no task in `tasks.md` asks for them as interview steps. Acceptance criteria are produced from the answers by the assembly path, which is not built. If those two rows are still wanted as steps they are planned work, and the total is 9 today and would be 11 only once both ship.

**Triggers** are a checked-in table, not model output. A trigger is a phrase match plus a question set:

```ts
export interface Trigger {
  id: string;
  patterns: RegExp[];             // applied to normalized answer text
  questions: Question[];
  maxQuestions: number;           // per-trigger cap
  reasonTemplate: string;         // 'Asked because you mentioned {phrase} in step {step}'
}
```

The ten shipped triggers, patterns and caps verbatim from `core/triggers.ts`:

```ts
{ id: 'local_model',  patterns: [/\b(ollama|local model|local inference|on-device|self-hosted)\b/i],  maxQuestions: 3 }
{ id: 'corpus',       patterns: [/\b(corpus|document|knowledge base|dataset|training data)\b/i],        maxQuestions: 2 }
{ id: 'vector_db',    patterns: [/\b(vector|embedding|pgvector|weaviate|pinecone|qdrant)\b/i],          maxQuestions: 2 }
{ id: 'realtime',     patterns: [/\b(real-?time|live|stream|websocket|polling|latency)\b/i],            maxQuestions: 2 }
{ id: 'payments',     patterns: [/\b(payment|stripe|billing|transaction|credit card|checkout)\b/i],     maxQuestions: 3 }
{ id: 'auth',         patterns: [/\b(authentication|oauth|saml|ldap|sso|password|mfa|login)\b/i],       maxQuestions: 2 }
{ id: 'browser_ai',   patterns: [/\b(browser|client-side|webgpu|wasm|web llm|inference)\b/i],           maxQuestions: 2 }
{ id: 'nixos_deploy', patterns: [/\b(nix|nixos|flakes?|home manager|declarative)\b/i],                  maxQuestions: 2 }
{ id: 'angular',      patterns: [/\b(angular\w*|ng-|rxjs)\b/i],                                         maxQuestions: 2 }
{ id: 'nestjs',       patterns: [/\b(nestjs|nest|@nestjs|express|fastify)\b/i],                          maxQuestions: 2 }
```

The three `local_model` questions, as shipped:

```ts
{ id: 'a.ctx_window',    prompt: 'What is the model context window (input + output tokens)?',  kind: 'text',   priority: 1 }
{ id: 'a.vram_gb',       prompt: 'How much VRAM (GB) is available on your hardware?',          kind: 'number', priority: 2 }
{ id: 'a.wasm_fallback', prompt: 'Is a WASM fallback acceptable if WebGPU is unavailable?',    kind: 'choice', priority: 3 }
```

Every trigger carries the same `reasonTemplate`, so the reason sentence is built in one place. `normalize()` lowercases, collapses whitespace and strips punctuation except hyphens before matching, which is why the `angular` pattern matches a prefix: `@angular/core` becomes `angularcore` and no `@` survives.

Rules, all enforced in `triggers.ts` and all tested:

- A trigger fires on the first answer whose normalized text matches. The match is recorded as a `TriggerTrace`, not just a boolean, so the UI can show the phrase.
- Each trigger contributes at most `maxQuestions`; the global adaptive cap is **12**. The UI counts what it has: the header reads `{{answeredCount}} of {{total}} answered`, the panel reads `Question {{index + 1}} of {{total}}`, and the footer reads `{{position}} out of {{steps.length}}`, so the total rises the moment a follow-up is inserted. There is no separate follow-up counter.
- Adaptive questions appear after the step that triggered them, never inside it. Inserting a question mid-step breaks the back button and the draft.
- Skipping an adaptive question is allowed. It is recorded as unanswered and the sections that needed it are emitted as `{{MISSING: ...}}` placeholders, never as invented text.
- Triggers rerun on every answer change. Removing "Ollama" from step 1 retracts the three questions it added, and the UI says what it removed and why.

**Step 5 validation** is the one place the wizard pushes back. The shipped `validate()` in `core/steps.ts` checks length first and rejects any answer under 12 characters with `Answer must be at least 12 characters. Name a number, a unit, or an observable behavior.` Below it sits a keyword gate over `/\b(works|it works|good|fast|better|success|done)\b/i`, which returns `Name a number or an observable behavior. "Loads in under 2s" or "5 of 5 items process without errors". "It works" cannot be tested.` That second branch is unreachable as shipped: the length check runs first and every word in the pattern is shorter than 12 characters, so the length rule is the one that rejects vague answers. The rejection still happens and only the intent is dead code. `Question.validate` is not a judge of quality, and the UI does not pretend it is.

## Answer-to-section mapping

`mapping.ts` is a checked-in table, derived by reading the eleven existing specs in `portfolio-projects`. No model is involved in deciding where an answer goes.

| Answer | proposal.md | design.md | tasks.md |
| --- | --- | --- | --- |
| idea | Goal, Core Features | Architecture header | Phase 1 title |
| problem, who_has_it, workaround | Problem | | |
| goal, non_goals | Goal, Scope Boundary | | |
| proof_metric | Target Signal, Acceptance Criteria | Acceptance criteria (design-verifiable) | gate criteria in each phase |
| constraints | Constraints Measured Up Front | the constraint section named by the answer | |
| stack | Tech Stack | Package layout, Provider seams | |
| scope_out | Scope Boundary | Trade-offs | |
| risk, alt_build | Risks | Trade-offs Considered | |
| acceptance | Acceptance Criteria | Acceptance criteria (design-verifiable) | `[G]` items |
| timeline | Timeline | | Phase grouping |
| a.ctx_window, a.vram_gb, a.wasm_fallback | Constraints Measured Up Front | ModelProvider, Capability handling | `[M]` verification items |

A section with no mapped answer is not filled in by the model. It is emitted as a heading with `{{MISSING: which question would answer this}}` underneath, and it shows in the review panel as a gap. This is the structural version of "do not invent": absent input produces a visible hole, not a plausible paragraph.

## Templates (the no-model path)

Template assembly is the default and must be good enough to ship on its own. Each section has two to four frames, chosen by the shape of the mapped answers, so output does not read like a mail merge.

```
Goal:
  frame A (has metric):  "Build **{name}**: {idea_sentence} It {goal_sentence} and is judged by {proof_metric}."
  frame B (no metric):   "Build **{name}**: {idea_sentence} It {goal_sentence}."
  frame C (has non-goals): "... It does not {non_goals[0]}, and it does not {non_goals[1]}."

Acceptance criteria item (proposal):
  "- [ ] {verb_phrase} {object} {measurable_or_observable}."

tasks.md item:
  "- [ ] `[{tag}]` {imperative} {object}; {verification_clause}"
  tag = 'G' when the item names a unit-testable function or a fixture
        'E' when it names a model call, a threshold, or a sample
        'M' otherwise
```

`verb_phrase` is derived from the answer's first sentence with the leading filler stripped by a checked-in stopword list. The tag classifier is keyword-based and its output is always user-editable, which is why a wrong guess costs one click rather than a broken file.

The self-regeneration test exists because of this path: `spec-forge-answers.json` holds the answers that describe spec-forge itself, and CI asserts the template path reproduces this repository's three files' structure. The tool must be able to write its own spec without a model.

## The model path: shaping, not authoring

Optional, off by default, and labelled as optional in the UI. The model never sees a blank page. It receives the template-rendered blocks for one file plus the mapped answers, and is told to rewrite prose and propose acceptance criteria.

Per-file run:

```
input  = rendered blocks for one file + the answers mapped to that file
budget = contextTokens - TEMPLATE_RESERVE(256) - outputReserve(file)
         outputReserve: proposal 900, design 1400, tasks 1100

if (estimate(input) + TEMPLATE_RESERVE + outputReserve > contextTokens) {
  skip model for this file; report: "Needs ~X tokens, model has Y. Using template text."
  mark the file 'template' and continue
}
```

The check runs per file at runtime from the selected model's real `contextTokens`. It is not a constant.

**Marker protocol.** The prompt requires every factual sentence to end with `[[answer:N]]` markers naming the answer ids it used. A sentence with no marker is inferred by construction. `markers.ts` computes coverage:

```
coverage(markedSentences) / totalSentences
```

- `>= 0.80`: accepted. Marked sentences become `origin.kind = 'answer'`. Unmarked sentences become separate blocks with `origin.kind = 'model'`, review `unreviewed`.
- `0.60 - 0.80`: accepted with a banner naming the percentage. More blocks need review.
- `< 0.60`: **run failed.** The output is discarded, the template output is kept, and the UI says the model did not follow the protocol and shows the number. This is the same refusal pattern as project 11's validator: fail loudly, keep the safe output.

**Placeholder protocol.** When the model needs a fact it does not have, it must emit `{{MISSING: <the question it would ask>}}` rather than guessing. `placeholders.ts` parses those and turns each into a chip in the review panel. Promoting a chip appends a real question to the interview, which is the model asking a question instead of answering for the user. A `{{MISSING}}` chip is never rendered as prose in the final file; if it survives to export, the gate blocks.

Temperature 0.2, one pass per file, three files sequentially. No chaining between files, so a bad `design.md` run does not poison `proposal.md`.

## ModelProvider seam

Same interface as project 11, so the two projects share a real abstraction drawn from two implementations rather than a speculative one.

```ts
export interface ModelProvider {
  readonly id: 'webllm' | 'litert';
  listModels(): Promise<ModelInfo[]>;
  load(modelId: string, onProgress: (p: LoadProgress) => void): Promise<void>;
  stream(opts: StreamOpts): AsyncIterable<StreamChunk>;
  interrupt(): void;
  unload(): Promise<void>;
}

export interface ModelInfo {
  id: string;
  label: string;
  vramBytes: number;      // read from prebuiltAppConfig at runtime
  contextTokens: number;  // 4096 nearly everywhere; 1024 for -1k variants
  backend: 'webgpu' | 'wasm';
}
```

`WebLlmProvider` wraps `CreateWebWorkerMLCEngine` with `WebWorkerMLCEngineHandler` inside `inference.worker.ts`. `LiteRtProvider` wraps `@litertjs/core` and ships as a stub that rejects with a named message if the build does not include it, which keeps the seam honest. Default model `Llama-3.2-1B-Instruct-q4f16_1` (879 MB), recommended `Qwen2.5-3B-Instruct-q4f16_1` (2504 MB) when `navigator.gpu` reports a discrete adapter.

The no-model path is a third implementation of the shaping step, not a special case: `TemplateShaper` satisfies the same internal `Shaper` interface and never touches the worker.

## Worker protocol

```ts
type ToWorker   = { type: 'load'; modelId }
                | { type: 'run'; jobId; file: 'proposal'|'design'|'tasks'; prompt; system }
                | { type: 'cancel'; jobId }
                | { type: 'unload' };

type FromWorker = { type: 'load:progress'; loaded; total; text }
                | { type: 'run:token'; jobId; file; delta }
                | { type: 'run:done'; jobId; file; text; tokensOut; ms }
                | { type: 'run:error'; jobId; file; message }
                | { type: 'run:cancelled'; jobId; file };
```

Deltas coalesce in the worker and flush on a 60 ms timer, same backpressure valve as project 11. Cancel is cooperative through an `AbortSignal` checked between decode steps. Because runs are per file, a cancel after `proposal.md` leaves one usable file rather than nothing.

## Persistence

IndexedDB via `idb`, database `spec-forge`, version 1:

- `drafts`: `{ id, createdAt, updatedAt, step, modelId, shapingMode }`
- `answers`: `{ draftId, answerId, questionId, text, kind, source, trigger, askedAt, editedAt }`
- `docs`: `{ draftId, file, version, blocks, generatedAt, path }`
- `snapshots`: `{ draftId, version, files: { proposal, design, tasks }, createdAt, label }`
- `locks`: `{ draftId, blockId }`

Autosave debounces 400 ms on answer edits and fires immediately on step change, generation, and review action. On load, the newest draft with a `step > 1` is restored and the app offers to resume at that step. A long interview is the common case; losing one to a reload would be unforgivable.

Snapshots are written before every generation and before every import. Restore is a version list with a diff preview.

## Regression guard

Four independent guards on one failure mode, because one guard is a bug waiting to happen.

1. **Snapshot before write.** Every generation writes a snapshot first. Nothing can be lost that was not already saved.
2. **Diff before apply.** Generation never writes to the document directly. It produces a candidate document, shows a line diff per section, and the user applies by section or all. This is `git diff` discipline applied to generated text.
3. **Section locks.** Any block can be pinned. A locked block is excluded from regeneration entirely, not merged. The UI shows a lock badge with the reason it exists: "This is your text."
4. **Import-merge.** Pasting an existing `proposal.md` parses `##` sections and populates answers and blocks with `origin.kind = 'imported'`. Imported text is sourced by definition and is locked by default. Regenerating after an import fills gaps and never rewrites imported sections.

The fourth guard is the direct answer to the incident that motivated the project. A regeneration cannot revert text the app knows a human wrote.

## Validation and the export gate

`validator.ts` runs deterministically on the candidate before it reaches the tabs:

**Structure per file.**

- `proposal.md` has all of: Problem, Goal, Target Recruiter Signal, Tech Stack, Acceptance Criteria, Timeline (the six shared by the existing spec corpus), plus Risks. The corpus spells one of them `Target Recruiter Signal`; this repository's own spec renamed it to `Target Signal`, so the validator has to accept a spelling before it can run against the corpus at all.
- `design.md` has Architecture, Package layout, Provider seams, Validation, Persistence, Trade-offs, What This Proves, Acceptance Criteria, Open Questions.
- `tasks.md` has at least 3 phases, every item is a checkbox, every item carries one of `[G]` `[E]` `[M]`, and it ends with a Definition of Done.

**Shape.**

- Every acceptance criterion contains a number, a unit, a named identifier, or a comparison. An item with none of those is flagged, not deleted.
- `tasks.md` item count falls in 40 to 90. Outside that range the UI warns that the spec is probably too thin or too granular. Measured range across the three deepest existing specs: 63, 76, 77.
- No `{{MISSING: ...}}` survives in a file marked ready.

**Style (planned).** `style-lint.ts` will flag em dashes and each word on a checked-in list in `core/banned-words.ts`. Neither file exists today, and no lint runs in CI: `.github/workflows/ci.yml` runs `npm ci`, `npm run typecheck`, `npm test` and `npm run build`. The three specs committed here are clean of em dashes and of the usual AI vocabulary by hand, not by a check. The intent stands: once the list is checked in, the app is held to the same rules as the repo it lives in.

**The gate.** `gate.ts` reduces the three documents to one decision:

```
blocking = blocks where origin.kind === 'model' && review === 'unreviewed'
         + blocks where text matches /\{\{MISSING:/
         + files failing structure validation

if (blocking.length > 0) export is disabled
```

The report panel is always visible, not only when it blocks:

```
proposal.md   18 blocks   17 sourced   1 inferred, unreviewed   0 gaps
design.md     31 blocks   28 sourced   3 inferred, unreviewed   2 gaps
tasks.md      44 blocks   44 sourced   0 inferred              0 gaps
                                        ^ 4 blocks need your review before export
```

Each inferred row links to the block, shows the answers the model was given, and offers Confirm, Edit, or Reject. Reject deletes the text and leaves the section heading with a gap, which is honest. Confirm marks it reviewed and records the decision, so re-opening a draft does not silently re-block.

A no-model run has zero inferred blocks and the button is live immediately. That is the design working: the safest path is also the fastest one.

## Export

- **Individual**: `proposal.md`, `design.md`, `tasks.md` as `Blob` with type `text/markdown`, filenames fixed.
- **Bundle, default**: one `spec-bundle.md` with YAML-ish separators:

  ```
  <!-- FILE: proposal.md -->
  ...
  <!-- FILE: design.md -->
  ...
  <!-- FILE: tasks.md -->
  ```

  Chosen as default because it needs no dependency, is diffable, and pastes into any chat or issue in one action.
- **Bundle, optional**: `spec-forge.zip` via `fflate`, behind a dynamic import so it is never in the main chunk.
- **Copy to clipboard** per tab.

Export reads from the document store, not from the editor buffer content alone, so provenance and review state travel with the text when a draft is re-exported later.

## Trade-offs Considered

- **Signals vs NgRx.** One screen, one draft, no cross-route state, no server cache. NgRx would add four files per feature to manage state a single store service holds. Signals plus derived computeds is the right size.
- **Signals-based reactive forms vs a custom question renderer.** The question graph is dynamic: questions appear and retract as triggers fire, and each question records which trigger produced it. Typed reactive forms want a static shape. A small `QuestionPanelComponent` with one control per kind, driven by a `Question` object, handles the dynamism and keeps the trigger trace on the answer, which a `FormControl` would not carry.
- **CodeMirror 6 vs textarea.** Three editable markdown documents with headings and code fences need an editor. A textarea looks unfinished and offers no folding. ~200 KB, tree-shaken, and it is the pane the user judges the product in.
- **Zip vs concatenated markdown.** Zip is the obvious answer and it costs a dependency and loses diffability. Concatenated is the default; zip is one dynamic import away for users who want three real files.
- **Model shapes prose vs model writes files.** Writing files from scratch is a better demo and it invents. Shaping existing sourced blocks keeps every fact traceable. The project's thesis wins over the demo.
- **Per-file runs vs one whole-spec run.** One run would be faster and would couple the files: a bad `design.md` would take `proposal.md` with it. Per-file runs also make the context budget check meaningful, since a whole spec does not fit 4096.
- **Placeholder protocol vs letting the model ask free-text questions.** Free text is unparseable and cannot become a chip or a real question. A strict token costs nothing and closes the loop into the interview.
- **Blocking export vs warning.** A warning is ignored under deadline, and the whole point is that invisible fabrication is the failure mode. Blocking is the default; a settings toggle allows export with a warning banner and the inferred text wrapped in `<!-- INFERRED: unreviewed -->`. The toggle is off by default and the README says why.
- **LiteRT.js as a second backend.** Worth the seam, not worth blocking on. Its model availability and API surface are less settled than WebLLM's. It ships as a stub that satisfies the interface and fails with a named message, which proves the seam is real without pretending the backend is done.
- **Adaptive triggers as regex vs using the model to decide what to ask.** The model cannot run before it is loaded, and most users will never load it. Regex plus a checked-in table works with no model, is testable, shows its reason in the UI, and retracts deterministically when an answer changes.

## What This Proves

Each piece below is stated as the mechanism it is and what it costs to have it. Nothing here is addressed to a reader outside the project.

| Piece | What it does | What it cost |
| --- | --- | --- |
| Interview before generation, enforced in code | Generation cannot start until the nine questions are answered, so the problem, the non-goals, the measurable constraints, and the proof exist before any prose does | A question graph, a trigger engine, and validation state, all before a line of output |
| Per-block provenance with four origin kinds | Every block records where it came from, so a sentence can be walked back to the answer that produced it | A Block model with an Origin union, and a review state per block |
| Export gate that blocks on unreviewed inferred text | Inferred text cannot leave the app unreviewed, which is how invisible fabrication becomes a blocking condition instead of a convention | A gate that overrides the download intent, plus a review panel to clear it |
| `{{MISSING:}}` placeholder protocol | A fact the model does not have becomes a visible gap or a new question, instead of a guess | A token in the prompt, a parser, and a promotion path back into the interview |
| Marker coverage with a hard fail under 60% | Grounding is measured rather than assumed, and a failed run keeps the safe output | An extra parse pass per file, and a threshold that has to be tuned |
| Adaptive question graph with trigger traces and retraction | Follow-ups come from the answers and leave when the answer changes, with the reason shown either way | Trigger evaluation on every answer change and a bounded pruning loop |
| Snapshot, diff before apply, locks, import-merge | A regeneration cannot revert text a human wrote | Four mechanisms for one failure mode, because one guard was not enough |
| Runtime context budget check per file | The model path is measured against the real context window and refused when it does not fit | The budget has to be computed per file at runtime, not read from a constant |
| `ModelProvider` seam with a stubbed second backend | The interface is drawn from two real cases, one of them deliberately unimplemented | An interface, a stub that rejects with a named message, and a build without that backend |
| 60 ms token coalescing in a worker | The answer inputs stay responsive while a model decodes | A worker protocol, a flush timer, and cooperative cancellation |
| Style lint applied to its own generated output | The tool is held to the same writing rules as the repo it lives in | A word list to maintain, and the risk of false positives on legitimate prose |
| No backend, no API key, static deploy | Nothing to operate and nothing to pay for; the product is a static bundle | No server-side capability is possible, by construction |

**How this project demonstrates spec driven development.** Three ways, and the third is the one that matters.

1. **It is built from a spec.** This `proposal.md`, `design.md`, and `tasks.md` come first. Every task in `tasks.md` traces to a decision here.
2. **It generates that artifact.** The output shape is not invented, it is derived from measuring the eleven existing specs in this repository: which sections recur, which six appear in all of them, how many task items a real spec carries. The tool produces the format the repo already uses.
3. **It encodes the discipline as software.** The wizard *is* the method. You cannot reach generation without stating the problem, the non-goals, the measurable constraints, and the proof. The proof question refuses "it works". The export gate refuses unverified content. A tool that makes you practice spec driven development in order to produce a spec is a stronger argument for it than an essay about it.

The loop closes in CI: `spec-forge-answers.json` describes spec-forge itself, and the self-regeneration test rebuilds these three files from those answers through the template path. If the tool cannot write its own spec without a model, the build fails.

## Acceptance Criteria (design-verifiable)

- [ ] `evaluateTriggers(answers)` is deterministic: the same answer set produces the same question list across 100 runs, and it is a pure function of the answers.
- [ ] The answer "an Angular app using a local Ollama model and pgvector" fires exactly the `local_model`, `vector_db`, and `angular` triggers and adds no more than 7 follow-up questions.
- [ ] Deleting the word "Ollama" from step 1 retracts the three `local_model` questions and the UI names what it removed.
- [ ] The adaptive cap holds at 12: an answer matching 6 triggers yields at most 12 follow-ups, and no trigger exceeds its own `maxQuestions`.
- [ ] Every adaptive question renders the matched phrase and the step that triggered it, asserted in a component test with a fixture `TriggerTrace`.
- [ ] Step 5's `validate()` rejects "it works", "fast", "good", and any string under 12 characters, and accepts "5 unanswerable questions return an abstain, 5 of 5".
- [ ] `assemble()` on a complete answer set produces blocks where every block has a non-null `origin` and `origin.kind !== 'model'`.
- [ ] A section with no mapped answer emits `{{MISSING: ...}}` and does not emit model or template prose.
- [ ] `markers.ts` scores a fixture with 10 sentences and 7 markers at 0.70, and a fixture with 10 sentences and 5 markers fails the run.
- [ ] A run scoring under 0.60 keeps the template output byte-identical and the UI states the measured coverage.
- [ ] Each `{{MISSING: <question>}}` becomes a chip, and promoting it appends a question whose `prompt` is the placeholder text.
- [ ] The budget check with `contextTokens = 1024` and a 1,400-token `design.md` input refuses the model path for that file and names the three numbers.
- [ ] Switching the selected model from a 4096-context model to a `-1k` model recomputes the per-file decisions without a reload.
- [ ] `gate.ts` returns non-empty for one unreviewed inferred block, for one surviving placeholder, and for a file missing `Acceptance Criteria`, and returns empty for a fully sourced run.
- [ ] Confirming every inferred block flips `gate.ts` to empty; rejecting one removes its text and also flips it to empty.
- [ ] `diff.ts` on a candidate where one section changed and one is locked reports exactly 1 changed section, and the locked text is byte-identical after apply.
- [ ] Importing the portfolio's real `01` `proposal.md` marks every parsed section `origin.kind = 'imported'` and `locked = true`, and a later generation run does not alter those blocks.
- [ ] `validator.ts` rejects each of the six required proposal sections individually, using six fixtures that each violate exactly one.
- [ ] `tasks.md` validation rejects a fixture whose items lack `[G]`/`[E]`/`[M]` tags and one whose item count is 20.
- [ ] `style-lint.ts` flags one em dash and each of the 18 banned words in fixtures, and returns zero findings on the three specs in this repository.
- [ ] The export report's per-origin counts sum to the block count for each file, on a mixed template-and-shaped run.
- [ ] Kill the tab at step 7, reopen, and resume with all answers, generated blocks, and review states intact.
- [ ] With the worker busy shaping `design.md`, keypress-to-render latency in an answer input stays under 50 ms measured with `performance.now()`.
- [ ] Cancel during the `design.md` run leaves the `proposal.md` result present and editable.
- [ ] The self-regeneration test rebuilds `proposal.md`, `design.md`, and `tasks.md` from `spec-forge-answers.json` through the template path with no model, and every required heading is present.
- [ ] DevTools Network shows zero requests after model weights are cached, verified on a second load.
- [ ] `npm run typecheck` passes with zero errors under `strict` and `strictTemplates`; grep of `src/` for `http://` and `https://` returns only model CDN URLs.

## Open Questions

- Should adaptive questions be skippable silently, or should skipping require a one-line reason that then appears as a gap note in the generated spec? Leaning toward the reason, since it turns a gap into a documented decision.
- Should the export gate's "warn instead of block" toggle exist at all? It is the right escape hatch for a user who knows what they are doing and the obvious way to defeat the entire point of the project. Currently off by default; worth revisiting after real use.
- Should `promoted` questions (raised from a `{{MISSING}}` chip) persist into the question graph for the next draft, or stay attached to the draft that created them? Persisting builds a better trigger table over time and adds a migration.
- Is per-file shaping the right unit, or should section-level shaping be allowed when the whole file does not fit but a single section does? Section-level is finer grained and doubles the number of runs.
- Should the app export a machine-readable `spec-forge.json` bundle alongside the markdown, so a later tool could ingest a spec without parsing prose? It fits the provenance model and is scope creep for v1.
- Should imported specs be diffed against the interview answers for conflicts (an imported Problem that contradicts a new answer), or is surfacing both enough? Conflict detection is a real feature and a real source of false positives.
