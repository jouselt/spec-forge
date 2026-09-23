# spec-forge

[![Deploy to GitHub Pages](https://github.com/jouselt/spec-forge/actions/workflows/pages.yml/badge.svg)](https://github.com/jouselt/spec-forge/actions/workflows/pages.yml)
[![CI](https://github.com/jouselt/spec-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/jouselt/spec-forge/actions/workflows/ci.yml)

**[Open the live build](https://jouselt.github.io/spec-forge/)** (the interview wizard is live; generation is not built yet).

A 100% client-side Angular 20.3 app that interviews users about an idea and will produce three markdown files once the generation layer lands: `proposal.md`, `design.md`, `tasks.md`. Interview first, generate second, never invent.

## Status

**The interview is built; generation is not.** This repository holds the core types, the nine base questions, the ten adaptive triggers, the signal store, and the interview UI.

Working today:

- `core/question-graph.ts`: the core types (Answer, Question, Block, Origin) and three helpers
- `core/steps.ts`: the nine base questions, with the step 5 proof check
- `core/triggers.ts`: the ten-trigger table and `evaluateTriggers`, including retraction when a keyword is removed
- `state/wizard-store.service.ts`: the answers, the question list derived from them, the position, and validation
- `state/trigger-reason.ts`: the "Asked because you mentioned {phrase} in step {step}" sentence
- `ui/`: the question panel, the step rail, the step-stepper footer, and six controls (text, longtext, number, choice, list, table)
- `npm run typecheck`, `npm run build`, and `npm test` (184 specs) pass
- `docker compose up` serves the app

Not built yet: the mapping, assembly, validation, export gate, templates, and persistence. No code writes a spec file today.

`tasks.md` carries the phase list. Phase 1, Phase 2 and most of Phase 3 are implemented, and their boxes are ticked where the code exists. The rest of the plan is untouched.

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

## Project Structure

Only the files listed as done exist today.

```
src/app/
  core/              Pure functions, no Angular, no IndexedDB, no WebLLM
    question-graph.ts    Core types (Answer, Question, Block, Origin)   done
    steps.ts             Nine base questions                             done
    triggers.ts          Ten-trigger table and evaluateTriggers           done
    mapping.ts           Answer ID to (file, section) table              planned
    assembly.ts          Template rendering                              planned
    validator.ts         Structure, shape, and style checks              planned
    gate.ts              Export gate evaluation                          planned
    diff.ts              Line-level diff and merge                       planned
    style-lint.ts        Em dashes and banned words                      planned
    export.ts            Blob building and export                        planned

  templates/         Template rendering (no model)                        planned
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

- [ ] Completing the nine base steps produces three files with zero inferred blocks.
- [x] Adaptive triggers fire on keyword matches and retract when keywords are removed.
- [ ] Export is blocked while any block is inferred and unreviewed.
- [ ] Snapshots before every generation preserve prior versions.
- [ ] Importing a real spec and regenerating leaves imported text unchanged.
- [x] `npm test` passes: 184 specs, about 8s wall time including the build and the browser launch.
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
