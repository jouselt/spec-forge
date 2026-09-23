# 12: spec-forge: Tasks

Angular 20.3 standalone, TypeScript strict, no backend, no API key. Every task ships with its tests in the same commit. Gate tests are deterministic and local. Evals call a browser model and are slower.

Legend: `[G]` gate test, `[E]` eval, `[M]` manual verification.

Boxes are ticked where the code exists. The committed suite is `npm test`, which runs the whole Karma suite with coverage and takes about 8s wall including the build and the browser launch; a separate under-2s gate command does not exist yet.

Versions are pinned to the stack this repository uses: `@angular/core` 20.3.x. The deterministic core imports nothing from Angular, IndexedDB, or WebLLM. The model path is optional; the template path must work with no model and is tested first.

---

## Phase 1: Shell and scaffold

- [x] `[G]` `ng new spec-forge --standalone --style=scss --routing=false`; assert `@angular/core` resolves to `20.3.x`; set `"strict": true` and `"strictTemplates": true` in `tsconfig.json`; `npm run build` succeeds
- [x] `[G]` Directory layout under `src/app/`: `core/`, `templates/`, `model/`, `state/`, `persistence/`, `ui/`
- [ ] `[G]` Source scan test: no file under `core/` or `templates/` imports from `@angular/core`, from `idb`, or from `@mlc-ai/web-llm` (fails the build). No such scan exists yet
- [x] `[G]` `AppComponent` (selector `app-root`) with a header, a collapsible step rail on the left, a content region, and the footer stepper; tests cover the header, the populated rail, the rail toggle and the footer
- [x] `[G]` `npm run typecheck` (`tsc --noEmit`) wired, and a GitHub Actions workflow running `npm ci && npm run typecheck && npm test && npm run build`
- [ ] `[G]` `npm run lint` wired into a pre-commit hook and into CI. The script does not exist, eslint is not installed, and `.eslintrc.json` also names `@typescript-eslint/parser` and a `@typescript-eslint` rule that are not dependencies
- [ ] `[M]` A gate command that completes in under 2s on a clean checkout. `npm test` runs the whole Karma suite with coverage and takes about 8s wall

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
- [ ] `[G]` `persistence/spec-db.ts`: `idb` database `spec-forge` version 1 with stores `drafts`, `answers`, `docs`, `snapshots`, `locks`; `autosave.ts` debounces 400 ms on answer edit and writes at once on step change; test open/put/get plus 20 rapid edits producing 1 write (fakeAsync)
- [ ] `[G]` Resume: seed a draft at step 7 with 12 answers, reload state, assert the wizard opens at step 7 with all 12 answer values; test the restore path
- [ ] `[M]` Kill the tab at step 7, reopen, confirm nothing was lost including the adaptive badge state

## Phase 4: Mapping and template assembly

- [ ] `[G]` `core/mapping.ts`: checked-in `MAP: Record<AnswerId, { proposal: string[]; design: string[]; tasks: string[] }>` derived from the eleven existing specs in `portfolio-projects`; test every entry keys a real `AnswerId` and every target is a real section name
- [ ] `[G]` Test the six sections shared by every existing spec (Problem, Goal, Target Recruiter Signal, Tech Stack, Acceptance Criteria, Timeline) are all reachable from at least one mapped answer. The eleven existing specs use the older heading `Target Recruiter Signal`; this repository's own spec renamed it to `Target Signal`, so settle the spelling before writing the check
- [ ] `[G]` `core/provenance.ts`: block tagging helpers. `Origin`, `Block` and `ReviewState` already exist in `core/question-graph.ts` with `narrowOrigin`, `isSourced` and `isBlockExportReady`, tested there, so this task is the tagging layer only
- [ ] `[G]` `templates/proposal.tpl.ts`, `design.tpl.ts`, `tasks.tpl.ts`: each section has 2 to 4 frames chosen by answer shape; test every section has at least 2 frames and every frame's placeholders resolve against a complete answer set
- [ ] `[G]` `assembly.ts`: `assemble(answers): GeneratedDoc[]` producing blocks with provenance; test that no block has `origin.kind === 'model'` in a template run and that three runs on the same answers produce byte-identical markdown
- [ ] `[G]` Test gap handling: an answer set missing `constraints` emits `{{MISSING: ...}}` under Constraints Measured Up Front in `proposal.md` and no prose
- [ ] `[G]` `tasks.tpl.ts` tag classifier: `G` for unit-testable function or fixture, `E` for model call, threshold, or sample, `M` otherwise; test 15 items and assert at least 12 match the expected tag
- [ ] `[E]` Readability eval: assemble 5 real answer sets; a human rates each generated `proposal.md` 1 to 5 on "reads like a person wrote it"; record the mean and require at least 3.0 for the template path to ship as the default

