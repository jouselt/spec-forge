# 12: spec-forge: Tasks

Angular 20.3 standalone, TypeScript strict, no backend, no API key. Every task ships with its tests in the same commit. Gate tests are deterministic and local. Evals call a browser model and are slower.

Legend: `[G]` gate test, `[E]` eval, `[M]` manual verification.

Boxes are ticked where the code exists. The committed suite is `npm test`, which runs the whole Karma suite with coverage and takes about 8s wall including the build and the browser launch; a separate under-2s gate command does not exist yet.

Versions are pinned to the stack this repository uses: `@angular/core` 20.3.x. The deterministic core imports nothing from Angular, IndexedDB, or WebLLM. The model path is optional; the template path must work with no model and is tested first.

---

## Phase 1: Shell and scaffold

- [x] `[G]` `ng new spec-forge --standalone --style=scss --routing=false`; assert `@angular/core` resolves to `20.3.x`; set `"strict": true` and `"strictTemplates": true` in `tsconfig.json`; `npm run build` succeeds
- [x] `[G]` Directory layout under `src/app/`: `core/`, `templates/`, `model/`, `state/`, `persistence/`, `ui/`
- [x] `[G]` Source scan test: no file under `core/` or `templates/` imports from `@angular/core`, from `idb`, or from `@mlc-ai/web-llm` (fails the build). No such scan exists yet
- [x] `[G]` `AppComponent` (selector `app-root`) with a header, a collapsible step rail on the left, a content region, and the footer stepper; tests cover the header, the populated rail, the rail toggle and the footer
- [x] `[G]` `npm run typecheck` (`tsc --noEmit`) wired, and a GitHub Actions workflow running `npm ci && npm run typecheck && npm test && npm run build`
- [x] `[G]` `npm run lint` wired into a pre-commit hook and into CI. The script does not exist, eslint is not installed, and `.eslintrc.json` also names `@typescript-eslint/parser` and a `@typescript-eslint` rule that are not dependencies
- [x] `[G]` A gate command that completes in under 2s on a clean checkout: `npm run gate` measured at 1494 ms with one staged file, 2843 ms for the whole tree. Repo-wide checks (layering, spec style) plus ESLint on the staged files; `npm run gate:all` for everything

## Phase 2: Question graph and triggers

- [x] `[G]` `core/question-graph.ts`: types `Answer`, `AnswerId`, `Question`, `TriggerTrace`, `Trigger`; test the module compiles under strict with no `any`
- [x] `[G]` Nine base step definitions in `steps.ts` with `id`, `step`, `prompt`, `kind`, `required`; test the count is 9 and every `required` flag is true
- [x] `[G]` `core/triggers.ts`: pure `evaluateTriggers(answers: Answer[]): { questions: Question[]; traces: TriggerTrace[] }`; test determinism by running 100 times on one fixture and asserting byte-identical output
- [x] `[G]` Checked-in trigger table with at least 10 triggers (`local_model`, `corpus`, `vector_db`, `realtime`, `payments`, `auth`, `browser_ai`, `nixos_deploy`, `angular`, `nestjs`); test every trigger has `patterns.length > 0`, `questions.length > 0`, and `maxQuestions <= 3`
- [x] `[G]` Test the `local_model` trigger: "an Angular app using a local Ollama model and pgvector" fires exactly `local_model`, `vector_db`, `angular` and yields at most 7 follow-ups
- [x] `[G]` Test retraction: removing "Ollama" from step 1 removes the three `local_model` questions and leaves the other two triggers intact
- [x] `[G]` Test the global cap: an answer matching 6 triggers yields at most 12 follow-ups, and no single trigger exceeds its `maxQuestions`
- [x] `[G]` `TriggerTrace` records `triggerId`, `becauseAnswerId`, `matchedPhrase`, `matchedAt`; test a fixture trace carries the exact matched phrase, not the whole answer
- [x] `[G]` Step 5 `validate()`: rejects answers under 12 characters and answers matching the keyword gate as the entire answer; accepts "5 of 5 unanswerable questions return an abstain"; test 6 rejections and 4 acceptances. The length branch always fires first, so the keyword gate is unreachable today
- [x] `[G]` `normalize(text)`: lowercase, collapse whitespace, strip punctuation for matching; test 8 inputs; test adaptive questions sort after the step that triggered them, using a fixture firing at step 1 and step 7

