#!/usr/bin/env node
/**
 * The gate: what has to be true before a commit, in under two seconds.
 *
 * Two kinds of check, on purpose.
 *
 * Repo-wide and cheap: the layering scan and the style lint over the three specs. Both
 * are milliseconds, and both catch a class of mistake that no single file review would.
 *
 * Per-file and expensive: ESLint. It parses the whole tree and costs 2.6 seconds, which
 * is more than the gate is allowed to take. So during a commit it lints the files that
 * are actually staged, which is the usual trade (lint what you are about to ship, lint
 * everything in CI). Run it by hand with `--all` to lint the whole tree, and CI runs
 * `npm run lint` over everything regardless.
 *
 * Exit codes: 0 clean, 1 anything failed.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LINTABLE = /\.(ts|mjs|js)$/;

const started = Date.now();

function run(label, command, args) {
  const from = Date.now();

  try {
    execFileSync(command, args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    console.log(`  ${label}: clean (${Date.now() - from} ms)`);
    return true;
  } catch (error) {
    console.log(`  ${label}: FAILED (${Date.now() - from} ms)`);
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();

    if (output) {
      console.log(output.split('\n').map((line) => `    ${line}`).join('\n'));
    }

    return false;
  }
}

function stagedFiles() {
  try {
    return execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && LINTABLE.test(line));
  } catch {
    return [];
  }
}

function main() {
  const all = process.argv.includes('--all');
  const files = all ? [] : stagedFiles();
  const target = all || files.length === 0 ? ['src', 'evals', 'scripts'] : files;
  const mode = all
    ? 'every file'
    : files.length === 0
      ? 'the whole tree, because nothing is staged'
      : `${files.length} staged file(s)`;

  console.log(`gate (${path.basename(process.cwd())})`);

  const results = [
    run('layering', 'node', ['scripts/scan-imports.mjs']),
    run('secrets', 'node', ['scripts/scan-secrets.mjs']),
    run('spec style', 'node', ['evals/style/run.mjs']),
    run(`eslint on ${mode}`, 'npx', ['eslint', '--max-warnings=0', ...target]),
  ];

  const elapsed = Date.now() - started;
  const failed = results.filter((ok) => !ok).length;

  console.log(
    failed === 0
      ? `\ngate: clean in ${elapsed} ms`
      : `\ngate: ${failed} check(s) failed in ${elapsed} ms`,
  );

  process.exit(failed === 0 ? 0 : 1);
}

main();
