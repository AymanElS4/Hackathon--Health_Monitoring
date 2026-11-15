import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_DIR } from '../../src/config/constants';

// Static checks on the browser files. Spanish text lives only in messages.es.ts (constitution II),
// and the script must never build DOM from strings with innerHTML.

const SPANISH_ACCENTS = /[áéíóúñÁÉÍÓÚÑ]/;
const read = (name: string): string => fs.readFileSync(path.join(PUBLIC_DIR, name), 'utf8');

describe('surgeon page static assets', () => {
  it('cirujano.js never uses innerHTML', () => {
    expect(read('cirujano.js')).not.toContain('innerHTML');
  });

  it('cirujano.html contains no Spanish letters (text comes from messages)', () => {
    expect(read('cirujano.html')).not.toMatch(SPANISH_ACCENTS);
  });

  it('cirujano.js contains no Spanish letters (text comes from messages)', () => {
    expect(read('cirujano.js')).not.toMatch(SPANISH_ACCENTS);
  });
});