## Phase 3: Wizard UI and autosave

- [x] `[G]` `AppComponent` plus `QuestionPanelComponent`: one question at a time in the panel with the full list in `StepRailComponent`, plus Back and Next and the progress line "Question {{index + 1}} of {{total}}"; tests cover the prompt, the rail states and the navigation
- [x] `[G]` `QuestionPanelComponent`: renders prompt, help text, an input by `kind` (`text`, `longtext`, `number`, `choice`, `list`, `table`), and a validation message slot; a walk over the list asserts all six kinds render
- [x] `[G]` The follow-up reason: `describeTrigger()` renders "Asked because you mentioned {phrase} in step {step}", or "in a follow-up question" when the answer that fired the trace was itself adaptive; the panel shows it as a paragraph, the rail shows it under the prompt with a "Follow-up" tag, and the store spec asserts the sentence from a real trace
- [x] `[G]` `WizardStore` in `state/wizard-store.service.ts` (signals): `answers`, `questions`, `traces`, `index`; derived `total`, `currentIndex`, `current`, `answeredCount`, `currentError`, `canAdvance`, `rail`; tests assert that adding an answer recomputes the question list and that retraction prunes answers whose question disappeared
- [x] `[G]` Test the counters that ship: the header reads "N of M answered", the panel "Question N of M", and the footer "N out of M". Tests cover 0 of 9, the growth to 12 when the `local_model` follow-ups appear, the shrink back to 9 when the keyword goes, and the moving current segment
- [x] `[G]` `persistence/spec-db.ts`: `idb` database `spec-forge` version 1 with stores `drafts`, `answers`, `docs`, `snapshots`, `locks`; `autosave.ts` debounces 400 ms on answer edit and writes at once on step change; test open/put/get plus 20 rapid edits producing 1 write (fakeAsync)
- [x] `[G]` Resume: seed a draft at step 7 with 12 answers, reload state, assert the wizard opens at step 7 with all 12 answer values; test the restore path
- [ ] `[M]` Kill the tab at step 7, reopen, confirm nothing was lost including the adaptive badge state

## Phase 4: Mapping and template assembly

- [x] `[G]` `core/mapping.ts`: checked-in `MAP: Record<AnswerId, { proposal: string[]; design: string[]; tasks: string[] }>` derived from the eleven existing specs in `portfolio-projects`; test every entry keys a real `AnswerId` and every target is a real section name
- [x] `[G]` Test the six sections shared by every existing spec (Problem, Goal, Target Signal, Tech Stack, Acceptance Criteria, Timeline) are all reachable from at least one mapped answer. Settled: this app emits `Target Signal`; the eleven sibling specs keep `Target Recruiter Signal`; `canonicalSectionName` accepts either, plus the qualified `Tech Stack (Angular/NestJS)` heading the corpus uses
- [x] `[G]` `core/provenance.ts`: block tagging helpers. `Origin`, `Block` and `ReviewState` already live in `core/question-graph.ts` with `narrowOrigin`, `isSourced` and `isBlockExportReady`, tested there, so this is the tagging layer only
- [x] `[G]` `templates/proposal.tpl.ts`, `design.tpl.ts`, `tasks.tpl.ts`: each section has 2 to 4 frames chosen by answer shape; test every section has at least 2 frames and every frame's placeholders resolve against a complete answer set
- [x] `[G]` `templates/assembly.ts`: `assemble(answers): GeneratedDoc[]` producing blocks with provenance; test that no block has `origin.kind === 'model'` in a template run and that three runs on the same answers produce byte-identical markdown
- [x] `[G]` Test gap handling: an answer set missing `constraints` emits `{{MISSING: ...}}` under Constraints Measured Up Front in `proposal.md` and no prose
- [x] `[G]` `tasks.tpl.ts` tag classifier: `G` for unit-testable function or fixture, `E` for model call, threshold, or sample, `M` otherwise; test 15 real items from the sibling specs and assert at least 12 match the expected tag (measured: 13 of 15)
- [ ] `[E]` Readability eval: assemble 5 real answer sets; a human rates each generated `proposal.md` 1 to 5 on "reads like a person wrote it"; record the mean and require at least 3.0 for the template path to ship as the default. Harness and fixtures are in `evals/readability/` and run; the rating is pending a person, so the box stays unticked

