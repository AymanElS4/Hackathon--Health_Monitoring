/** Fails when any file in `dist/` is 25 MiB or larger (005 FR-015, SC-009). */
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_PUBLISHED_FILE_BYTES } from './splitModelLogic';

const dist = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'dist'));

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

let largest = { path: '', size: 0 };
const tooBig: string[] = [];
for (const p of walk(dist)) {
  const size = statSync(p).size;
  if (size > largest.size) largest = { path: relative(dist, p), size };
  if (size >= MAX_PUBLISHED_FILE_BYTES) tooBig.push(`${relative(dist, p)} (${size} bytes)`);
}
if (tooBig.length > 0) {
  console.error(`dist/ files >= ${MAX_PUBLISHED_FILE_BYTES} bytes:\n  ${tooBig.join('\n  ')}`);
  process.exit(1);
}
console.log(`dist size OK; largest file: ${largest.path} (${largest.size} bytes)`);
