import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALERT_DECISIONS } from '../../src/application/use-cases/decide-alert';
import { Indicator, Source, Symptom, Verdict } from '../../src/shared/contracts';

// FR-015: the SQL CHECK lists must mirror the Zod contract enums exactly.
const SQL = readFileSync(path.resolve(__dirname, '../../migrations/0001_init.sql'), 'utf8');

const QUOTED = /'([^']*)'/g;

function quotedValues(list: string): string[] {
  return [...list.matchAll(QUOTED)].map((match) => match[1]);
}

function tableBlock(sql: string, table: string): string {
  const match = new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\);`).exec(sql);
  if (!match) {
    throw new Error(`CREATE TABLE ${table} not found`);
  }
  return match[1];
}

// Returns the values of the first `<column> ... IN (...)` list inside the table, in SQL order.
function checkList(sql: string, table: string, column: string): string[] {
  const pattern = new RegExp(`\\b${column}\\b[^\\n]*?\\bIN\\s*\\(([^)]*)\\)`);
  const match = pattern.exec(tableBlock(sql, table));
  if (!match) {
    throw new Error(`no IN (...) list for ${table}.${column}`);
  }
  return quotedValues(match[1]);
}

// Returns the values of the `symptoms <@ ARRAY[...]` check inside check_records, in SQL order.
function symptomsArray(sql: string): string[] {
  const match = /symptoms\s*<@\s*ARRAY\[([^\]]*)\]/.exec(tableBlock(sql, 'check_records'));
  if (!match) {
    throw new Error('no symptoms <@ ARRAY[...] check in check_records');
  }
  return quotedValues(match[1]);
}

// Decision M9: observations never store a level or a team criterion; those are derived at read time.
function observationsBlock(sql: string): string {
  return tableBlock(sql, 'observations');
}

const sorted = (values: readonly string[]): string[] => [...values].sort();

describe('0001_init.sql CHECK lists match the contracts', () => {
  it('check_records.verdict equals Verdict.options', () => {
    expect(sorted(checkList(SQL, 'check_records', 'verdict'))).toEqual(sorted(Verdict.options));
  });

  it('observations.indicator equals Indicator.options', () => {
    expect(sorted(checkList(SQL, 'observations', 'indicator'))).toEqual(
      sorted(Indicator.options),
    );
  });

  it('observations.source equals Source.options', () => {
    expect(sorted(checkList(SQL, 'observations', 'source'))).toEqual(sorted(Source.options));
  });

  it('check_records.symptoms array check equals Symptom.options', () => {
    expect(sorted(symptomsArray(SQL))).toEqual(sorted(Symptom.options));
  });

  it("check_records.kind equals ['daily']", () => {
    expect(sorted(checkList(SQL, 'check_records', 'kind'))).toEqual(['daily']);
  });

  it("alerts.urgency equals ['now','soon']", () => {
    expect(sorted(checkList(SQL, 'alerts', 'urgency'))).toEqual(['now', 'soon']);
  });

  it("alerts.status equals ['decided','open']", () => {
    expect(sorted(checkList(SQL, 'alerts', 'status'))).toEqual(['decided', 'open']);
  });

  it("alerts.decision equals ['consult_surgeon','manage_on_base','prepare_return']", () => {
    expect(sorted(checkList(SQL, 'alerts', 'decision'))).toEqual([
      'consult_surgeon',
      'manage_on_base',
      'prepare_return',
    ]);
  });

  it('alerts.decision equals ALERT_DECISIONS (use-case validation mirrors the SQL list)', () => {
    expect(sorted(checkList(SQL, 'alerts', 'decision'))).toEqual(sorted(ALERT_DECISIONS));
  });

  it('observations table has no level or team_criterion column (decision M9)', () => {
    const block = observationsBlock(SQL);
    expect(block).not.toMatch(/\blevel\b/);
    expect(block).not.toMatch(/\bteam_criterion\b/);
  });
});