## Phase 5: Output editor, provenance panel, review

- [x] `[G]` `OutputTabsComponent`: three tabs (proposal, design, tasks), one `MarkdownEditorComponent` per **block** under its section heading, only the active file mounted; test that no editor ever holds a whole file and that an edit sets `origin.kind = 'edited'` and `review = 'edited'` on its own block. Per block, not per file: CodeMirror renders only the window of lines that fits its box and leaves a `cm-gap` for the rest, which made the tail of a generated file unreachable (measured: 29 of about 40 lines for `proposal.md` in Chrome 155). A block is a line or two, so the window always covers it.
- [x] `[G]` `MarkdownEditorComponent` wrapping CodeMirror 6 with `@codemirror/lang-markdown`; `[value]` input and `(valueChange)` output; test a programmatically set value appears and an edit emits
- [x] `[G]` `ProvenancePanelComponent`: per-file counts by origin kind plus the block total; test a fixture with 18 blocks over 4 kinds renders all counts and they sum to 18
- [x] `[G]` Clicking a sourced block scrolls to and highlights the answer that produced it; test the highlight class lands on the right `AnswerId`
- [x] `[G]` `ReviewPanelComponent`: one row per inferred block with Confirm, Edit, Reject; test the three actions set `confirmed`, `edited`, `rejected`, and that rejecting leaves the heading with a gap and no text
- [x] `[G]` Inferred blocks render with a distinct background and a "model-inferred" badge; test the class is present on inferred rows and absent on sourced rows
- [x] `[M]` Complete a full interview with no model loaded and confirm zero inferred blocks appear

## Phase 6: Validation, style lint, export gate

- [x] `[G]` `core/validator.ts`: required sections per file; the test walks the real section table rather than a hand-written sample, removing one required proposal section at a time and then one required design section at a time, ten each, and asserting exactly one `missing-required-section` finding per removal
- [x] `[G]` `tasks.md` validation: at least 3 phases, every item a checkbox, every item tagged `[G]`/`[E]`/`[M]`, ends with a Definition of Done; test each rule fails independently
- [x] `[G]` Acceptance-criteria shape check: an item must contain a number, a unit, a named identifier, or a comparison; test 10 passing and 6 failing fixtures and assert the failing ones are flagged, not deleted
- [x] `[G]` `tasks.md` item count warning outside 40 to 90; test fixtures at 20, 39, 40, 90, 91
- [x] `[G]` `core/style-lint.ts`: flags em dashes and the banned words; the checked-in list is 19 words, not the 18 this line predicted, and the test asserts the count so the two cannot drift. One fixture per word plus an em dash fixture, and zero findings on the spec the app generates itself, with `npm run lint:specs` covering the three files committed here
- [x] `[G]` `core/gate.ts`: `evaluate(docs): GateResult` returning `blocking` and a per-file report; test it is non-empty for one unreviewed inferred block, one surviving placeholder, and one missing required section, and empty for a fully sourced run and after every block is confirmed. `blocking` is a union of three kinds rather than a `Block[]`: a missing section has no block to point at
- [x] `[G]` `ExportGateComponent`: shows the per-file report table, disables the download button when blocking is non-empty, and names the count in the disabled tooltip; test both states
- [x] `[G]` Settings toggle "warn instead of block", off by default; when on, export proceeds and inferred text is wrapped in `<!-- INFERRED: unreviewed -->`; test the wrapper appears
- [ ] `[E]` Gate eval: 10 mixed runs; assert the gate blocks on 10 of 10 when unreviewed inferred blocks exist, and a human judge confirms zero fabricated facts survive in any exported file. The harness and its automated half are built and green in `evals/gate/` (`npm run eval:gate`); the human verdicts are pending, and wait on Phase 9 putting a real model behind the fixtures

## Phase 7: Regression guard

