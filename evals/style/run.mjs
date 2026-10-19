#!/usr/bin/env node
/**
 * Style lint against the specs committed in this repository.
 *
 * The browser spec can only lint text it can build in memory, so the guarantee
 * "the three specs in this repo are clean" needs something that reads the real
 * files. That is this script: same word list, same inflection rule, real files.
 *
 * The list is read from `src/app/core/banned-words.json` rather than copied, so
 * the app and this script cannot drift apart.
 *
 * Usage: node evals/style/run.mjs [--quiet]
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const quiet = process.argv.includes('--quiet');

const rules = JSON.parse(readFileSync(join(root, 'src/app/core/banned-words.json'), 'utf8'));
const targets = ['proposal.md', 'design.md', 'tasks.md'];

function patternFor(word) {
  const stem = word.endsWith('e') ? word.slice(0, -1) : word;
  return new RegExp(`\\b${stem}(e|es|ed|ing|s|d)?\\b`, 'gi');
}

function excerptAt(text, index) {
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + 32);
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

function lintLine(line) {
  const hits = [];
  const dashAt = line.indexOf(rules.emDash);

  if (dashAt >= 0) {
    hits.push({ kind: 'em-dash', word: 'em dash', at: dashAt });
  }

  for (const word of rules.words) {
    const pattern = patternFor(word);
    const match = pattern.exec(line);

    if (match) {
      hits.push({ kind: 'banned-word', word, at: match.index });
    }
  }

  return hits;
}

let total = 0;

for (const file of targets) {
  const text = readFileSync(join(root, file), 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, index) => {
    for (const hit of lintLine(line)) {
      total += 1;
      console.log(`${file}:${index + 1}  ${hit.kind}  "${hit.word}"  ${excerptAt(line, hit.at)}`);
    }
  });
}

if (total === 0) {
  if (!quiet) {
    console.log(
      `style: 0 findings in ${targets.length} committed specs (${rules.words.length} words, em dash)`,
    );
  }
  process.exit(0);
}

console.error(`style: ${total} findings in the committed specs`);
process.exit(1);
