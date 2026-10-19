#!/usr/bin/env node
/**
 * Export gate eval harness (Phase 6's `[E]` box).
 *
 * The automated half:
 *   1. compile the pure gate modules with the project's own TypeScript;
 *   2. build ten mixed runs, each one template content plus at least one block a
 *      model wrote and nobody reviewed, and each one carrying a different mix of
 *      the other conditions the gate knows about;
 *   3. assert the gate blocks on 10 of 10, that every block names a reason, and
 *      that a control run with the same inference confirmed exports;
 *   4. write the three files of every run to `evals/gate/out/<fixture>/` plus
 *      `checklist.csv` with a blank verdict column.
 *
 * The half a machine cannot do: reading the ten runs and confirming that no
 * fabricated fact survives in any exported file. Run
 * `node evals/gate/run.mjs --confirm` once the verdicts are in. With blank
 * verdicts it reports PENDING and exits non-zero, so nothing pretends the eval
 * ran. That half waits on Phase 9, which is the first phase that can put a real
 * model behind these fixtures; today the inferred blocks are fixtures too.
 *
 * No new dependency: the compile step is the `tsc` already in devDependencies.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BUILD = path.join(HERE, '.build');
const OUT = path.join(HERE, 'out');
const CHECKLIST = path.join(HERE, 'checklist.csv');

/** The pure modules the gate needs. No Angular, no browser API. */
const SOURCES = [
  'src/app/core/question-graph.ts',
  'src/app/core/steps.ts',
  'src/app/core/triggers.ts',
  'src/app/core/mapping.ts',
  'src/app/core/provenance.ts',
  'src/app/core/validator.ts',
  'src/app/core/style-lint.ts',
  'src/app/core/gate.ts',
  'src/app/templates/frame.ts',
  'src/app/templates/proposal.tpl.ts',
  'src/app/templates/design.tpl.ts',
  'src/app/templates/tasks.tpl.ts',
  'src/app/templates/assembly.ts',
  'src/app/templates/fixtures/answer-sets.ts',
];

const EXPECTED_BLOCKED = 10;

function compile() {
  rmSync(BUILD, { recursive: true, force: true });
  execFileSync(
    'npx',
    [
      'tsc',
      ...SOURCES,
      '--outDir',
      BUILD,
      '--module',
      'commonjs',
      '--target',
      'es2022',
      '--moduleResolution',
      'node',
      '--resolveJsonModule',
      '--esModuleInterop',
      '--skipLibCheck',
      '--strict',
    ],
    { cwd: ROOT, stdio: 'inherit' },
  );
}

async function load() {
  const project = (name) => pathToFileURL(path.join(BUILD, name)).href;

  return {
    assembly: await import(project('templates/assembly.js')),
    fixtures: await import(project('templates/fixtures/answer-sets.js')),
    gate: await import(project('core/gate.js')),
    validator: await import(project('core/validator.js')),
    graph: await import(project('core/question-graph.js')),
  };
}

/** A block that a model wrote and nobody has reviewed. */
function inferredBlock(file, section, text, id, review = 'unreviewed') {
  return {
    id,
    file,
    section,
    ord: 90,
    text,
    origin: { kind: 'model', modelId: 'fixture-shape', basedOn: ['q.idea'], temperature: 0.2 },
    review,
    locked: false,
  };
}

/** The block a person would write when they reject an inference. */
function gapBlock(file, section, id, placeholder = '{{MISSING: still unanswered}}') {
  return {
    id,
    file,
    section,
    ord: 91,
    text: placeholder,
    origin: { kind: 'missing', placeholder },
    review: 'unreviewed',
    locked: false,
  };
}

/**
 * Insert blocks after the last block of their own section.
 *
 * Appending would move the last section of a file: `tasks.md` has to end with a
 * Definition of Done, so a block appended to the end silently turns every fixture
 * into a structural failure and blurs what the fixture is actually testing.
 */
