// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
/**
 * Every source file starts with the licence notice - its two lines, in the file's own comment
 * syntax: `//` in .ts and .mjs, a block comment in .css, an HTML comment in .html (index.html
 * right after its doctype). Exits 1 naming the files without it, or when it finds fewer source
 * files than FLOOR, so a search that suddenly finds nothing can't pass. The pre-commit hook runs
 * it: `npm run check:license`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NOTICE = ['SPDX-License-Identifier: AGPL-3.0-only', 'Copyright (C) 2026 Francesco Campanile'];
const COMMENT = {
  '.ts': (line) => `// ${line}`,
  '.mjs': (line) => `// ${line}`,
  '.css': (line) => `/* ${line} */`,
  '.html': (line) => `<!-- ${line} -->`,
};
const FLOOR = 200;
const DOCTYPE = '<!doctype html>\n';
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** The files under `dir` (relative to the repository) with one of `extensions`. */
function sourcesIn(dir, extensions) {
  return readdirSync(join(ROOT, dir), { recursive: true })
    .map((path) => join(dir, path))
    .filter((path) => extensions.includes(extname(path)));
}

function hasNotice(path) {
  const notice = NOTICE.map(COMMENT[extname(path)]).join('\n') + '\n';
  let text = readFileSync(join(ROOT, path), 'utf8');
  if (path === join('src', 'index.html') && text.startsWith(DOCTYPE))
    text = text.slice(DOCTYPE.length);
  return text.startsWith(notice);
}

const sources = [...sourcesIn('src', ['.ts', '.html', '.css']), ...sourcesIn('scripts', ['.mjs'])];
const missing = sources.filter((path) => !hasNotice(path));

if (sources.length < FLOOR) {
  console.error(
    `check:license found ${sources.length} source files, fewer than ${FLOOR}: is it looking in the right place?`,
  );
  process.exit(1);
}
if (missing.length) {
  console.error(
    `Without the licence notice in their first two lines:\n${missing.map((path) => `  ${path}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(`The licence notice is in all ${sources.length} source files.`);
