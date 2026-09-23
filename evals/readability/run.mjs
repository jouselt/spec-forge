#!/usr/bin/env node
/**
 * Readability eval harness (`[E]` in tasks.md).
 *
 * The automated half:
 *   1. compile the pure template modules with the project's own TypeScript;
 *   2. assemble `proposal.md`, `design.md` and `tasks.md` for the five readability
 *      answer sets in `src/app/templates/fixtures/answer-sets.ts`;
 *   3. write the files to `evals/readability/out/<fixture>/`;
 *   4. write `ratings.csv` with a blank score column for a person to fill in.
 *
 * The half a machine cannot do: rating each `proposal.md` 1 to 5 on "reads like a
 * person wrote it". Run `node evals/readability/run.mjs --score` once the scores
 * are in. The mean has to reach 3.0 for the template path to ship as the default.
 * With blank scores it reports PENDING and exits non-zero, so nothing pretends the
 * eval ran.
 *
 * No new dependency: the compile step is the `tsc` already in devDependencies.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BUILD = path.join(HERE, '.build');
const OUT = path.join(HERE, 'out');
const RATINGS = path.join(HERE, 'ratings.csv');

/** The pure modules the assembly path needs. No Angular, no browser API. */
const SOURCES = [
  'src/app/core/question-graph.ts',
  'src/app/core/steps.ts',
  'src/app/core/triggers.ts',
  'src/app/core/mapping.ts',
  'src/app/core/provenance.ts',
  'src/app/templates/frame.ts',
  'src/app/templates/proposal.tpl.ts',
  'src/app/templates/design.tpl.ts',
  'src/app/templates/tasks.tpl.ts',
  'src/app/templates/assembly.ts',
  'src/app/templates/fixtures/answer-sets.ts',
];

const MINIMUM_MEAN = 3.0;

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
      '--skipLibCheck',
      '--strict',
    ],
    { cwd: ROOT, stdio: 'inherit' },
  );
}

async function load() {
  const assembly = await import(pathToFileURL(path.join(BUILD, 'templates', 'assembly.js')).href);
  const fixtures = await import(
    pathToFileURL(path.join(BUILD, 'templates', 'fixtures', 'answer-sets.js')).href
  );

  return { assembly, fixtures };
}

function countGaps(blocks) {
  return blocks.filter((block) => block.origin.kind === 'missing').length;
}

function countByKind(blocks) {
  const counts = { template: 0, missing: 0, model: 0, answer: 0, imported: 0, edited: 0 };

  for (const block of blocks) {
    counts[block.origin.kind] += 1;
  }

  return counts;
}

/** Markdown table rows for one assembled run, so the summary reads. */
function summarise(fixture, docs) {
  const rows = docs.map((doc) => {
    const counts = countByKind(doc.blocks);

    return {
      fixture: fixture.id,
      file: `${doc.file}.md`,
      blocks: doc.blocks.length,
      sourced: counts.template + counts.answer + counts.imported + counts.edited,
      gaps: counts.missing,
      inferred: counts.model,
    };
  });

  return rows;
}

async function assembleAll() {
  const { assembly, fixtures } = await load();

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const rows = [];

  for (const fixture of fixtures.READABILITY_FIXTURES) {
    const docs = assembly.assemble(fixture.answers, { now: 0 });
    const markdown = assembly.assembleMarkdown(fixture.answers, { now: 0 });
    const directory = path.join(OUT, fixture.id);

    mkdirSync(directory, { recursive: true });

    for (const file of ['proposal', 'design', 'tasks']) {
      writeFileSync(path.join(directory, `${file}.md`), markdown[file], 'utf8');
    }

    rows.push(...summarise(fixture, docs));
  }

  return rows;
}

function writeRatings() {
  const header = [
    'fixture',
    'proposal_path',
    'score_1_to_5',
    'reads_like_a_person_notes',
  ].join(',');

  const lines = [];

  for (const entry of existsSync(RATINGS) ? readFileSync(RATINGS, 'utf8').split('\n') : []) {
    if (entry.trim().length > 0 && !entry.startsWith('fixture,')) {
      lines.push(entry);
    }
  }

  if (lines.length === 0) {
    const fixtures = JSON.parse(readFileSync(path.join(HERE, 'fixtures.json'), 'utf8'));

    for (const fixture of fixtures) {
      lines.push([fixture, `evals/readability/out/${fixture}/proposal.md`, '', ''].join(','));
    }
  }

  writeFileSync(RATINGS, `${[header, ...lines].join('\n')}\n`, 'utf8');

  return lines.length;
}

function score() {
  if (!existsSync(RATINGS)) {
    console.error('PENDING HUMAN RATING: ratings.csv does not exist. Run the harness first.');
    process.exitCode = 1;
    return;
  }

  const rows = readFileSync(RATINGS, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0 && !line.startsWith('fixture,'))
    .map((line) => line.split(','));

  const scores = rows
    .map((row) => Number.parseFloat((row[2] ?? '').trim()))
    .filter((value) => Number.isFinite(value));

  if (scores.length !== rows.length) {
    console.error(
      `PENDING HUMAN RATING: ${rows.length - scores.length} of ${rows.length} proposals have no score. ` +
        'A person rates each one 1 to 5 on "reads like a person wrote it".',
    );
    process.exitCode = 1;
    return;
  }

  const mean = scores.reduce((total, value) => total + value, 0) / scores.length;

  console.log(`mean ${mean.toFixed(2)} over ${scores.length} proposals (threshold ${MINIMUM_MEAN.toFixed(2)})`);

  if (mean < MINIMUM_MEAN) {
    console.error('The template path does not ship as the default at this mean.');
    process.exitCode = 1;
  }
}

async function main() {
  if (process.argv.includes('--score')) {
    score();
    return;
  }

  compile();

  const rows = await assembleAll();
  const fixtures = rows
    .filter((row) => row.file === 'proposal.md')
    .map((row) => row.fixture);

  writeFileSync(path.join(HERE, 'fixtures.json'), `${JSON.stringify(fixtures, null, 2)}\n`, 'utf8');

  const width = { fixture: 30, file: 12 };
  const header = [
    'fixture'.padEnd(width.fixture),
    'file'.padEnd(width.file),
    'blocks',
    'sourced',
    'gaps',
    'inferred',
  ].join('  ');

  console.log(header);
  console.log('-'.repeat(header.length));

  for (const row of rows) {
    console.log(
      [
        row.fixture.padEnd(width.fixture),
        row.file.padEnd(width.file),
        String(row.blocks).padStart(6),
        String(row.sourced).padStart(7),
        String(row.gaps).padStart(4),
        String(row.inferred).padStart(8),
      ].join('  '),
    );
  }

  const written = writeRatings();

  console.log('');
  console.log(`Wrote ${written} proposals to evals/readability/out/<fixture>/proposal.md`);
  console.log(`Wrote the rating sheet to ${path.relative(ROOT, RATINGS)}`);
  console.log('');
  console.log('PENDING HUMAN RATING: read the five proposal.md files and score each 1 to 5.');
  console.log('Then run: node evals/readability/run.mjs --score');
  console.log(`The mean must reach ${MINIMUM_MEAN.toFixed(2)} for the template path to ship as the default.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