function addBlocks(docs, file, blocks) {
  return docs.map((doc) => {
    if (doc.file !== file) {
      return doc;
    }

    const next = [...doc.blocks];

    for (const block of blocks) {
      let at = -1;

      next.forEach((candidate, index) => {
        if (candidate.section === block.section) {
          at = index;
        }
      });

      if (at === -1) {
        next.push(block);
      } else {
        next.splice(at + 1, 0, block);
      }
    }

    return { ...doc, blocks: next };
  });
}

function dropSection(docs, file, section) {
  return docs.map((doc) =>
    doc.file === file
      ? { ...doc, blocks: doc.blocks.filter((block) => block.section !== section) }
      : doc,
  );
}

/** Only the answers a first-run interview would have at step 3. */
function partialAnswers(fixtures) {
  const all = fixtures.completeAnswers();
  return all.slice(0, 3);
}

/**
 * Ten mixed runs. Every one carries at least one unreviewed inference, which is
 * the rule the whole gate exists for, and each one differs in what else is wrong:
 * gaps, a missing section, a weak criterion, a style violation, or nothing at all.
 */
function buildRuns(lib) {
  const { assembly, fixtures } = lib;
  const full = () => assembly.assemble(fixtures.completeAnswers());
  const partial = () => assembly.assemble(partialAnswers(fixtures));

  return [
    {
      name: '01-inferred-proposal',
      why: 'one unreviewed inference in proposal.md, nothing else wrong',
      docs: addBlocks(full(), 'proposal', [
        inferredBlock('proposal', 'Problem', 'A shaped problem statement.', 'proposal:problem:shape'),
      ]),
    },
    {
      name: '02-inferred-all-files',
      why: 'one unreviewed inference in each of the three files',
      docs: addBlocks(
        addBlocks(
          addBlocks(full(), 'proposal', [
            inferredBlock('proposal', 'Risks', 'A shaped risk.', 'proposal:risks:shape'),
          ]),
          'design',
          [inferredBlock('design', 'Architecture', 'A shaped architecture.', 'design:arch:shape')],
        ),
        'tasks',
        [
          inferredBlock(
            'tasks',
            'Phase 1: Contracts and scaffold',
            '- [ ] `[G]` A shaped item 1 time',
            'tasks:phase1:shape',
          ),
        ],
      ),
    },
    {
      name: '03-inferred-plus-gaps',
      why: 'one unreviewed inference and a run that never got past step 3',
      docs: addBlocks(partial(), 'proposal', [
        inferredBlock('proposal', 'Goal', 'A shaped goal.', 'proposal:goal:shape'),
      ]),
    },
    {
      name: '04-inferred-plus-missing-section',
      why: 'one unreviewed inference and a required section removed',
      docs: addBlocks(dropSection(full(), 'proposal', 'Timeline'), 'design', [
        inferredBlock('design', 'Persistence', 'A shaped persistence note.', 'design:persistence:shape'),
      ]),
    },
    {
      name: '05-inferred-plus-rejected-gap',
      why: 'one unreviewed inference and an inference somebody rejected, which left a gap',
      docs: addBlocks(
        addBlocks(full(), 'proposal', [
          inferredBlock('proposal', 'Goal', 'A shaped goal.', 'proposal:goal:shape'),
          gapBlock('proposal', 'Goal', 'proposal:goal:rejected'),
        ]),
        'design',
        [inferredBlock('design', 'Data model', 'A shaped table.', 'design:data:shape')],
      ),
    },
    {
      name: '06-inferred-plus-confirmed',
      why: 'one unreviewed inference next to one a person confirmed',
      docs: addBlocks(
        addBlocks(full(), 'proposal', [
          inferredBlock('proposal', 'Goal', 'A shaped goal.', 'proposal:goal:shape'),
        ]),
        'design',
        [
          inferredBlock(
            'design',
            'Architecture',
            'A shaped architecture a person confirmed.',
            'design:arch:confirmed',
            'confirmed',
          ),
        ],
      ),
    },
    {
      name: '07-inferred-plus-style',
      why: 'one unreviewed inference and text that fails the style rules',
      docs: addBlocks(full(), 'proposal', [
        inferredBlock('proposal', 'Problem', 'A robust and comprehensive statement.', 'proposal:problem:shape'),
      ]),
    },
    {
      name: '08-inferred-plus-weak-criterion',
      why: 'one unreviewed inference and an acceptance criterion nobody could check',
      docs: addBlocks(full(), 'proposal', [
        inferredBlock('proposal', 'Goal', 'A shaped goal.', 'proposal:goal:shape'),
        {
          id: 'proposal:acceptance:weak',
          file: 'proposal',
          section: 'Acceptance Criteria',
          ord: 92,
          text: '- It should work well',
          origin: { kind: 'template', frame: 'item', inputs: ['q.proof'] },
          review: 'unreviewed',
          locked: false,
        },
      ]),
    },
    {
      name: '09-inferred-thin-tasks',
      why: 'one unreviewed inference and a task list far below the usual size',
      docs: addBlocks(full(), 'tasks', [
        inferredBlock(
          'tasks',
          'Phase 2: Core implementation',
          '- [ ] `[G]` A shaped item 2 seconds',
          'tasks:phase2:shape',
        ),
      ]),
    },
    {
      name: '10-inferred-everything',
      why: 'one unreviewed inference plus a gap, a missing section and a style violation',
      docs: addBlocks(
        addBlocks(dropSection(full(), 'design', 'Open Questions'), 'proposal', [
          inferredBlock('proposal', 'Problem', 'A pivotal statement.', 'proposal:problem:shape'),
          gapBlock('proposal', 'Tech Stack', 'proposal:stack:gap'),
        ]),
        'design',
        [inferredBlock('design', 'Provider seams', 'A shaped seam.', 'design:seam:shape')],
      ),
    },
  ];
}

