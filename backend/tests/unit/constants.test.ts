import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HISTORY_DAYS, MIGRATIONS_DIR } from '../../src/config/constants';

const FIRST_MIGRATION = '0001_init.sql';
const EXPECTED_HISTORY_DAYS = 14;

describe('config constants', () => {
  it('resolves MIGRATIONS_DIR to a directory containing the first migration', () => {
    expect(fs.existsSync(path.join(MIGRATIONS_DIR, FIRST_MIGRATION))).toBe(true);
  });

  it('keeps HISTORY_DAYS at 14', () => {
    expect(HISTORY_DAYS).toBe(EXPECTED_HISTORY_DAYS);
  });
});