## Phase 5: Output editor, provenance panel, review

- [ ] `[G]` `OutputTabsComponent`: three tabs (proposal, design, tasks), one `MarkdownEditorComponent` per tab; test switching tabs preserves each editor's content and that a one-character edit sets `origin.kind = 'edited'` and `review = 'edited'`
- [ ] `[G]` `MarkdownEditorComponent` wrapping CodeMirror 6 with `@codemirror/lang-markdown`; `[value]` input and `(valueChange)` output; test a programmatically set value appears and an edit emits
- [ ] `[G]` `ProvenancePanelComponent`: per-file counts by origin kind plus the block total; test a fixture with 18 blocks over 4 kinds renders all counts and they sum to 18
- [ ] `[G]` Clicking a sourced block scrolls to and highlights the answer that produced it; test the highlight class lands on the right `AnswerId`
- [ ] `[G]` `ReviewPanelComponent`: one row per inferred block with Confirm, Edit, Reject; test the three actions set `confirmed`, `edited`, `rejected`, and that rejecting leaves the heading with a gap and no text
- [ ] `[G]` Inferred blocks render with a distinct background and a "model-inferred" badge; test the class is present on inferred rows and absent on sourced rows
- [ ] `[M]` Complete a full interview with no model loaded and confirm zero inferred blocks appear

## Phase 6: Validation, style lint, export gate

- [ ] `[G]` `core/validator.ts`: required sections per file; test six fixtures that each violate exactly one required proposal section, nine that each violate one required design section, and one passing fixture per file
- [ ] `[G]` `tasks.md` validation: at least 3 phases, every item a checkbox, every item tagged `[G]`/`[E]`/`[M]`, ends with a Definition of Done; test each rule fails independently
- [ ] `[G]` Acceptance-criteria shape check: an item must contain a number, a unit, a named identifier, or a comparison; test 10 passing and 6 failing fixtures and assert the failing ones are flagged, not deleted
- [ ] `[G]` `tasks.md` item count warning outside 40 to 90; test fixtures at 20, 39, 40, 90, 91
- [ ] `[G]` `core/style-lint.ts`: flags em dashes and 18 checked-in banned words; test one fixture per word plus an em dash fixture, and assert zero findings on the three specs committed in this repository
- [ ] `[G]` `core/gate.ts`: `evaluate(docs): GateResult` returning `blocking: Block[]` and a per-file report; test it is non-empty for one unreviewed inferred block, one surviving placeholder, and one missing required section, and empty for a fully sourced run and after every block is confirmed
- [ ] `[G]` `ExportGateComponent`: shows the per-file report table, disables the download button when blocking is non-empty, and names the count in the disabled tooltip; test both states
- [ ] `[G]` Settings toggle "warn instead of block", off by default; when on, export proceeds and inferred text is wrapped in `<!-- INFERRED: unreviewed -->`; test the wrapper appears
- [ ] `[E]` Gate eval: 10 mixed runs; assert the gate blocks on 10 of 10 when unreviewed inferred blocks exist, and a human judge confirms zero fabricated facts survive in any exported file

## Phase 7: Regression guard

- [ ] `[G]` `snapshot-store.ts`: write a snapshot before every generation and before every import; `{ draftId, version, files, createdAt, label }`; test two snapshots are written by two generations
- [ ] `[G]` `core/diff.ts`: line-level diff per section between the current document and a candidate; test a candidate with 1 changed section out of 12 reports exactly 1
- [ ] `[G]` `DiffReviewComponent`: per-section accept or reject with a side-by-side or inline diff; test accepting one section and rejecting another produces the expected merged document
- [ ] `[G]` Section locks: setting `locked = true` excludes a block from regeneration entirely; test the locked text is byte-identical after a run and the badge renders "This is your text"
- [ ] `[G]` `importSpec(text: string)`: parses `##` sections from a pasted `proposal.md`, marks each `origin.kind = 'imported'` and `locked = true`; test against the portfolio's real `01` `proposal.md`, then generate and assert imported blocks are unchanged and only unmapped sections gain text
- [ ] `[G]` Restore: snapshot list with a diff preview; restoring a prior version replaces the current document; test round-trip equality on a fixture
- [ ] `[M]` Reproduce the motivating failure: import a real spec, regenerate, and confirm no human-written sentence was reverted

