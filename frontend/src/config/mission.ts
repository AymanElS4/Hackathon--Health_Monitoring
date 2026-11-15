/**
 * Mission profile (single crew profile in v0) and lunar cycle parameters.
 *
 * Arithmetic behind the example in the spec ("Día 23 · Luz 9/14"):
 * - missionDay = whole local calendar days since missionStartDate + 1.
 *   2026-10-24 → 2026-11-15 is 22 days, so 2026-11-15 is day 22 + 1 = 23.
 * - The cycle is LUNAR_LIGHT_DAYS + LUNAR_DARK_DAYS = 28 days long.
 *   Zero-based cycle index = (missionDay - 1 + LUNAR_CYCLE_OFFSET_DAYS) mod 28
 *   = (22 + 14) mod 28 = 8, and index 8 < 14 is light, so light day 8 + 1 = 9.
 * - LUNAR_CYCLE_OFFSET_DAYS = 14 says mission day 1 sits 14 days into the
 *   cycle, i.e. at dark day 1. Light therefore starts on mission day 15.
 *   Without this offset, day 23 would be dark, not light day 9.
 */

export const MISSION = {
  crewName: 'Ana',
  /** Day 1 of the mission (ISO date, local calendar day). */
  missionStartDate: '2026-10-24',
  avatarUrl: '/avatars/crew-placeholder.svg',
} as const;

/** Length of the light phase, in days. */
export const LUNAR_LIGHT_DAYS = 14;

/** Length of the dark phase, in days. */
export const LUNAR_DARK_DAYS = 14;

/**
 * Days into the lunar cycle that mission day 1 sits at (see the arithmetic above).
 * 14 means mission day 1 is dark day 1.
 */
export const LUNAR_CYCLE_OFFSET_DAYS = 14;
