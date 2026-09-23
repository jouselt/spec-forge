# Readability eval ([E])

The template path is the default, so it has to read like a person wrote it. That
is a rating only a person can give, so this eval is half harness and half
handoff.

The five answer sets in `src/app/templates/fixtures/answer-sets.ts` are grounded
in five of the eleven sibling specs in `portfolio-projects`: the local retrieval
API (01), the encrypted vault (04), the review service (03), the collaborative
board (08), and the transcript compiler (11). The prose is cut to answer length;
`basedOn` names the spec each set came from.

## Run the automated half

```bash
npm run eval:readability
```

It compiles the pure template modules with the project's own `tsc` (no new
dependency), assembles all three files for each answer set, and writes:

- `out/<fixture>/proposal.md`, `design.md`, `tasks.md`
- `ratings.csv`, with one row per proposal and an empty score column

It prints a block count, a sourced count, a gap count and an inferred count per
file. On a complete answer set the gap count and the inferred count must both be
zero: the template path never infers, and a complete interview leaves no hole.

## The human half

Read each `out/<fixture>/proposal.md` and rate it 1 to 5 on **"reads like a
person wrote it"**. Write the number in the `score_1_to_5` column of
`ratings.csv`. Notes go in the last column.

Then:

```bash
npm run eval:readability:score
```

With a blank score present, the command prints `PENDING HUMAN RATING` and exits
non-zero. That is deliberate: the eval is not done until a person has read the
files. Nothing in this repository invents a score.

The threshold is a mean of **3.0 or higher** over the five proposals. Below that
the template path does not ship as the default and the frames get rewritten
before the model path is considered.

## Status

`PENDING A HUMAN RATING`. The harness runs, the fixtures are assembled, and the
rating sheet is written. `tasks.md` Phase 4 keeps the `[E]` box unticked until a
person fills the sheet in.
