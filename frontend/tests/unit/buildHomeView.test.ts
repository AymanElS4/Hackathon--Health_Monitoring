/**
 * Tests for the Home view model (T043, research R17). Written before T053; must FAIL until T053.
 *
 * Expected API (implemented by T053):
 *
 *   // frontend/src/application/use-cases/buildHomeView.ts
 *   export interface HomeViewInput {
 *     now: Date;
 *     agenda: readonly AgendaItem[];
 *     lastCheckToday: CheckRecord | null;
 *     connectivity: 'online' | 'offline';
 *     mission: {
 *       crewName: string;
 *       missionStartDate: string;
 *       avatarUrl: string;
 *       lightDays: number;
 *       darkDays: number;
 *       offsetDays: number;
 *     };
 *   }
 *   export interface HomeView {
 *     header: { crewName; missionDay; lightPhase; connectivity; avatarUrl };
 *     now: { itemId; time; titleKey; durationMin; progress: { done; total }; action } | null;
 *     next: AgendaItem[];          // max 2
 *     pendingToday: number;
 *     status: { verdict: Verdict | 'none'; mood; readings; focus };
 *   }
 *   export function buildHomeView(input: HomeViewInput): HomeView;
 *
 * Times are local times on 2026-11-15 (month index 10 = November).
 */
import { describe, it, expect } from 'vitest';
import { CheckRecord, type SensorKey } from '@base-vital/contracts';
import { buildHomeView } from '../../src/application/use-cases/buildHomeView';
import type { HomeViewInput } from '../../src/application/use-cases/buildHomeView';
import { DEMO_AGENDA } from '../../src/config/agenda';
import {
  MISSION,
  LUNAR_LIGHT_DAYS,
  LUNAR_DARK_DAYS,
  LUNAR_CYCLE_OFFSET_DAYS,
} from '../../src/config/mission';

// Test files are exempt from no-magic-numbers.
const at = (hh: number, mm: number): Date => new Date(2026, 10, 15, hh, mm);

const MISSION_INPUT: HomeViewInput['mission'] = {
  crewName: MISSION.crewName,
  missionStartDate: MISSION.missionStartDate,
  avatarUrl: MISSION.avatarUrl,
  lightDays: LUNAR_LIGHT_DAYS,
  darkDays: LUNAR_DARK_DAYS,
  offsetDays: LUNAR_CYCLE_OFFSET_DAYS,
};

const BREAKFAST = DEMO_AGENDA.find((item) => item.id === 'breakfast')!;
const EVA = DEMO_AGENDA.find((item) => item.id === 'eva');
const BIO_EXPERIMENT = DEMO_AGENDA.find((item) => item.id === 'bio-experiment');
const EXERCISE = DEMO_AGENDA.find((item) => item.id === 'exercise');

const SENSOR_KEYS: readonly SensorKey[] = ['sleep', 'pulse', 'pressure', 'temperature', 'oxygen'];

// A valid check saved today at 09:31 local time, validated with the contracts schema.
const CHECK_SAVED_AT = at(9, 31).toISOString();

function buildCheckFixture(): CheckRecord {
  const readings = Object.fromEntries(
    SENSOR_KEYS.map((sensor) => [
      sensor,
      { sensor, level: 'green', phase: 'confirmed', value: '—', outsideNormal: false, teamCriterion: false, reason: null },
    ]),
  );
  return CheckRecord.parse({
    id: CHECK_SAVED_AT,
    observations: [
      {
        indicator: 'sleep_hours',
        value: 7,
        source: 'voice',
        confirmed: true,
        simulated: false,
        at: CHECK_SAVED_AT,
      },
      {
        indicator: 'mood',
        value: 4,
        source: 'voice',
        confirmed: true,
        simulated: false,
        at: CHECK_SAVED_AT,
      },
    ],
    symptoms: ['none'],
    readings,
    verdict: 'ok',
    actionKey: '',
    simulated: false,
  });
}

const CHECK_TODAY = buildCheckFixture();

function input(overrides: Partial<HomeViewInput> = {}): HomeViewInput {
  return {
    now: at(9, 20),
    agenda: DEMO_AGENDA,
    lastCheckToday: null,
    previousChecks: [],
    connectivity: 'offline',
    mission: MISSION_INPUT,
    ...overrides,
  };
}

describe('buildHomeView header', () => {
  it('takes crew name, mission day, light phase, connectivity and avatar from mission, clock and connectivity', () => {
    const view = buildHomeView(input({ now: at(9, 20), connectivity: 'offline' }));

    expect(view.header).toEqual({
      crewName: 'Ana',
      missionDay: 23,
      lightPhase: { kind: 'light', day: 9, of: 14 },
      connectivity: 'offline',
      avatarUrl: '/avatars/crew-placeholder.svg',
    });
  });

  it('echoes an online connectivity state', () => {
    const view = buildHomeView(input({ connectivity: 'online' }));

    expect(view.header.connectivity).toBe('online');
  });
});