## Phase 8: Export

- [ ] `[G]` `export.ts`: `downloadMarkdown(file, text)` creates a `Blob` with type `text/markdown` and filename `proposal.md` / `design.md` / `tasks.md`; test the three filenames
- [ ] `[G]` Bundle: concatenated `spec-bundle.md` with `<!-- FILE: proposal.md -->` separators in order; optional zip via `fflate` behind `await import('fflate')`; test the built main bundle contains no `fflate` string
- [ ] `[G]` Copy to clipboard via `navigator.clipboard.writeText` receives the full document text; export reads from the document store, so re-exporting a reloaded draft preserves provenance and review state
- [ ] `[M]` Download all four options on Chrome and Firefox and open each file in an editor

## Phase 9: Optional model path

- [ ] `[G]` `model/model-provider.ts`: `ModelProvider`, `ModelInfo`, `StreamOpts`, `LoadProgress`, `StreamChunk`, matching the project 11 seam; test it compiles under strict with no `any`
- [ ] `[G]` `Shaper` interface with two implementations: `TemplateShaper` (no model) and `LlmShaper` (worker-backed); test both satisfy the interface and `TemplateShaper.load` never touches the worker
- [ ] `[G]` `model/inference.worker.ts` with `WebWorkerMLCEngineHandler` from `@mlc-ai/web-llm`; main thread uses `CreateWebWorkerMLCEngine`
- [ ] `[G]` `WebLlmProvider` implements `load`, `stream`, `interrupt`, `unload`; `stream` is an `AsyncIterable` of deltas; test with a fake engine injected (no model download in CI)
- [ ] `[G]` `LiteRtProvider` stub whose `load` rejects with "LiteRT backend not available in this build"; test the exact message
- [ ] `[G]` `model/models.ts`: VRAM and context table read from `prebuiltAppConfig` at runtime with a checked-in fallback table (879 / 1895 / 2504 / 3431 / 5106 MB, 4096 context); test every entry has `vramBytes > 0` and `contextTokens > 0`
- [ ] `[G]` `ModelBarComponent`: off, template only, or shape with model; shows VRAM next to each model; marks 879 MB as default and 2504 MB as recommended; test default selection is `off`
- [ ] `[G]` Token estimate reuse: `max(chars/4, words*1.30)` labelled as an estimate everywhere it appears; test determinism and that the word "estimate" is in the label
- [ ] `[G]` Per-file budget check `estimate(input) + 256 + outputReserve <= contextTokens` with `outputReserve` 900 / 1400 / 1100; test the 4096 case passes, the 1024 case refuses naming all three numbers, and switching to a `-1k` model recomputes with no reload
- [ ] `[G]` `model/prompts/`: one shaping prompt per file requiring `[[answer:N]]` on every factual sentence and `{{MISSING: <question>}}` in place of any unknown fact; test each prompt contains both instructions
- [ ] `[G]` `markers.ts`: parse `[[answer:N]]`, compute `coverage = marked / total`; test 10 sentences with 7 markers yields 0.70, and 10 with 5 fails the run
- [ ] `[G]` Coverage routing: at least 0.80 accepted, 0.60 to 0.80 accepted with a banner naming the percentage, under 0.60 fails and keeps template output byte-identical; test all three branches
- [ ] `[G]` Marked sentences become `origin.kind = 'answer'`; unmarked sentences become separate blocks with `origin.kind = 'model'` and `review = 'unreviewed'`; test a mixed fixture splits correctly
- [ ] `[G]` `placeholders.ts`: parse `{{MISSING: <question>}}` into chips; test 4 fixtures including a malformed one
- [ ] `[G]` Promoting a chip appends a question to the interview with `source = 'promoted'` and `prompt` equal to the placeholder text; test the appended question
- [ ] `[G]` Worker protocol types `ToWorker` and `FromWorker`; deltas coalesced and flushed every 60 ms; test 200 deltas inside 60 ms produce 1 flush (fakeAsync)
- [ ] `[G]` Cancel is cooperative through an `AbortSignal` checked between decode steps; test that cancelling during the `design.md` run leaves the `proposal.md` result present and editable
- [ ] `[G]` `CapabilityService.detect()` returns `{ webgpu, adapterInfo?, maxBufferSize? }`; test the absent-`navigator.gpu` branch
- [ ] `[G]` WASM fallback banner states the 5 to 20x slowdown range and names Safari when applicable; test the text is present
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
