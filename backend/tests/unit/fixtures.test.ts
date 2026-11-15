import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SyncCheck } from '../../src/domain/sync-check';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

/** Reads a JSON fixture from `tests/fixtures` as an untyped value. */
function readFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));
}

describe('sync-check JSON fixtures', () => {
  it('sync-check.ok.json parses as a SyncCheck', () => {
    const result = SyncCheck.safeParse(readFixture('sync-check.ok.json'));
    expect(result.success).toBe(true);
  });

  it('sync-check.alert.json parses as a SyncCheck', () => {
    const result = SyncCheck.safeParse(readFixture('sync-check.alert.json'));
    expect(result.success).toBe(true);
  });
});