describe('buildHomeView now and progress at 09:20', () => {
  it('shows the daily check-in as the current item, not yet done', () => {
    const view = buildHomeView(input({ now: at(9, 20) }));

    expect(view.now).toMatchObject({
      itemId: 'daily-checkin',
      time: '09:30',
      titleKey: 'agenda.dailyCheckin',
      durationMin: 1,
      action: 'start_checkin',
    });
  });

  it('counts no item as done before the daily check is saved: 0 of 5', () => {
    const view = buildHomeView(input({ now: at(9, 20) }));

    expect(view.now?.progress).toEqual({ done: 0, total: 5 });
  });

  it('lists at most two upcoming items after now', () => {
    const view = buildHomeView(input({ now: at(9, 20) }));

    expect(view.next).toEqual([EVA, BIO_EXPERIMENT]);
  });

  it('counts every item not really done as pending today', () => {
    const view = buildHomeView(input({ now: at(9, 20) }));

    expect(view.pendingToday).toBe(5);
  });
});

describe('buildHomeView check-in not yet done at 09:35', () => {
  it('keeps the daily check-in as the current item while no check is saved today', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: null }));

    expect(view.now).toMatchObject({ itemId: 'daily-checkin' });
    expect(view.now?.progress).toEqual({ done: 0, total: 5 });
  });
});

describe('buildHomeView at 13:30 (past times are not done)', () => {
  it('keeps the daily check-in in "Ahora" with no check, even after its time, 0 of 5', () => {
    const view = buildHomeView(input({ now: at(13, 30), lastCheckToday: null }));

    expect(view.now).toMatchObject({ itemId: 'daily-checkin', time: '09:30' });
    expect(view.now?.progress).toEqual({ done: 0, total: 5 });
  });

  it('lists the following not-done items after the check-in in "Después" with no check', () => {
    const view = buildHomeView(input({ now: at(13, 30), lastCheckToday: null }));

    expect(view.next).toEqual([EVA, BIO_EXPERIMENT]);
    expect(view.pendingToday).toBe(5);
  });

  it('moves "Ahora" to the next not-done item after the check is saved, 1 of 5', () => {
    const view = buildHomeView(input({ now: at(13, 30), lastCheckToday: CHECK_TODAY }));

    expect(view.now).toMatchObject({ itemId: 'exercise', time: '18:00' });
    expect(view.now?.progress).toEqual({ done: 1, total: 5 });
    expect(view.next).toEqual([]);
    expect(view.pendingToday).toBe(4);
  });

  it('never counts a past item as done, even when it is not shown', () => {
    const view = buildHomeView(input({ now: at(13, 30), lastCheckToday: CHECK_TODAY }));

    expect(view.now?.itemId).not.toBe(BREAKFAST.id);
    expect(view.now?.progress.done).toBe(1);
  });
});

describe('buildHomeView with the check saved and the agenda past', () => {
  it('shows the last item not done as current at 19:00 and no next items', () => {
    const view = buildHomeView(input({ now: at(19, 0), lastCheckToday: CHECK_TODAY }));

    expect(view.now).toMatchObject({ itemId: 'exercise', time: '18:00' });
    expect(view.now?.progress).toEqual({ done: 1, total: 5 });
    expect(view.next).toEqual([]);
    expect(view.pendingToday).toBe(4);
  });
});

describe('buildHomeView check-in done at 09:35', () => {
  it('moves the current item to the EVA and counts only the check-in as done', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: CHECK_TODAY }));

    expect(view.now).toMatchObject({ itemId: 'eva', time: '10:00', titleKey: 'agenda.eva' });
    expect(view.now?.progress).toEqual({ done: 1, total: 5 });
  });

  it('lists the next two not-done items after the EVA and counts the four not done', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: CHECK_TODAY }));

    expect(view.next).toEqual([BIO_EXPERIMENT, EXERCISE]);
    expect(view.pendingToday).toBe(4);
  });
});

describe('buildHomeView after the last item', () => {
  it('keeps the daily check-in current at 19:00 while no check is saved', () => {
    const view = buildHomeView(input({ now: at(19, 0) }));

    expect(view.now).toMatchObject({ itemId: 'daily-checkin' });
    expect(view.next).toEqual([EVA, BIO_EXPERIMENT]);
    expect(view.pendingToday).toBe(5);
  });
});

describe('buildHomeView status without a check today', () => {
  it('has verdict none, no mood, no readings and no focus', () => {
    const view = buildHomeView(input({ now: at(9, 20), lastCheckToday: null }));

    expect(view.status.verdict).toBe('none');
    expect(view.status.mood).toBeNull();
    expect(view.status.readings).toEqual([]);
    expect(view.status.focus).toBeNull();
  });
});

