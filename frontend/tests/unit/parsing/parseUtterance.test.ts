/**
 * Tests for deterministic utterance parsing used by the spoken check-in (T041).
 *
 * Expected API (implemented by T046):
 *
 *   // frontend/src/domain/parsing/parseUtterance.ts
 *   export type StepKind = 'sleep' | 'mood' | 'symptoms' | 'confirm' | 'none';
 *
 *   export type ParseResult =
 *     | { kind: 'value'; indicator: 'sleep_hours' | 'mood'; value: number }
 *     | { kind: 'symptoms'; symptoms: Symptom[] }   // Symptom from @base-vital/contracts
 *     | { kind: 'intent'; intent: 'confirm' | 'deny' | 'pause' | 'resume' | 'repeat' };
 *
 *   export function parseUtterance(step: StepKind, transcript: string): ParseResult | null;
 *
 * Contract:
 * - Pure and deterministic; no AI.
 * - Returns RAW values. Range checks (RN4: sleep > 16, mood outside 1-5) belong to the
 *   reducer, so "veinte horas" at step 'sleep' returns value 20.
 * - Control words ("para" -> pause, "sigue" -> resume, "repite" -> repeat) are recognised
 *   at ANY step.
 * - "sí"/"si" -> confirm and "no" -> deny only at step 'confirm'.
 * - "no"/"ninguno" at step 'symptoms' -> symptoms: ['none'].
 * - Matching is case-insensitive and accent-insensitive.
 * - Unknown or empty transcripts return null.
 */
import { describe, it, expect } from 'vitest';
import { parseUtterance } from '../../../src/domain/parsing/parseUtterance';

type StepKind = 'sleep' | 'mood' | 'symptoms' | 'confirm' | 'none';

const ALL_STEPS: readonly StepKind[] = ['sleep', 'mood', 'symptoms', 'confirm', 'none'];

describe('parseUtterance - mood words', () => {
  it.each([
    ['mal', 2],
    ['bien', 4],
    ['muy bien', 5],
    ['regular', 3],
    ['muy mal', 1],
  ])('maps mood word "%s" at step mood to %i', (transcript, value) => {
    expect(parseUtterance('mood', transcript)).toEqual({
      kind: 'value',
      indicator: 'mood',
      value,
    });
  });

  it.each([
    ['1', 1],
    ['2', 2],
    ['3', 3],
    ['4', 4],
    ['5', 5],
  ])('maps mood digit "%s" at step mood to %i', (transcript, value) => {
    expect(parseUtterance('mood', transcript)).toEqual({
      kind: 'value',
      indicator: 'mood',
      value,
    });
  });
});

describe('parseUtterance - symptoms', () => {
  it.each([
    ['mareo', 'dizziness'],
    ['desmayo', 'fainting'],
    ['dolor de pecho', 'chest_pain'],
    ['falta de aire', 'shortness_of_breath'],
  ])('maps symptom "%s" at step symptoms to [%s]', (transcript, symptom) => {
    expect(parseUtterance('symptoms', transcript)).toEqual({
      kind: 'symptoms',
      symptoms: [symptom],
    });
  });

  it.each([['no'], ['ninguno']])('maps "%s" at step symptoms to [none]', (transcript) => {
    expect(parseUtterance('symptoms', transcript)).toEqual({
      kind: 'symptoms',
      symptoms: ['none'],
    });
  });

  it('returns both symptoms for a phrase naming two of them', () => {
    const result = parseUtterance('symptoms', 'mareo y falta de aire');
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ kind: 'symptoms' });
    expect(new Set((result as { symptoms: string[] }).symptoms)).toEqual(
      new Set(['dizziness', 'shortness_of_breath']),
    );
  });
});

describe('parseUtterance - control words at any step', () => {
  it.each(ALL_STEPS)('maps "para" to pause at step %s', (step) => {
    expect(parseUtterance(step, 'para')).toEqual({ kind: 'intent', intent: 'pause' });
  });

  it.each(ALL_STEPS)('maps "sigue" to resume at step %s', (step) => {
    expect(parseUtterance(step, 'sigue')).toEqual({ kind: 'intent', intent: 'resume' });
  });

  it.each(ALL_STEPS)('maps "repite" to repeat at step %s', (step) => {
    expect(parseUtterance(step, 'repite')).toEqual({ kind: 'intent', intent: 'repeat' });
  });
});

describe('parseUtterance - confirm step', () => {
  it.each([['sí'], ['si']])('maps "%s" at step confirm to confirm', (transcript) => {
    expect(parseUtterance('confirm', transcript)).toEqual({ kind: 'intent', intent: 'confirm' });
  });

  it('maps "no" at step confirm to deny', () => {
    expect(parseUtterance('confirm', 'no')).toEqual({ kind: 'intent', intent: 'deny' });
  });
});

describe('parseUtterance - sleep step', () => {
  it('maps "cinco horas" at step sleep to 5 sleep hours', () => {
    expect(parseUtterance('sleep', 'cinco horas')).toEqual({
      kind: 'value',
      indicator: 'sleep_hours',
      value: 5,
    });
  });

  it('maps "siete y media" at step sleep to 7.5 sleep hours', () => {
    expect(parseUtterance('sleep', 'siete y media')).toEqual({
      kind: 'value',
      indicator: 'sleep_hours',
      value: 7.5,
    });
  });

  it('returns the raw value without range checks ("veinte horas" -> 20)', () => {
    expect(parseUtterance('sleep', 'veinte horas')).toEqual({
      kind: 'value',
      indicator: 'sleep_hours',
      value: 20,
    });
  });
});

describe('parseUtterance - case and accent insensitivity', () => {
  it('matches "MUY BIEN" at step mood to 5', () => {
    expect(parseUtterance('mood', 'MUY BIEN')).toEqual({
      kind: 'value',
      indicator: 'mood',
      value: 5,
    });
  });

  it('matches "Sí" at step confirm to confirm', () => {
    expect(parseUtterance('confirm', 'Sí')).toEqual({ kind: 'intent', intent: 'confirm' });
  });

  it('matches "PARA" at step sleep to pause', () => {
    expect(parseUtterance('sleep', 'PARA')).toEqual({ kind: 'intent', intent: 'pause' });
  });
});

describe('parseUtterance - unknown or empty input', () => {
  it.each(ALL_STEPS)('returns null for empty transcript at step %s', (step) => {
    expect(parseUtterance(step, '')).toBeNull();
  });

  it.each(ALL_STEPS)('returns null for unrecognised transcript at step %s', (step) => {
    expect(parseUtterance(step, 'xyzzy plugh')).toBeNull();
  });
});
