# spec-forge

[![Deploy to GitHub Pages](https://github.com/jouselt/spec-forge/actions/workflows/pages.yml/badge.svg)](https://github.com/jouselt/spec-forge/actions/workflows/pages.yml)
[![CI](https://github.com/jouselt/spec-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/jouselt/spec-forge/actions/workflows/ci.yml)

**[Open the live build](https://jouselt.github.io/spec-forge/)** (the interview, the generation and the output view are live; the export gate behind them is not built).

A 100% client-side Angular 20.3 app that interviews users about an idea and produces three markdown files with no model involved: `proposal.md`, `design.md`, `tasks.md`. Interview first, generate second, never invent.

## Status

**The interview is built, and so is the no-model generation path end to end.** Finish the interview, press Generate, and the three files appear with every block tagged by where it came from, a review panel for anything a model wrote, one editor per block, and an export gate that refuses to hand over a file while anything is unreviewed or unanswered. The model path, snapshots, the bundle and the zip are not built.

Working today:

- `core/question-graph.ts`: the core types (Answer, Question, Block, Origin) and three helpers
- `core/steps.ts`: the nine base questions, with the step 5 proof check
- `core/triggers.ts`: the ten-trigger table and `evaluateTriggers`, including retraction when a keyword is removed
- `core/mapping.ts`: the checked-in answer-to-section table, with both heading spellings accepted
- `core/provenance.ts`: block tagging, so every block names the answer it came from or is a marked gap
- `core/validator.ts`: required sections, surviving gaps, the acceptance-criterion shape rule, and the four `tasks.md` rules, split into what blocks an export and what is worth a warning
- `core/style-lint.ts` and `core/banned-words.json`: the em dash and the 19 banned words, one finding per rule per block
- `core/gate.ts`: three documents in, one decision out, with a per-file report
- `templates/`: `frame.ts`, the three template modules, and `assembly.ts`, which turns answers into blocks with no model
- `state/wizard-store.service.ts`: the answers, the question list derived from them, the position, validation, and the answer a block came from
- `state/document-store.service.ts`: the generated documents, the generate action, block text edits, and the confirm, edit and reject review transitions
- `state/trigger-reason.ts`: the "Asked because you mentioned {phrase} in step {step}" sentence
- `ui/`: the question panel, the step rail, the step-stepper footer, six controls, the output tabs with one CodeMirror per block, the provenance panel, the review panel, the block list with click-to-source, and the export gate
- `npm run typecheck`, `npm run build`, and `npm test` (410 specs) pass
- `npm run lint:specs` holds the three specs in this repository to the same style rules the app enforces, and runs in CI
- `npm run eval:readability` and `npm run eval:gate`, each with a half a machine cannot do
- `docker compose up` serves the app

Not built yet: the model path, persistence, snapshots, and the bundle plus zip export. A single file downloads; three files at once and a clipboard copy do not.

`tasks.md` carries the phase list. Phases 1 to 5 are closed and Phase 6 is closed except its eval. Three boxes stay open, and all three need a person: the readability eval in Phase 4, the lint plus under-2s gate in Phase 1, and the human verdicts of the gate eval in Phase 6.

## Quick Start

The fastest path needs nothing but Docker. There is no backend, no database, and no API key, so there is nothing to configure.

```bash
git clone https://github.com/jouselt/spec-forge.git
cd spec-forge
docker compose up -d
```

Open [http://localhost:8080](http://localhost:8080). Set `WEB_PORT` to serve it elsewhere: `WEB_PORT=9000 docker compose up -d`.

The image is a multi-stage build (Node builds the app, nginx serves the static output), so Node is not needed on your machine. The build accepts `BASE_HREF` if you serve the app under a subpath instead of at the root.

## Development

```bash
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200).

| Command | What it does |
| --- | --- |
| `npm start` | Serve locally on port 4200 |
| `npm run build` | Typecheck, then build for production into `dist/spec-forge` |
| `npm test` | Run unit tests headless (Karma, ChromeHeadless) |
| `npm run typecheck` | TypeScript strict check with no emit |
| `npm run eval:readability` | Assemble five real answer sets and write the rating sheet |
| `npm run eval:readability:score` | Read `ratings.csv`; exits non-zero while a rating is missing |

## Project Structure

Only the files listed as done exist today.

```
src/app/
  core/              Pure functions, no Angular, no IndexedDB, no WebLLM
    question-graph.ts    Core types (Answer, Question, Block, Origin)   done
    steps.ts             Nine base questions                             done
    triggers.ts          Ten-trigger table and evaluateTriggers           done
    mapping.ts           Answer ID to (file, section) table              done
    provenance.ts        Block tagging, gaps, origin counts              done
    validator.ts         Structure, shape, and style checks              planned
    gate.ts              Export gate evaluation                          planned
    diff.ts              Line-level diff and merge                       planned
    style-lint.ts        Em dashes and banned words                      planned
    export.ts            Blob building and export                        planned

  templates/         Template rendering (no model)                        done
    frame.ts             Frame vocabulary, tokens, shape patterns        done
    proposal.tpl.ts      Section frames for proposal.md                  done
    design.tpl.ts        Section frames for design.md                    done
    tasks.tpl.ts         Phase frames and the tag classifier             done
    assembly.ts          AnswerSet to Blocks with provenance             done
    fixtures/            Five answer sets for the readability eval       done
  model/             Optional model path (WebLLM)                         planned
  state/             Signal-based state management                        done
    wizard-store.service.ts   Answers, derived question list, position    done
    trigger-reason.ts         Follow-up reason sentence                   done
    review-store.ts           Per-block review state                      planned
    snapshot-store.ts         Versions, locks, restore                    planned
  persistence/       IndexedDB                                             planned
  ui/                Angular components                                    done
    question-panel/  Prompt, help, reason, control, validation, nav        done
    step-rail/       Every question in order, with state and reason        done
    step-stepper/    Segment row plus the "N out of M" footer              done
    controls/        text, longtext, number, choice, list, table           done
evals/readability/   Harness, fixtures output and the rating sheet         done
```

## The Design

See [design.md](./design.md) for the full architecture, data model, and trade-offs.

**Key points:**

- **Interview before generation.** Nine base steps plus adaptive triggers capture the hard questions up front.
- **Template path is the default.** No model needed; output traces back to answers.
- **Export gate blocks on inferred content.** Unreviewed model text and missing sections prevent export.
- **Regression guards.** Snapshots, diff-before-apply, section locks, and import-merge.
- **Marker protocol.** Model-generated prose must cite sources with `[[answer:N]]`. Coverage under 60% fails the run.

## Acceptance Criteria

- [x] Completing the nine base steps produces three files with zero inferred blocks.
- [x] Adaptive triggers fire on keyword matches and retract when keywords are removed.
- [ ] Export is blocked while any block is inferred and unreviewed.
- [ ] Snapshots before every generation preserve prior versions.
- [ ] Importing a real spec and regenerating leaves imported text unchanged.
- [x] `npm test` passes: 299 specs, about 13s wall time including the build and the browser launch.
- [ ] A gate suite that finishes in under 2s. Today `npm test` runs the whole Karma suite with coverage, so the 2s budget is an unbuilt target, not a measurement.
- [x] TypeScript strict plus strictTemplates pass with no errors.
- [x] No backend, no API key, no GitHub integration.

## Tech Stack

- Angular 20.3, standalone components, signals, TypeScript strict
- Karma and Jasmine for the suite; Docker and nginx for the static serve
- No state library (signals are enough)
- No backend (static deploy)
- Declared in `package.json` for later phases, imported nowhere in `src/` yet: `codemirror`, `@codemirror/view`, `@codemirror/lang-markdown`, `idb`, `fflate`
- Not a dependency: `@mlc-ai/web-llm`. The optional in-browser model path is described in [proposal.md](./proposal.md) and [design.md](./design.md), but the package is not in `package.json` and is not installed

## License

MIT. See [LICENSE](./LICENSE).
