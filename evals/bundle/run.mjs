#!/usr/bin/env node
/**
 * Bundle eval: the zip library is not shipped to people who never ask for a zip.
 *
 * `fflate` is behind `await import('fflate')` in `core/export.ts`. That is a claim
 * about the built output, not about the source, so this checks the built output: the
 * initial bundles must not contain the library and some lazy chunk must.
 *
 * It reads `dist/` and fails when there is no build, rather than building on its own,
 * because a hidden build inside an eval is a build nobody notices failing. Run
 * `npm run build` first; `npm run eval:bundle` does exactly that.
 *
 * Exit codes: 0 when the library is only in a lazy chunk, 1 otherwise.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DIST = path.join(ROOT, 'dist', 'spec-forge');

/** Strings only the zip library would put in a bundle. */
const MARKS = ['fflate', 'zipSync', 'unzipSync', 'strToU8', 'strFromU8'];

/** The files the first paint has to download. Angular names them plainly. */
const INITIAL = /^(main|polyfills|styles|runtime|common)\..*\.js$/;

function jsFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      jsFiles(full, found);
    } else if (entry.name.endsWith('.js')) {
      found.push(full);
    }
  }

  return found;
}

function main() {
  let files;

  try {
    files = jsFiles(DIST);
  } catch {
    console.error(`bundle eval: no build at ${DIST}. Run npm run build first.`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`bundle eval: no JavaScript in ${DIST}. Run npm run build first.`);
    process.exit(1);
  }

  const initial = files.filter((file) => INITIAL.test(path.basename(file)));
  const lazy = files.filter((file) => !INITIAL.test(path.basename(file)));

  if (initial.length === 0) {
    console.error('bundle eval: no initial bundle found, so this check would pass for the wrong reason');
    process.exit(1);
  }

  const offenders = [];

  for (const file of initial) {
    const text = readFileSync(file, 'utf8');

    for (const mark of MARKS) {
      if (text.includes(mark)) {
        offenders.push(`${path.basename(file)} contains "${mark}"`);
      }
    }
  }

  const carriers = lazy
    .filter((file) => MARKS.some((mark) => readFileSync(file, 'utf8').includes(mark)))
    .map((file) => path.basename(file));

  const initialKb = (initial.reduce((total, file) => total + readFileSync(file).length, 0) / 1024).toFixed(2);

  console.log(`bundle eval: ${initial.length} initial files, ${initialKb} kB raw`);
  console.log(`bundle eval: ${carriers.length} lazy chunk(s) carry the zip library`);

  if (offenders.length > 0) {
    console.error('\nbundle eval: FAILED, the zip library reached the initial bundle');
    for (const offender of offenders) {
      console.error(`  ${offender}`);
    }
    process.exit(1);
  }

  if (carriers.length === 0) {
    console.error(
      '\nbundle eval: FAILED, no lazy chunk carries the zip library, so the import is not dynamic any more',
    );
    process.exit(1);
  }

  console.log('bundle eval: the zip library is lazy only');
}

main();
