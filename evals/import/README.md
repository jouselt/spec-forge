# Import eval

Reproduces the failure Phase 7 exists to prevent, against a real spec: a person
imports the `proposal.md` they already wrote, runs the generator again, and their
sentences come back rewritten.

`npm run eval:import` imports a real 71-line proposal, regenerates, merges, and then
checks line by line that nothing the person wrote was lost. It exits 1 if a single
body line or heading goes missing.

```
import eval: fixture vs original: identical
import eval: 9 sections imported, 1 not in the mapping table
  kept verbatim: Why This Differentiates a Senior Angular/NestJS Engineer
  heading spelling normalised by the mapping table: Target Recruiter Signal
import eval: 9 sections locked after the merge
import eval: 40 written body lines, 40 survived
import eval: 9 written headings, 9 present
import eval: 2 sections filled by the generator: Core Features, Risks

import eval: nothing a person wrote was reverted
```

## What the two checks mean

Body lines must survive byte for byte, because a sentence is the thing a person
owns. Headings are checked against the app's own spelling instead: the mapping table
accepts the corpus spelling of one section and the app emits the canonical one, so
`## Target Recruiter Signal` comes back as `## Target Signal`. That is a documented
normalisation, and the check names it rather than skipping headings, so a genuinely
lost heading still fails.

The run also reports which sections the generator filled: those are the ones nobody
locked, which is the point of an import. The imported text stays and the gaps around
it get filled.

## The fixture

`fixtures/portfolio-01-proposal.md` is a verbatim copy of
`portfolio-projects/01-ai-digital-twin-portfolio/proposal.md`. It is a copy so the
eval runs anywhere. When the original is present the script compares the two hashes
and fails on drift, so a stale copy is caught instead of trusted.

`out/` and `.build/` are regenerated and ignored; `out/imported.md` and
`out/after-regenerate.md` are written side by side for a person to read.
