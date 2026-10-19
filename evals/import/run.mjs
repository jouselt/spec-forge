#!/usr/bin/env node
/**
 * Import eval: the motivating failure, reproduced against a real spec.
 *
 * The failure Phase 7 exists to prevent: a person imports the spec they already
 * wrote, runs the generator again, and their sentences come back rewritten. This
 * script does exactly that against a real file and then checks, line by line, that
 * nothing the person wrote was lost.
 *
 * The file is `evals/import/fixtures/portfolio-01-proposal.md`, a verbatim copy of
 * the proposal for the first portfolio project. It is copied rather than read from
 * its home so this eval runs anywhere, and the copy is checked against the original
 * when the original is present, so drift is caught instead of trusted.
 *
 * Exit codes: 0 when every imported line survives, 1 when one does not.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BUILD = path.join(HERE, '.build');
const OUT = path.join(HERE, 'out');
const FIXTURE = path.join(HERE, 'fixtures', 'portfolio-01-proposal.md');

/** Where the fixture came from. Checked for drift when it exists. */
const ORIGINAL = '/home/shared/media/dev/portfolio-projects/01-ai-digital-twin-portfolio/proposal.md';

/** The pure modules the import, the merge and the assembly need. */
const SOURCES = [
  'src/app/core/question-graph.ts',
  'src/app/core/steps.ts',
  'src/app/core/triggers.ts',
  'src/app/core/mapping.ts',
  'src/app/core/provenance.ts',
  'src/app/core/import-spec.ts',
  'src/app/core/merge.ts',
  'src/app/templates/frame.ts',
  'src/app/templates/proposal.tpl.ts',
  'src/app/templates/design.tpl.ts',
  'src/app/templates/tasks.tpl.ts',
  'src/app/templates/assembly.ts',
  'src/app/templates/fixtures/answer-sets.ts',
];

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
    importer: await import(project('core/import-spec.js')),
    mapping: await import(project('core/mapping.js')),
    merge: await import(project('core/merge.js')),
  };
}

/** Every line a person wrote, trimmed, with blank lines and the title dropped. */
function writtenLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('# '));
}

/** The `## Section` headings a person wrote, in file order. */
function writtenHeadings(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim());
}

function hashOf(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function main() {
  if (existsSync(ORIGINAL)) {
    const matches = hashOf(ORIGINAL) === hashOf(FIXTURE);
    console.log(
      `import eval: fixture vs original: ${matches ? 'identical' : 'DRIFTED, the fixture is stale'}`,
    );

    if (!matches) {
      console.error(`  original: ${ORIGINAL}`);
      console.error('  re-copy it into evals/import/fixtures/ before trusting this run');
      process.exit(1);
    }
  }

  compile();
  const lib = await load();

  const source = readFileSync(FIXTURE, 'utf8');
  const imported = lib.importer.importSpec(source, 'proposal');
  const generated = lib.assembly.assemble(lib.fixtures.completeAnswers());
  const before = [imported.doc, ...generated.filter((doc) => doc.file !== 'proposal')];
  const after = lib.merge.mergeGeneration(before, generated);

  const beforeText = lib.assembly.renderMarkdown(before[0]);
  const afterText = lib.assembly.renderMarkdown(after[0]);

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'imported.md'), beforeText);
  writeFileSync(path.join(OUT, 'after-regenerate.md'), afterText);

  const written = writtenLines(source);
  const body = written.filter((line) => !line.startsWith('## '));
  const headings = writtenHeadings(source);
  const survived = body.filter((line) => afterText.includes(line));
  const lost = body.filter((line) => !afterText.includes(line));

  // A heading has to survive under the app's own spelling. The mapping table
  // accepts the corpus spelling of one section and the app emits the canonical one,
  // so `## Target Recruiter Signal` comes back as `## Target Signal`. That is a
  // documented normalisation and not a lost sentence, so the check names it instead
  // of skipping headings: every heading must still land on a section, under the
  // spelling the app uses.
  const headingMisses = headings.filter((heading) => {
    const expected = lib.mapping.canonicalSectionName(heading) ?? heading;

    return !afterText.includes(`## ${expected}`);
  });
  const normalisedHeadings = headings.filter(
    (heading) => (lib.mapping.canonicalSectionName(heading) ?? heading) !== heading,
  );

  console.log(
    `import eval: ${imported.sections.length} sections imported, ${imported.unmapped.length} not in the mapping table`,
  );
  if (imported.unmapped.length > 0) {
    console.log(`  kept verbatim: ${imported.unmapped.join(' | ')}`);
  }
  if (normalisedHeadings.length > 0) {
    console.log(
      `  heading spelling normalised by the mapping table: ${normalisedHeadings.join(' | ')}`,
    );
  }

  const lockedSections = [...lib.merge.lockedSections(after[0])];
  console.log(`import eval: ${lockedSections.length} sections locked after the merge`);
  console.log(`import eval: ${body.length} written body lines, ${survived.length} survived`);
  console.log(`import eval: ${headings.length} written headings, ${headings.length - headingMisses.length} present`);

  const filled = after[0].blocks
    .filter((block) => !lockedSections.includes(block.section))
    .map((block) => block.section);
  const uniqueFilled = [...new Set(filled)];
  console.log(
    `import eval: ${uniqueFilled.length} sections filled by the generator: ${uniqueFilled.join(', ')}`,
  );

  if (lost.length > 0 || headingMisses.length > 0) {
    console.error('\nimport eval: FAILED, something a person wrote did not survive');
    for (const line of lost.slice(0, 10)) {
      console.error(`  lost: ${line.slice(0, 100)}`);
    }
    for (const heading of headingMisses) {
      console.error(`  heading missing: ${heading}`);
    }
    process.exit(1);
  }

  console.log('\nimport eval: nothing a person wrote was reverted');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