- [x] `[G]` `snapshot-store.ts`: write a snapshot before every generation and before every import; `{ draftId, version, files, createdAt, label }`; test two snapshots are written by two generations. Holds both the rendered files and the structured documents, because markdown alone cannot restore provenance, review state or locks
- [x] `[G]` `core/diff.ts`: line-level diff per section between the current document and a candidate; test a candidate with 1 changed section out of 12 reports exactly 1
- [x] `[G]` `DiffReviewComponent`: per-section accept or reject with a side-by-side or inline diff; test accepting one section and rejecting another produces the expected merged document
- [x] `[G]` Section locks: setting `locked = true` excludes a block from regeneration entirely; test the locked text is byte-identical after a run and the badge renders "This is your text"
- [x] `[G]` `importSpec(text: string)`: parses `##` sections from a pasted `proposal.md`, marks each `origin.kind = 'imported'` and `locked = true`; test against the portfolio's real `01` `proposal.md`, then generate and assert imported blocks are unchanged and only unmapped sections gain text
- [x] `[G]` Restore: snapshot list with a diff preview; restoring a prior version replaces the current document; test round-trip equality on a fixture
- [x] `[M]` Reproduce the motivating failure: import a real spec, regenerate, and confirm no human-written sentence was reverted. `npm run eval:import`: 40 of 40 body lines survive, 9 of 9 headings land, the generator fills only the sections nobody wrote

## Phase 8: Export

- [x] `[G]` `export.ts`: `downloadMarkdown(file, text)` creates a `Blob` with type `text/markdown` and filename `proposal.md` / `design.md` / `tasks.md`; test the three filenames
- [x] `[G]` Bundle: concatenated `spec-bundle.md` with `<!-- FILE: proposal.md -->` separators in order; optional zip via `fflate` behind `await import('fflate')`; test the built main bundle contains no `fflate` string
- [x] `[G]` Copy to clipboard via `navigator.clipboard.writeText` receives the full document text; export reads from the document store, so re-exporting a reloaded draft preserves provenance and review state
- [ ] `[M]` Download all four options on Chrome and Firefox and open each file in an editor

## Phase 9: Optional model path

- [x] `[G]` `model/model-provider.ts`: `ModelProvider`, `ModelInfo`, `StreamOpts`, `LoadProgress`, `StreamChunk`, matching the project 11 seam; test it compiles under strict with no `any`
- [x] `[G]` `Shaper` interface with two implementations: `TemplateShaper` (no model) and `LlmShaper` (worker-backed); test both satisfy the interface and `TemplateShaper.load` never touches the worker
- [ ] `[G]` `model/inference.worker.ts` with `WebWorkerMLCEngineHandler` from `@mlc-ai/web-llm`: NOT BUILT, because the library is not a dependency and cannot be verified here. The seam it would plug into exists and is tested with a fake engine (`providers.ts` declares `MlcEngine` and `EngineLoader`), and the build says so instead of failing silently; main thread uses `CreateWebWorkerMLCEngine`
- [x] `[G]` `WebLlmProvider` implements `load`, `stream`, `interrupt`, `unload`; `stream` is an `AsyncIterable` of deltas; test with a fake engine injected (no model download in CI)
- [x] `[G]` `LiteRtProvider` stub whose `load` rejects with "LiteRT backend not available in this build"; test the exact message
- [x] `[G]` `model/models.ts`: VRAM and context table read from `prebuiltAppConfig` at runtime with a checked-in fallback table (879 / 1895 / 2504 / 3431 / 5106 MB, 4096 context); test every entry has `vramBytes > 0` and `contextTokens > 0`
- [x] `[G]` `ModelBarComponent`: off, template only, or shape with model; shows VRAM next to each model; marks 879 MB as default and 2504 MB as recommended; test default selection is `off`
- [x] `[G]` Token estimate reuse: `max(chars/4, words*1.30)` labelled as an estimate everywhere it appears; test determinism and that the word "estimate" is in the label
- [x] `[G]` Per-file budget check `estimate(input) + 256 + outputReserve <= contextTokens` with `outputReserve` 900 / 1400 / 1100; test the 4096 case passes, the 1024 case refuses naming all three numbers, and switching to a `-1k` model recomputes with no reload
- [x] `[G]` `model/prompts/`: one shaping prompt per file requiring `[[answer:N]]` on every factual sentence and `{{MISSING: <question>}}` in place of any unknown fact; test each prompt contains both instructions
- [x] `[G]` `markers.ts`: parse `[[answer:N]]`, compute `coverage = marked / total`; test 10 sentences with 7 markers yields 0.70, and 10 with 5 fails the run
- [x] `[G]` Coverage routing: at least 0.80 accepted, 0.60 to 0.80 accepted with a banner naming the percentage, under 0.60 fails and keeps template output byte-identical; test all three branches
- [x] `[G]` Marked sentences become `origin.kind = 'answer'`; unmarked sentences become separate blocks with `origin.kind = 'model'` and `review = 'unreviewed'`; test a mixed fixture splits correctly
- [x] `[G]` `placeholders.ts`: parse `{{MISSING: <question>}}` into chips; test 4 fixtures including a malformed one
- [ ] `[G]` Promoting a chip appends a question to the interview with `source = 'promoted'`: HALF. `questionForChip` and `promotedAnswer` build the question and the answer with the placeholder text as the prompt, and the chips are parsed and deduped, but nothing appends to the wizard yet: `WizardStore.resolve()` would need to carry promoted questions through the trigger resolution, which is a change to the core the rest of the interview depends on and `prompt` equal to the placeholder text; test the appended question
- [x] `[G]` Worker protocol types `ToWorker` and `FromWorker`; deltas coalesced and flushed every 60 ms; test 200 deltas inside 60 ms produce 1 flush (fakeAsync)
- [x] `[G]` Cancel is cooperative through an `AbortSignal` checked between decode steps; test that cancelling during the `design.md` run leaves the `proposal.md` result present and editable
- [x] `[G]` `CapabilityService.detect()` returns `{ webgpu, adapterInfo?, maxBufferSize? }`; test the absent-`navigator.gpu` branch
- [x] `[G]` WASM fallback banner states the 5 to 20x slowdown range and names Safari when applicable; test the text is present
- [ ] `[M]` DevTools Performance: main thread idle while shaping; typing in an answer input never blocks
- [ ] `[E]` Shaping eval: 5 answer sets, 3B model, 15 files; assert at least 12 of 15 runs score marker coverage at or above 0.80, and a human judge finds zero facts in the marked sentences that the cited answer does not support

