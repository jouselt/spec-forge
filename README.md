# spec-forge

[![Deploy to GitHub Pages](https://github.com/jouselt/spec-forge/actions/workflows/pages.yml/badge.svg)](https://github.com/jouselt/spec-forge/actions/workflows/pages.yml)
[![CI](https://github.com/jouselt/spec-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/jouselt/spec-forge/actions/workflows/ci.yml)

**[Open the live build](https://jouselt.github.io/spec-forge/)** (currently the Phase 1 shell).

A 100% client-side Angular 20.3 app that interviews users about an idea and produces three markdown files: `proposal.md`, `design.md`, `tasks.md`. Interview first, generate second, never invent.

## Status

**Phase 1 of 6.** This repository holds the Angular shell, the core types, and the first three core modules with their tests. Everything marked `planned` in the structure below does not exist yet. `tasks.md` tracks the remaining 89 items.

Working today:

- `core/question-graph.ts`: the core types (Answer, Block, Origin)
- `core/steps.ts`: the nine base questions
- `core/triggers.ts`: keyword matching for adaptive questions
- `npm run typecheck`, `npm run build`, and `npm test` pass
- `docker compose up` serves the app

Not built yet: the mapping, assembly, validation, export gate, template, persistence, and UI layers.

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
    question-graph.ts    Core types (Answer, Block, Origin)          done
    steps.ts             Nine base questions                          done
    triggers.ts          Pattern matching for adaptive questions      done
    mapping.ts           Answer ID to (file, section) table           planned
    assembly.ts          Template rendering                            planned
    validator.ts         Structure, shape, and style checks           planned
    gate.ts              Export gate evaluation                       planned
    diff.ts              Line-level diff and merge                    planned
    style-lint.ts        Em dashes and banned words                   planned
    export.ts            Blob building and export                     planned

  templates/         Template rendering (no model)                    planned
  model/             Optional model path (WebLLM)                     planned
  state/             Signal-based state management                    planned
  persistence/       IndexedDB                                        planned
  ui/                Angular components                               planned
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
- [ ] Adaptive triggers fire on keyword matches and retract when keywords are removed.
- [ ] Export is blocked while any block is inferred and unreviewed.
- [ ] Snapshots before every generation preserve prior versions.
- [ ] Importing a real spec and regenerating leaves imported text unchanged.
- [ ] `npm test` runs the gate suite in under 2s.
- [ ] TypeScript strict plus strictTemplates pass with no errors.
- [ ] No backend, no API key, no GitHub integration.

## Tech Stack

- Angular 20.3, standalone components, signals, TypeScript strict
- CodeMirror 6 for markdown editing
- IndexedDB (idb) for persistence
- @mlc-ai/web-llm (optional) for in-browser inference
- fflate (dynamic import) for optional zip export
- No state library (signals are enough)
- No backend (static deploy)

## License

MIT. See [LICENSE](./LICENSE).
