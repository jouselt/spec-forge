# spec-forge

A 100% client-side Angular 20.3 app that interviews users about an idea and produces three markdown files: `proposal.md`, `design.md`, `tasks.md`. Interview first, generate second, never invent.

## Quick Start

```bash
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

## Development

- `npm start` — Serve locally on port 4200
- `npm run build` — Build for production
- `npm test` — Run unit tests (gate suite, runs in under 2s)
- `npm run typecheck` — Check TypeScript types with strict mode
- `npm run lint` — Run linter

## Project Structure

```
src/app/
  core/              Pure functions, no Angular/IndexedDB/WebLLM
    question-graph.ts    Core types (Answer, Block, Origin, etc.)
    steps.ts             Nine base questions
    triggers.ts          Pattern matching for adaptive questions
    mapping.ts           Answer ID → (file, section) table
    assembly.ts          Template rendering
    validator.ts         Structure, shape, and style checks
    gate.ts              Export gate evaluation
    diff.ts              Line-level diff and merge
    style-lint.ts        Em dashes and banned words
    export.ts            Blob building and export

  templates/         Template rendering (no model)
    proposal.tpl.ts   Section frames for proposal.md
    design.tpl.ts     Section frames for design.md
    tasks.tpl.ts      Phase and item frames for tasks.md

  model/             Optional model path (WebLLM)
    model-provider.ts    Interface and implementations
    prompts/             Shaping prompts per file
    markers.ts           [[answer:N]] parsing
    placeholders.ts      {{MISSING: ...}} parsing
    inference.worker.ts  Web Worker for LLM

  state/             Signal-based state management
    interview-store.ts   answers, triggers, derived state
    review-store.ts      per-block review state
    snapshot-store.ts    versioned documents and restore

  persistence/       IndexedDB
    spec-db.ts        Schema and migrations
    autosave.ts       Debounced writer

  ui/                Angular components
    wizard/            Interview stepper
    output-tabs/       CodeMirror editors
    review-panel/      Inferred block review
    export-gate/       Export report and button
```

## The Design

See [design.md](./design.md) for the full architecture, data model, and trade-offs.

**Key points:**
- **Interview before generation.** Nine base steps + adaptive triggers capture all the hard questions.
- **Template path is the default.** No model needed; output traces to answers.
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
- [ ] TypeScript strict + strictTemplates pass with no errors.
- [ ] No backend, no API key, no GitHub integration.

## Tech Stack

- Angular 20.3, standalone components, signals, TypeScript strict
- CodeMirror 6 for markdown editing
- IndexedDB (idb) for persistence
- @mlc-ai/web-llm (optional) for in-browser inference
- fflate (dynamic import) for optional zip export
- No state library (signals are enough)
- No backend (static deploy)