/** The control: the same shape of run with nothing left unreviewed. */
function controlRun(lib) {
  const { assembly, fixtures } = lib;

  return {
    name: '00-control-all-reviewed',
    why: 'the same mixed shape with every inference reviewed',
    docs: addBlocks(assembly.assemble(fixtures.completeAnswers()), 'proposal', [
      inferredBlock('proposal', 'Goal', 'A shaped goal somebody confirmed.', 'proposal:goal:confirmed', 'confirmed'),
    ]),
  };
}

function writeFiles(run, lib) {
  const dir = path.join(OUT, run.name);
  mkdirSync(dir, { recursive: true });

  const files = {};

  for (const doc of run.docs) {
    const text = lib.assembly.renderMarkdown(doc, { markUnreviewedInferred: true });
    files[doc.file] = text;
    writeFileSync(path.join(dir, `${doc.file}.md`), text);
  }

  return files;
}

function readChecklist() {
  if (!readFileSync) {
    return [];
  }

  try {
    const raw = readFileSync(CHECKLIST, 'utf8').trim();

    if (!raw) {
      return [];
    }

    const [header, ...rows] = raw.split('\n');

    return rows
      .filter((row) => row.trim())
      .map((row) => {
        const cells = row.split(',');
        return {
          fixture: cells[0],
          noFabricatedFact: cells[1],
          judgement: cells[2],
          notes: cells.slice(3).join(','),
        };
      });
  } catch {
    return [];
  }
}

