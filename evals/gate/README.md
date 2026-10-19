# Gate eval

The `[E]` box in `tasks.md` Phase 6, in two halves.

## The automated half

`npm run eval:gate` compiles the pure gate modules with the project's own
TypeScript, builds ten mixed runs, and asserts:

- the gate blocks on 10 of 10, because every fixture carries at least one block a
  model wrote and nobody reviewed;
- every blocked run names an unreviewed inference among its reasons;
- a control run, the same mixed shape with every inference reviewed, exports.

Each fixture differs in what else is wrong: gaps from an interview that never got
past step 3, a required section removed, an inference somebody rejected which left
a gap behind, a confirmed inference next to an unreviewed one, text that fails the
style rules, an acceptance criterion nobody could check, a task list far below the
usual size, and one run with all of it at once. `out/report.json` carries the
verdict of every run.

The three files of every run are written to `out/<fixture>/`, with
`<!-- INFERRED: unreviewed -->` above each block nobody reviewed. Both `out/` and
`.build/` are ignored: they are regenerated.

## The human half

`checklist.csv` is tracked, because it is the sheet a person fills in.

For each of the ten runs, read the three files and answer one question: does any
sentence state a fact the interview never gave? A confirmed inference may stay. An
unreviewed one must not survive in a file that exported.

Fill `no_fabricated_fact` with `yes` or `no`, add a note when the answer is `no`,
then run `npm run eval:gate:confirm`.

Exit codes, all three proven by running them:

- `0`: 10 of 10 blocked and every run clean of fabricated facts.
- `1`: a run that a person judged to contain a fabricated fact. Reported as soon as
  one verdict says `no`, without waiting for the other nine: a defect already found
  is conclusive.
- `2`: the human half is pending. Nothing pretends the eval ran.

These fixtures carry fixture inferences, not model output. The human half becomes
meaningful when Phase 9 puts a real model behind them.