describe('buildHomeView status from today\'s check (FR-016, T065)', () => {
  // Sleep 5 h (amber, set by sleep_hours, not a team criterion), mood 4 (confirmed voice).
  // Validated with the contracts schema; readings carry `teamCriterion` (added to SensorReading by T068).
  function buildAttentionCheckFixture(): CheckRecord {
    const readings = {
      sleep: {
        sensor: 'sleep',
        level: 'amber',
        phase: 'confirmed',
        value: '5 h',
        outsideNormal: false,
        reason: 'sleep_hours',
        teamCriterion: false,
      },
      pulse: {
        sensor: 'pulse',
        level: 'green',
        phase: 'confirmed',
        value: '72',
        outsideNormal: false,
        reason: null,
        teamCriterion: false,
      },
      pressure: {
        sensor: 'pressure',
        level: 'green',
        phase: 'confirmed',
        value: '118/76',
        outsideNormal: false,
        reason: null,
        teamCriterion: false,
      },
      temperature: {
        sensor: 'temperature',
        level: 'green',
        phase: 'confirmed',
        value: '36.8',
        outsideNormal: false,
        reason: null,
        teamCriterion: false,
      },
      oxygen: {
        sensor: 'oxygen',
        level: 'green',
        phase: 'confirmed',
        value: '98',
        outsideNormal: false,
        reason: null,
        teamCriterion: false,
      },
    };
    return CheckRecord.parse({
      id: CHECK_SAVED_AT,
      observations: [
        {
          indicator: 'sleep_hours',
          value: 5,
          source: 'voice',
          confirmed: true,
          simulated: false,
          at: CHECK_SAVED_AT,
        },
        {
          indicator: 'mood',
          value: 4,
          source: 'voice',
          confirmed: true,
          simulated: false,
          at: CHECK_SAVED_AT,
        },
      ],
      symptoms: ['none'],
      readings,
      verdict: 'attention',
      actionKey: 'action.slept_little',
      simulated: false,
    });
  }

  const ATTENTION_CHECK = buildAttentionCheckFixture();

  it('takes status.verdict from the last check of today', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: ATTENTION_CHECK }));

    expect(view.status.verdict).toBe('attention');
  });

  it('takes status.mood from the confirmed voice mood observation with the team-criterion flag', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: ATTENTION_CHECK }));

    expect(view.status.mood).toEqual({ value: 4, of: 5, level: 'green', teamCriterion: true });
  });

  it('copies minimal readings (sensor, value, level, reason, teamCriterion) from the record', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: ATTENTION_CHECK }));

    expect(view.status.readings).toHaveLength(SENSOR_KEYS.length);
    for (const sensor of SENSOR_KEYS) {
      const source = ATTENTION_CHECK.readings[sensor];
      if (source === undefined) throw new Error(`fixture has no reading for ${sensor}`);
      expect(view.status.readings).toContainEqual({
        sensor,
        value: source.value,
        level: source.level,
        reason: source.reason,
        teamCriterion: false,
      });
    }
  });

  it('keeps the sleep reading amber with reason sleep_hours', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: ATTENTION_CHECK }));

    expect(view.status.readings).toContainEqual({
      sensor: 'sleep',
      value: '5 h',
      level: 'amber',
      reason: 'sleep_hours',
      teamCriterion: false,
    });
  });
});

describe('buildHomeView mood level uses the previous days (RN2)', () => {
  /** A valid check with one confirmed voice mood, saved at 09:31 on the given local day. */
  function moodCheck(day: number, mood: number): CheckRecord {
    const readings = Object.fromEntries(
      SENSOR_KEYS.map((sensor) => [
        sensor,
        { sensor, level: 'green', phase: 'confirmed', value: '—', outsideNormal: false, teamCriterion: false, reason: null },
      ]),
    );
    const savedAt = new Date(2026, 10, day, 9, 31).toISOString();
    return CheckRecord.parse({
      id: savedAt,
      observations: [
        { indicator: 'mood', value: mood, source: 'voice', confirmed: true, simulated: false, at: savedAt },
      ],
      symptoms: ['none'],
      readings,
      verdict: 'attention',
      actionKey: 'action.single_amber',
      simulated: false,
    });
  }

  it('mood 2 today with mood 2 yesterday is red', () => {
    const view = buildHomeView(
      input({
        now: at(9, 35),
        lastCheckToday: moodCheck(15, 2),
        previousChecks: [moodCheck(14, 2)],
      }),
    );

    expect(view.status.mood).toMatchObject({ value: 2, level: 'red', teamCriterion: true });
  });

  it('mood 2 today with no previous check is amber', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: moodCheck(15, 2), previousChecks: [] }));

    expect(view.status.mood).toMatchObject({ level: 'amber' });
  });
});
