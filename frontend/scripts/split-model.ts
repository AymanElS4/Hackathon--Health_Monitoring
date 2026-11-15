/**
 * Splits the Vosk model archive into parts below the Cloudflare Pages 25 MiB limit (005 FR-015).
 *
 * Usage: `npm run split:model` (defaults), or
 *        `npx tsx scripts/split-model.ts <input> <outputDir> [partBytes]` (default 20 MiB).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PART_BYTES, splitBuffer } from './splitModelLogic';

const JSON_INDENT = 2;
const ARG_INPUT = 2;
const ARG_OUT = 3;
const ARG_PART = ARG_OUT + 1;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(process.argv[ARG_INPUT] ?? join(root, 'models-src/vosk/vosk-model-small-es-0.42.tar.gz'));
const outDir = resolve(process.argv[ARG_OUT] ?? join(root, 'public/models/vosk/parts'));
const partBytes = process.argv[ARG_PART] ? Number(process.argv[ARG_PART]) : DEFAULT_PART_BYTES;

const file = basename(input);
const data = readFileSync(input);
const sha256 = createHash('sha256').update(data).digest('hex');
const { manifest, parts } = splitBuffer(file, data, sha256, partBytes);

mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) {
  if (f.startsWith(`${file}.part`) || f === 'manifest.json') rmSync(join(outDir, f));
}
for (const p of parts) writeFileSync(join(outDir, p.name), p.bytes);
writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, JSON_INDENT)}\n`);
console.log(`${file}: ${manifest.size} bytes, sha256 ${manifest.sha256}`);
for (const p of manifest.parts) console.log(`  ${p.name} ${p.size}`);