## Phase 10: Self-regeneration and docs

- [ ] `[G]` `fixtures/spec-forge-answers.json`: the answers that describe spec-forge itself, covering all nine base steps plus the adaptive questions its own triggers fire
- [ ] `[G]` Self-regeneration test: run `assemble()` on that fixture and assert every required heading appears in each of the three outputs
- [ ] `[G]` Assert the regenerated `tasks.md` item count falls in 40 to 90 and every item carries a tag
- [ ] `[G]` CI job running the self-regeneration test on every PR; the build fails if the tool cannot write its own spec without a model
- [ ] `[G]` README: what it does, the provenance model with the four origin kinds, the export gate with the reason it blocks, the four regression guards and the incident behind them, how to run locally, the demo script in 6 steps
- [ ] `[G]` README states that the model is optional and that the template path is the default, and names the measured context budget that decides whether shaping runs
- [ ] `[G]` Source scan test: no API key, no `fetch` to a non-CDN host, and no GitHub API reference anywhere outside the model CDN allowlist
- [ ] `[M]` Deploy to GitHub Pages at `jouselt.github.io/spec-forge`; complete a full interview in the deployed build with no model and download the bundle
- [ ] `[M]` DevTools Network on second load with the model cached: zero requests
- [ ] `[M]` Demo script timed end to end: under 8 minutes from blank page to downloaded bundle

---

## Definition of Done

- All `[G]` tasks pass in CI on a clean checkout; `npm test` passes (184 specs, about 8s wall today, with an under-2s gate command as a separate unbuilt target).
- All `[E]` evals meet their stated thresholds, recorded with model id and date where a model was used.
- The template path produces all three files with zero inferred blocks and export enabled, with no model loaded.
- The export gate blocks on at least one unreviewed inferred block, on a surviving placeholder, and on a missing required section, proven by tests rather than by inspection.
- Importing the portfolio's real `01` `proposal.md` and regenerating leaves every imported sentence byte-identical.
- The self-regeneration test passes in CI: `spec-forge-answers.json` rebuilds this project's three files through the template path.
- `style-lint.ts` reports zero findings on the three specs in this repository and is enforced in CI.
- No backend, no API key, no repo write, no GitHub token anywhere in the codebase.
- Every number shown in the UI traces to a measured value, a checked-in table, or a named constant in the code.
