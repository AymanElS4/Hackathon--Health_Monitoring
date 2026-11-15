/**
 * RN1 / RN2 level checks (T062). Implemented in T067, `src/levels.ts`.
 *
 * Expected API:
 *
 *   levelFor(
 *     indicator: Indicator,
 *     value: number | { systolic: number; diastolic: number },
 *     context?: {
 *       history?: readonly number[]; // previous days' values for the same indicator, most recent first
 *       symptoms?: readonly Symptom[];
 *     },
 *   ): { level: Level; teamCriterion: boolean }
 *
 * `teamCriterion` is true when the band that set the level is a team criterion:
 * pulse outside 60–100, sleep red by the 3-night rule, and any mood level.
 *
 * Consecutive-day rules (RN2 and the clarifications):
 * - sleep < 6 h in 1 or 2 nights in a row → amber (attention), red only on 3 nights in a row.
 * - mood ≤ 2 on 1 day → amber, red only on 2 days in a row.
 */
import { describe, it, expect } from 'vitest';
import type { Indicator, Symptom } from '@base-vital/contracts';
import { levelFor } from '../src/levels';

type Case = {
  name: string;
  indicator: Indicator;
  value: number | { systolic: number; diastolic: number };
  context?: { history?: readonly number[]; symptoms?: readonly Symptom[] };
  level: string;
  teamCriterion?: boolean;
};

const bp = (systolic: number, diastolic: number) => ({ systolic, diastolic });

