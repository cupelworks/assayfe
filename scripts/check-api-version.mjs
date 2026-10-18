// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
/**
 * Whether an API version is one this front end works with: package.json's `assay.api`, a caret
 * range ("^2.4.0": 2.4.0 or any later 2.x). The deploy pipeline runs it with the API's version
 * before it builds the image - a leading "v" is fine:
 *
 *   node scripts/check-api-version.mjs 2.4.1
 *
 * Exits 0 when the version is in the range and 1 when it isn't, a pre-release included; 2 when it
 * can't tell (no version, one it can't read, or a range that isn't a caret range). Needs only Node.
 */
import { readFileSync } from 'node:fs';

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** A version's three numbers and its pre-release, or null when the text isn't a version. */
function parse(text) {
  const m = SEMVER.exec(text.trim());
  return m && { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? null };
}

function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** The first version a caret range no longer takes: ^2.4.0 -> 3.0.0, ^0.4.0 -> 0.5.0, ^0.0.4 -> 0.0.5. */
function ceiling([major, minor, patch]) {
  if (major > 0) return [major + 1, 0, 0];
  if (minor > 0) return [0, minor + 1, 0];
  return [0, 0, patch + 1];
}

function stop(code, message) {
  console.error(message);
  process.exit(code);
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const range = pkg.assay?.api;
const floor = typeof range === 'string' && range.startsWith('^') ? parse(range.slice(1)) : null;
if (!floor || floor.pre) {
  stop(
    2,
    `package.json's assay.api should be a caret range such as "^2.4.0", not ${JSON.stringify(range)}.`,
  );
}

const given = process.argv[2];
if (!given) stop(2, 'Usage: node scripts/check-api-version.mjs <api-version>   (such as 2.4.1)');
const version = parse(given);
if (!version) stop(2, `"${given}" isn't a version: it should read X.Y.Z, such as 2.4.1.`);

const where = `${range} (package.json's assay.api)`;
if (version.pre) stop(1, `API ${given} is a pre-release, which ${where} doesn't take.`);
if (compare(version.core, floor.core) < 0 || compare(version.core, ceiling(floor.core)) >= 0) {
  stop(1, `API ${given} is outside ${where}: this front end needs an API in that range.`);
}
console.log(`API ${given} is within ${where}.`);
