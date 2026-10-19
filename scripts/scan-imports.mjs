#!/usr/bin/env node
/**
 * Layering scan: core/ and templates/ stay pure.
 *
 * Why this exists as a build check and not as a convention: `evals/readability`,
 * `evals/gate` and `evals/import` compile those two directories with plain `tsc` and run
 * them under node. The moment one of them imports a decorator or a signal, the evals stop
 * being runnable and nobody notices until the numbers go quiet. The import is added by
 * someone with a good reason in front of them, and the reason is fine; the cost lands
 * three directories away.
 *
 * One implementation, two ways to exercise it: the real scan, and `--selftest`, which
 * asserts the matcher against cases that must and must not be flagged.
 *
 * Exit codes: 0 clean, 1 violations or a failed selftest.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const RULES = JSON.parse(readFileSync(path.join(HERE, 'layering.json'), 'utf8'));

/** Both forms: a static import and a dynamic one. */
const IMPORT_PATTERNS = [
  /\bimport\s+(?:type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bexport\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
];

/** Every module specifier a source file names. */
export function extractImports(source) {
  const found = new Set();

  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      found.add(match[1]);
    }
  }

  return [...found];
}

/**
 * The package a specifier belongs to: `@angular/core/testing` is `@angular/core`,
 * `idb/whatever` is `idb`, and a relative path is itself.
 */
export function rootSpecifier(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return specifier;
  }

  const parts = specifier.split('/');

  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Is this import forbidden in a pure directory? */
export function isForbidden(specifier) {
  return RULES.forbiddenInPure.includes(rootSpecifier(specifier));
}

/** Every `.ts` file under one of the pure directories, recursively. */
function pureFiles(dir, found = []) {
  let entries;

  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      pureFiles(full, found);
    } else if (entry.name.endsWith('.ts')) {
      found.push(full);
    }
  }

  return found;
}

function relative(file) {
  return path.relative(ROOT, file);
}

function scan() {
  const files = RULES.pureDirs.flatMap((dir) => pureFiles(path.join(ROOT, dir)));
  const violations = [];

  for (const file of files) {
    for (const specifier of extractImports(readFileSync(file, 'utf8'))) {
      if (isForbidden(specifier)) {
        violations.push({ file: relative(file), specifier, package: rootSpecifier(specifier) });
      }
    }
  }

  return { files, violations };
}

function selftest() {
  const cases = [
    // [specifier, forbidden?]
    ['@angular/core', true],
    ['@angular/core/testing', true],
    ['@angular/common/http', true],
    ['idb', true],
    ['idb/with-async-ittr', true],
    ['@mlc-ai/web-llm', true],
    ['./sibling', false],
    ['./question-graph', false],
    ['fflate', false],
    ['@angular/animations', false],
    ['../templates/assembly', false],
  ];

  const wrong = cases.filter(([specifier, expected]) => isForbidden(specifier) !== expected);

  if (wrong.length > 0) {
    for (const [specifier, expected] of wrong) {
      console.error(
        `  ${specifier}: expected ${expected ? 'forbidden' : 'allowed'}, got ${!expected ? 'forbidden' : 'allowed'}`,
      );
    }

    return false;
  }

  // The extractor has to see all three forms, because a dynamic import of the model
  // library from core/ is exactly the import this check exists to stop.
  const source = [
    "import { a } from '@angular/core';",
    "import type { B } from 'idb';",
    "const c = await import('@mlc-ai/web-llm');",
    "export { d } from './local';",
  ].join('\n');
  const extracted = extractImports(source);

  for (const expected of ['@angular/core', 'idb', '@mlc-ai/web-llm', './local']) {
    if (!extracted.includes(expected)) {
      console.error(`  extractor missed ${expected}`);
      return false;
    }
  }

  console.log(`layering selftest: ${cases.length} matcher cases and 4 extractor cases agree`);
  return true;
}

function main() {
  if (process.argv.includes('--selftest')) {
    process.exit(selftest() ? 0 : 1);
  }

  if (!selftest()) {
    process.exit(1);
  }

  const { files, violations } = scan();
  console.log(`layering scan: ${files.length} files under ${RULES.pureDirs.join(' and ')}`);

  if (violations.length > 0) {
    console.error('\nlayering scan: FAILED, a pure module reaches outward');
    for (const violation of violations) {
      console.error(`  ${violation.file}: ${violation.specifier}`);
      const why = RULES.why[violation.package];

      if (why) {
        console.error(`    ${why}`);
      }
    }
    process.exit(1);
  }

  console.log('layering scan: nothing in core/ or templates/ reaches outward');
}

main();