const CASES: Case[] = [
  // Blood pressure (AHA/ACC 2025)
  { name: 'BP 118/76 is green', indicator: 'blood_pressure', value: bp(118, 76), level: 'green', teamCriterion: false },
  { name: 'BP 128/76 is amber', indicator: 'blood_pressure', value: bp(128, 76), level: 'amber', teamCriterion: false },
  { name: 'BP 140/85 is red', indicator: 'blood_pressure', value: bp(140, 85), level: 'red', teamCriterion: false },
  { name: 'BP 135/92 is red', indicator: 'blood_pressure', value: bp(135, 92), level: 'red', teamCriterion: false },
  { name: 'BP 120/80 is amber', indicator: 'blood_pressure', value: bp(120, 80), level: 'amber', teamCriterion: false },
  { name: 'BP 139/89 is amber', indicator: 'blood_pressure', value: bp(139, 89), level: 'amber', teamCriterion: false },

  // Resting pulse (60–100 AHA; other bands are team criterion)
  { name: 'pulse 72 is green', indicator: 'resting_heart_rate', value: 72, level: 'green', teamCriterion: false },
  { name: 'pulse 60 is green', indicator: 'resting_heart_rate', value: 60, level: 'green', teamCriterion: false },
  { name: 'pulse 100 is green', indicator: 'resting_heart_rate', value: 100, level: 'green', teamCriterion: false },
  { name: 'pulse 55 is amber', indicator: 'resting_heart_rate', value: 55, level: 'amber', teamCriterion: true },
  { name: 'pulse 101 is amber', indicator: 'resting_heart_rate', value: 101, level: 'amber', teamCriterion: true },
  { name: 'pulse 105 is amber', indicator: 'resting_heart_rate', value: 105, level: 'amber', teamCriterion: true },
  { name: 'pulse 110 is amber', indicator: 'resting_heart_rate', value: 110, level: 'amber', teamCriterion: true },
  { name: 'pulse 115 is red', indicator: 'resting_heart_rate', value: 115, level: 'red', teamCriterion: true },
  { name: 'pulse 48 without symptoms is amber', indicator: 'resting_heart_rate', value: 48, level: 'amber', teamCriterion: true },
  { name: 'pulse 48 with dizziness is red', indicator: 'resting_heart_rate', value: 48, context: { symptoms: ['dizziness'] }, level: 'red', teamCriterion: true },

  // Body temperature (MedlinePlus normal, CDC fever, Mayo Clinic hypothermia)
  { name: 'temp 36.8 is green', indicator: 'body_temperature', value: 36.8, level: 'green', teamCriterion: false },
  { name: 'temp 36.1 is green', indicator: 'body_temperature', value: 36.1, level: 'green', teamCriterion: false },
  { name: 'temp 37.2 is green', indicator: 'body_temperature', value: 37.2, level: 'green', teamCriterion: false },
  { name: 'temp 37.5 is amber', indicator: 'body_temperature', value: 37.5, level: 'amber', teamCriterion: false },
  { name: 'temp 37.3 is amber', indicator: 'body_temperature', value: 37.3, level: 'amber', teamCriterion: false },
  { name: 'temp 37.9 is amber', indicator: 'body_temperature', value: 37.9, level: 'amber', teamCriterion: false },
  { name: 'temp 38.0 is red', indicator: 'body_temperature', value: 38.0, level: 'red', teamCriterion: false },
  { name: 'temp 35.6 is in_doubt', indicator: 'body_temperature', value: 35.6, level: 'in_doubt', teamCriterion: false },
  { name: 'temp 36.0 is in_doubt', indicator: 'body_temperature', value: 36.0, level: 'in_doubt', teamCriterion: false },
  { name: 'temp 35.0 is in_doubt', indicator: 'body_temperature', value: 35.0, level: 'in_doubt', teamCriterion: false },
  { name: 'temp 34.8 is red', indicator: 'body_temperature', value: 34.8, level: 'red', teamCriterion: false },

  // Oxygen saturation (WHO)
  { name: 'SpO2 97 is green', indicator: 'oxygen_saturation', value: 97, level: 'green', teamCriterion: false },
  { name: 'SpO2 95 is green', indicator: 'oxygen_saturation', value: 95, level: 'green', teamCriterion: false },
  { name: 'SpO2 94 is amber', indicator: 'oxygen_saturation', value: 94, level: 'amber', teamCriterion: false },
  { name: 'SpO2 92 is amber', indicator: 'oxygen_saturation', value: 92, level: 'amber', teamCriterion: false },
  { name: 'SpO2 90 is amber', indicator: 'oxygen_saturation', value: 90, level: 'amber', teamCriterion: false },
  { name: 'SpO2 89.9 is red', indicator: 'oxygen_saturation', value: 89.9, level: 'red', teamCriterion: false },
  { name: 'SpO2 88 is red', indicator: 'oxygen_saturation', value: 88, level: 'red', teamCriterion: false },

  // Sleep hours (AASM/SRS green; 3-night red rule is team criterion)
  { name: 'sleep 7.5 h is green', indicator: 'sleep_hours', value: 7.5, level: 'green', teamCriterion: false },
  { name: 'sleep 7 h is green', indicator: 'sleep_hours', value: 7, level: 'green', teamCriterion: false },
  { name: 'sleep 6.5 h is amber', indicator: 'sleep_hours', value: 6.5, level: 'amber', teamCriterion: false },
  { name: 'sleep 6 h is amber', indicator: 'sleep_hours', value: 6, level: 'amber', teamCriterion: false },
  {
    name: 'sleep 5 h, one night (history [7.2, 7.8]) is amber (RN2)',
    indicator: 'sleep_hours',
    value: 5,
    context: { history: [7.2, 7.8] },
    level: 'amber',
    teamCriterion: false,
  },
  {
    name: 'sleep 5 h, two nights (history [5.5, 7.8]) is amber',
    indicator: 'sleep_hours',
    value: 5,
    context: { history: [5.5, 7.8] },
    level: 'amber',
    teamCriterion: false,
  },
  {
    name: 'sleep 5 h, three nights (history [5.5, 5.8]) is red',
    indicator: 'sleep_hours',
    value: 5,
    context: { history: [5.5, 5.8] },
    level: 'red',
    teamCriterion: true,
  },

  // Mood (team criterion, any level)
  { name: 'mood 5 is green', indicator: 'mood', value: 5, level: 'green', teamCriterion: true },
  { name: 'mood 4 is green', indicator: 'mood', value: 4, level: 'green', teamCriterion: true },
  { name: 'mood 3 is amber', indicator: 'mood', value: 3, level: 'amber', teamCriterion: true },
  {
    name: 'mood 2 on one day (history [4]) is amber (RN2)',
    indicator: 'mood',
    value: 2,
    context: { history: [4] },
    level: 'amber',
    teamCriterion: true,
  },
  {
    name: 'mood 2 on two days (history [2]) is red',
    indicator: 'mood',
    value: 2,
    context: { history: [2] },
    level: 'red',
    teamCriterion: true,
  },
];

describe('levelFor (RN1, RN2)', () => {
  it.each(CASES)('$name', ({ indicator, value, context, level, teamCriterion }) => {
    const result = levelFor(indicator, value, context);
    expect(result.level).toBe(level);
    expect(result.teamCriterion).toBe(teamCriterion);
  });
});
