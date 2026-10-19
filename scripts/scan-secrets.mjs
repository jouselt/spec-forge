#!/usr/bin/env node
/**
 * The no-secrets, no-backend scan.
 *
 * This project's whole claim is that it has no server, no key and no account. That claim is
 * cheap to make and easy to break with one helpful-looking `fetch` to an API, so it is a
 * build check rather than a paragraph in a README.
 *
 * Three things are forbidden anywhere in `src/`:
 *
 * - anything that looks like a credential;
 * - a `fetch` to a host that is not on the model CDN allowlist;
 * - any reference to the GitHub API, which this app has no business with.
 *
 * The allowlist exists for one reason: a build that installs WebLLM downloads weights from
 * Hugging Face and nothing else.
 *
 * Exit codes: 0 clean, 1 a violation.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'src');

/** Hosts a request may go to. Everything else is a violation. */
const CDN_ALLOWLIST = [
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.hf.co',
  'raw.githubusercontent.com',
  'cdn.jsdelivr.net',
];

const PATTERNS = [
  { name: 'an API key in source', pattern: /\b(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"][^'"]{8,}/i },
  { name: 'an OpenAI-shaped key', pattern: /\bsk-[A-Za-z0-9]{16,}/ },
  { name: 'a hard-coded bearer token', pattern: /\bBearer\s+[A-Za-z0-9._-]{16,}/ },
  { name: 'the GitHub API', pattern: /\bapi\.github\.com\b/ },
  { name: 'a GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
];

function sources(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      sources(full, found);
    } else if (/\.(ts|mjs|js|json|html)$/.test(entry.name)) {
      found.push(full);
    }
  }

  return found;
}

/** Every URL host named in a `fetch(` call. */
function fetchHosts(source) {
  const hosts = [];

  for (const match of source.matchAll(/fetch\(\s*[`'"]([^`'"]+)[`'"]/g)) {
    try {
      hosts.push(new URL(match[1]).host);
    } catch {
      hosts.push('<relative>');
    }
  }

  return hosts;
}

function main() {
  const files = sources(SRC);
  const violations = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);

    for (const { name, pattern } of PATTERNS) {
      if (pattern.test(source)) {
        violations.push(`${rel}: ${name}`);
      }
    }

    for (const host of fetchHosts(source)) {
      const allowed = CDN_ALLOWLIST.some((entry) => host === entry || host.endsWith(`.${entry}`));

      if (!allowed) {
        violations.push(`${rel}: fetch to ${host}, which is not on the CDN allowlist`);
      }
    }
  }

  console.log(`secret scan: ${files.length} files under src/, ${CDN_ALLOWLIST.length} allowed hosts`);

  if (violations.length > 0) {
    console.error('\nsecret scan: FAILED');
    for (const violation of violations) {
      console.error(`  ${violation}`);
    }
    process.exit(1);
  }

  console.log('secret scan: no keys, no foreign hosts, no GitHub API');
}

main();