async function main() {
  const confirm = process.argv.includes('--confirm');

  compile();
  const lib = await load();

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const runs = buildRuns(lib);
  const control = controlRun(lib);
  const results = [];

  for (const run of runs) {
    const result = lib.gate.evaluate(run.docs);
    const files = writeFiles(run, lib);

    results.push({
      name: run.name,
      why: run.why,
      blocked: !result.canExport,
      blocking: result.blocking.length,
      kinds: result.blocking.reduce((counts, blocker) => {
        counts[blocker.kind] = (counts[blocker.kind] ?? 0) + 1;
        return counts;
      }, {}),
      verdict: lib.gate.verdictLine(result),
      warnings: result.warnings.length,
      style: result.styleFindings.length,
      files: Object.keys(files),
    });
  }

  const controlResult = lib.gate.evaluate(control.docs);
  writeFiles(control, lib);

  writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify({ results, control: {
    name: control.name,
    blocked: !controlResult.canExport,
    blocking: controlResult.blocking.length,
    verdict: lib.gate.verdictLine(controlResult),
  } }, null, 2)}\n`);

  const blockedCount = results.filter((row) => row.blocked).length;
  const namesInferred = results.every((row) => (row.kinds['unreviewed-inferred'] ?? 0) > 0);

  console.log(`gate eval: ${results.length} mixed runs, ${blockedCount} blocked`);
  for (const row of results) {
    const kinds = Object.entries(row.kinds)
      .map(([kind, count]) => `${kind}=${count}`)
      .join(' ');
    console.log(`  ${row.name}  blocked=${row.blocked}  ${kinds}  warnings=${row.warnings}  style=${row.style}`);
  }

  console.log(
    `  ${control.name}  blocked=${!controlResult.canExport}  (control: must be false)`,
  );

  const automated = [];

  if (blockedCount !== EXPECTED_BLOCKED) {
    automated.push(`expected ${EXPECTED_BLOCKED} of ${results.length} runs blocked, got ${blockedCount}`);
  }

  if (!namesInferred) {
    automated.push('a blocked run did not name an unreviewed inference');
  }

  if (controlResult.canExport !== true) {
    automated.push('the control run with every inference reviewed did not export');
  }

  if (automated.length > 0) {
    console.error('\ngate eval: FAILED');
    for (const problem of automated) {
      console.error(`  ${problem}`);
    }
    process.exit(1);
  }

  console.log('\ngate eval: the automated half passes on 10 of 10');

  if (!confirm) {
    const header = 'fixture,no_fabricated_fact,judgement,notes';
    const rows = results.map((row) => `${row.name},,,`).join('\n');
    writeFileSync(CHECKLIST, `${header}\n${rows}\n`);

    console.error(
      [
        '',
        'gate eval: PENDING the human half',
        `  ${results.length} runs written to evals/gate/out/<fixture>/`,
        '  For each run, read the three files and answer: does any sentence state a',
        '  fact the interview never gave? A confirmed inference is allowed to stay;',
        '  an unreviewed one must not survive in a file that exported.',
        `  Fill evals/gate/checklist.csv (no_fabricated_fact=yes|no), then run:`,
        '    node evals/gate/run.mjs --confirm',
      ].join('\n'),
    );
    process.exit(2);
  }

  const checklist = readChecklist();
  const answered = checklist.filter(
    (row) => row.noFabricatedFact === 'yes' || row.noFabricatedFact === 'no',
  );

  // A failing verdict is conclusive on its own. Waiting for the other nine runs to
  // be read before reporting the one that already shows a fabricated fact would be
  // ceremony in front of a defect.
  const failures = answered.filter((row) => row.noFabricatedFact !== 'yes');

  if (failures.length > 0) {
    console.error('\ngate eval: FAILED the human half');
    for (const row of failures) {
      console.error(`  ${row.fixture}: ${row.notes || 'a fabricated fact survived'}`);
    }
    process.exit(1);
  }

  if (answered.length !== results.length) {
    console.error(
      `\ngate eval: PENDING, ${answered.length} of ${results.length} runs have a verdict`,
    );
    process.exit(2);
  }

  console.log(
    `\ngate eval: 10 of 10 blocked, and ${answered.length} of ${answered.length} runs clean of fabricated facts`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
