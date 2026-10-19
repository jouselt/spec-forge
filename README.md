# spec-forge

A 100% client-side Angular 20.3 app that interviews you about a project and writes three
markdown files: `proposal.md`, `design.md`, `tasks.md`. No backend, no API key, no account.

Interview first, generate second, never invent.

## What it does

Nine base questions, plus follow-up questions that fire when an answer mentions something
specific. Every answer becomes part of the three files, and every block in those files says
where it came from. Nothing is written that cannot be traced.

**Nothing about this app needs a model.** The default path assembles the files from your
answers with templates, and it produces complete documents with zero inferred blocks. The
optional model path shapes the same answers into prose and then has to prove every sentence
against them before the output is used.

## The provenance model

One record per block, `origin.kind`, one of six:

- **answer**: the text came from an answer you gave by name, and the block stores which
  answers it cites.
- **template**: the sentence is a frame filled from answers, so it cannot claim more than
  they do.
- **model**: a model wrote it. New model prose starts `review = 'unreviewed'`, and an
  unreviewed inferred block is what the export gate blocks on.
- **imported**: the text was yours before this app saw it. Imported blocks are locked and a
  regeneration may not touch them.
- **edited**: you changed a block after it was generated, so the record says so.
- **missing**: a question the interview has not answered yet.

The interface, the export gate, the diff and the snapshots all read that field. There is no
second place where "where did this come from" is answered.

## The export gate

The gate decides whether the three files may be handed over, and it always shows the reason.
It blocks on three things:

- an inferred block nobody has reviewed, because a guess that reads well is the failure this
  tool exists to prevent;
- a surviving `{{MISSING: ...}}` placeholder, because a visible hole is honest and an export
  with a hole in it is not;
- a missing required section.

The safest path is also the fastest one: complete the interview, press Generate, and the
gate has nothing to block on. Warnings that do not block (a banned word, a short acceptance
criterion) are listed without disabling anything, and a setting switches the block into a
warning that marks the text instead of stopping the export.

## The four regression guards

One failure, four mechanisms, because one was not enough. The incident: a regeneration
replaced a document wholesale, so the paragraph a person had rewritten by hand came back in
the model's words, and nothing on screen said so.

- **Snapshots.** Written before every generation and every import, holding both the rendered
  files and the structured blocks, because markdown alone cannot restore provenance.
- **Diff before apply.** A regeneration is proposed, never applied: the diff lists the
  sections it would change and a person accepts or rejects each one. A locked section is
  shown and cannot be ticked.
- **Section locks.** A section holding locked text is copied through a merge byte for byte.
  Imported text is locked by definition, so re-importing a spec you already wrote and
  regenerating leaves every sentence of it alone.
- **Import-merge.** `npm run eval:import` proves it against a real 71-line proposal: 40 of 40
  body lines survive, 9 of 9 headings land, and the generator fills only the sections nobody
  wrote.

## The model is optional

Off by default. Three modes: off, template only, shape with a model. Every model is listed
with its download size before anything is opened: the 879 MB one is the default and the 3.4 GB
one is recommended.

Whether shaping runs at all is decided by a measured budget, not by optimism:

```
estimate(input) + 256 + outputReserve <= contextTokens
```

`estimate` is `max(chars / 4, words * 1.30)`, always labelled an estimate. The context window
is 4096 tokens per file, the overhead is 256, and the per-file output reserve is 900 for
`proposal.md`, 1400 for `design.md` and 1100 for `tasks.md`. A run that does not fit is
refused with all four numbers named, and switching to a smaller-window model recomputes
without reloading anything.

Model output must cite its sources: every factual sentence ends with `[[answer:N]]`. At 0.80
coverage and above the run is accepted, between 0.60 and 0.80 it is accepted with a banner
naming the percentage, and under 0.60 it is thrown away and your template output stays exactly
as it was.

## Run it

The fastest path needs nothing but Docker.

```bash
git clone https://github.com/jouselt/spec-forge.git
cd spec-forge
docker compose up -d
```

Open http://localhost:8080. Set `WEB_PORT` to serve it elsewhere.

For development:

```bash
npm install    # also points git at .githooks, which runs the gate before a commit
npm start      # http://localhost:4200
```

| Command | What it does |
| --- | --- |
| `npm start` | Serve locally on port 4200 |
| `npm run build` | Build for production into `dist/spec-forge` |
| `npm test` | The whole suite, headless (610 specs) |
| `npm run gate` | The pre-commit check: layering, spec style, ESLint on staged files |
| `npm run typecheck` | TypeScript strict, no emit |
| `npm run lint` | ESLint over the whole tree, as CI runs it |
| `npm run lint:specs` | The three specs in this repo against the style rules the app enforces |
| `npm run eval:readability` | Assemble five real answer sets and write the rating sheet |
| `npm run eval:gate` | Ten mixed runs against the gate |
| `npm run eval:import` | Import a real proposal, regenerate, check every line survived |
| `npm run eval:bundle` | Build, then assert the zip library stayed out of the initial bundle |

The gate is fast enough to leave switched on: 1494 ms with one staged file. It runs the
layering scan and the spec style lint over the whole repository and ESLint over what you are
about to commit, which is the only way a check survives contact with a person who is in a
hurry.

## Demo script

1. Open the app. The model bar says Off and the template path is already selected.
2. Answer the nine questions, using a real project you have. Mention something specific in an
   answer and watch the follow-up appear with the reason it was asked.
3. Press Generate. Three files appear, every block tagged by origin, and the export gate has
   nothing to block on.
4. Edit one block by hand and press Pin. Generate again: that section does not change.
5. Edit a different block, press Generate, and read the diff. Reject the section you edited
   and accept the rest.
6. Download the bundle, or the zip, or copy it. Open the files.

## What is not built

Named rather than quietly missing:

- The WebLLM runtime itself. `model/inference.worker.ts` exists, compiles, and resolves the
  library at run time; without the package installed it answers with a sentence instead of a
  stack trace. Installing `@mlc-ai/web-llm` is the whole change.
- The template path writes 15 items where `tasks.md` asks for 40 to 90.
- Nothing calls `promoteQuestion` from the UI yet: the interview accepts a promoted question
  and its answer, and the chip that would promote one is parsed, but the button is not
  wired.

Three checks need a person and are recorded as such in `tasks.md`: the readability rating
sheet, the human half of the gate eval, and the shaping eval with a real model.

## Checks

- 610 specs pass, plus `typecheck`, `lint`, `lint:specs`, the layering scan, the secret scan
  and three evals.
- No backend, no API key, no GitHub API: enforced by `scripts/scan-secrets.mjs`, not by this
  paragraph.
- `core/` and `templates/` import no framework, no database and no model library: enforced by
  `scripts/scan-imports.mjs`, because the evals compile those two directories with plain
  `tsc` and run them under node.
- Initial bundle 411.74 kB raw, 116.48 kB transfer, with the zip library in a lazy chunk.

## Project structure

```
src/app/
  core/          Pure functions: no Angular, no IndexedDB, no WebLLM
  templates/     The template path, and the fixtures the evals use
  model/         The optional model path, behind one narrow interface
  state/         Signal stores: wizard, documents, snapshots, draft, model
  persistence/   IndexedDB, behind one file
  ui/            The interview, the output, the gate, the diff, the versions
scripts/         The layering scan, the secret scan, the gate
evals/           Readability, gate, import, bundle
```

See [design.md](./design.md) for the architecture and the trade-offs, and
[tasks.md](./tasks.md) for the phase list with its evidence.

## License

MIT. See [LICENSE](./LICENSE).
