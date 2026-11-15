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
import { MIN_SD } from '@base-vital/health-rules';
import { buildHomeView } from '../../src/application/use-cases/buildHomeView';
import type { HomeViewInput } from '../../src/application/use-cases/buildHomeView';
import { formatReadingValue } from '../../src/application/use-cases/formatReadingValue';
import { computeRangeBar } from '../../src/ui/components/rangeBarLayout';
import { buildSeedHistory } from '../../src/application/use-cases/seedHistory';
import { DEMO_SCENARIOS } from '../../src/config/demoScenarios';
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

  it('lists only the upcoming not-done items in "Después" with no check: the past EVA and biology are not next', () => {
    const view = buildHomeView(input({ now: at(13, 30), lastCheckToday: null }));

    expect(view.next).toEqual([EXERCISE]);
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
  it('keeps the daily check-in current at 19:00 while no check is saved, with no next items', () => {
    const view = buildHomeView(input({ now: at(19, 0) }));

    expect(view.now).toMatchObject({ itemId: 'daily-checkin' });
    expect(view.next).toEqual([]);
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

describe('buildHomeView status from the latest earlier check (D56)', () => {
  // The 14 seeded days, newest first, as Home passes them.
  const SEEDED = buildSeedHistory(DEMO_SCENARIOS.normal, { now: at(9, 20) }).reverse();

  it('shows yesterday\'s simulated check with its rows when there is none today', () => {
    const view = buildHomeView(input({ now: at(9, 20), lastCheckToday: null, previousChecks: SEEDED }));

    expect(view.status.source).toBe('previous');
    expect(view.status.when).toEqual({ kind: 'yesterday' });
    expect(view.status.simulated).toBe(true);
    expect(view.status.verdict).toBe(SEEDED[0].verdict);
    expect(view.status.readings.length).toBe(Object.keys(SEEDED[0].readings).length);
    // Level history is the 13 checks before it, but "tu normal" counts yesterday as day 14.
    expect(view.status.readings.every((reading) => reading.baseline.ready)).toBe(true);
  });

  it('gives a calendar date when the latest check is older than yesterday', () => {
    const view = buildHomeView(input({ now: at(9, 20), previousChecks: SEEDED.slice(2) }));

    expect(view.status.when).toEqual({ kind: 'date', date: '2026-11-12' });
  });

  it('keeps the daily check-in pending: an earlier check never completes it (D13)', () => {
    const view = buildHomeView(input({ now: at(9, 20), previousChecks: SEEDED }));

    expect(view.now).toMatchObject({ itemId: 'daily-checkin' });
    expect(view.now?.progress).toEqual({ done: 0, total: 5 });
    expect(view.pendingToday).toBe(5);
  });

  it('uses today\'s check, not the earlier one, when it exists', () => {
    const view = buildHomeView(input({ lastCheckToday: CHECK_TODAY, previousChecks: SEEDED }));

    expect(view.status.source).toBe('today');
    expect(view.status.when).toBeNull();
    expect(view.status.simulated).toBe(false);
    expect(view.status.verdict).toBe('ok');
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

  it('copies one row per reading with its value, level, reason and team criterion from the record', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: ATTENTION_CHECK }));

    expect(view.status.readings).toHaveLength(SENSOR_KEYS.length);
    for (const sensor of SENSOR_KEYS) {
      const source = ATTENTION_CHECK.readings[sensor];
      if (source === undefined) throw new Error(`fixture has no reading for ${sensor}`);
      expect(view.status.readings).toContainEqual(
        expect.objectContaining({
          sensor,
          value: source.value,
          level: source.level,
          reason: source.reason,
          teamCriterion: false,
        }),
      );
    }
  });

  it('keeps the sleep reading amber with reason sleep_hours', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: ATTENTION_CHECK }));

    expect(view.status.readings).toContainEqual(
      expect.objectContaining({
        sensor: 'sleep',
        value: '5 h',
        level: 'amber',
        reason: 'sleep_hours',
        teamCriterion: false,
      }),
    );
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

describe('buildHomeView metric rows with range bars (T091, CA4)', () => {
  const DEVICE_AT = CHECK_SAVED_AT;

  /** A reading with no level problem: green, confirmed, no criterion. */
  function greenReading(sensor: SensorKey, value: string) {
    return { sensor, level: 'green', phase: 'confirmed', value, outsideNormal: false, teamCriterion: false, reason: null };
  }

  /** Readings of the full CA4 check (sleep 5 h amber, everything else green), shaped as the evaluation stores them. */
  function ca4Readings() {
    return {
      sleep: { sensor: 'sleep', level: 'amber', phase: 'confirmed', value: '5 h', outsideNormal: false, teamCriterion: false, reason: 'sleep_hours' },
      pulse: greenReading('pulse', '72 lpm'),
      pressure: greenReading('pressure', '118/76 mmHg'),
      temperature: greenReading('temperature', '36,8 °C'),
      oxygen: greenReading('oxygen', '98 %'),
    };
  }

  /** The CA4 check with every observation the rows need, values formatted by the app (formatReadingValue). */
  function ca4Check(): CheckRecord {
    const observations = [
      { indicator: 'sleep_hours', value: 5, source: 'voice', confirmed: true, simulated: false, at: DEVICE_AT },
      { indicator: 'mood', value: 4, source: 'voice', confirmed: true, simulated: false, at: DEVICE_AT },
      { indicator: 'blood_pressure', value: { systolic: 118, diastolic: 76 }, source: 'device', confirmed: true, simulated: true, at: DEVICE_AT },
      { indicator: 'resting_heart_rate', value: 72, source: 'device', confirmed: true, simulated: true, at: DEVICE_AT },
      { indicator: 'oxygen_saturation', value: 98, source: 'device', confirmed: true, simulated: true, at: DEVICE_AT },
      { indicator: 'body_temperature', value: 36.8, source: 'device', confirmed: true, simulated: true, at: DEVICE_AT },
    ];
    return CheckRecord.parse({
      id: CHECK_SAVED_AT,
      observations,
      symptoms: ['none'],
      readings: ca4Readings(),
      verdict: 'attention',
      actionKey: 'action.slept_little',
      simulated: false,
    });
  }

  const CA4 = ca4Check();

  /** The row of one sensor from the view, or a failure when it is missing. */
  function rowOf(view: ReturnType<typeof buildHomeView>, sensor: SensorKey) {
    const row = view.status.readings.find((reading) => reading.sensor === sensor);
    if (row === undefined) throw new Error(`no row for ${sensor}`);
    return row;
  }

  it('gives the sleep row 5 h as its value and marker, on the 0–10 h scale, amber', () => {
    const row = rowOf(buildHomeView(input({ now: at(9, 35), lastCheckToday: CA4 })), 'sleep');

    expect(row).toMatchObject({ value: '5 h', unit: 'h', marker: 5, scale: [0, 10], level: 'amber' });
  });

  it('gives the sleep row the allowed label "≥ 7 h" from the sleep threshold', () => {
    const row = rowOf(buildHomeView(input({ now: at(9, 35), lastCheckToday: CA4 })), 'sleep');

    expect(row.allowedLabel).toBe('≥ 7 h');
  });

  it('gives the blood pressure row its systolic value as marker: 118 on 90–160 mmHg', () => {
    const row = rowOf(buildHomeView(input({ now: at(9, 35), lastCheckToday: CA4 })), 'pressure');

    expect(row).toMatchObject({ value: '118/76 mmHg', unit: 'mmHg', marker: 118, scale: [90, 160], level: 'green' });
  });

  it('places the 118 mmHg marker at 40 % of 90–160 through computeRangeBar (SC-013)', () => {
    const row = rowOf(buildHomeView(input({ now: at(9, 35), lastCheckToday: CA4 })), 'pressure');
    const layout = computeRangeBar({ sensor: 'pressure', value: row.marker, baseline: row.baseline, scale: row.scale });

    expect(layout.markerPct).toBeCloseTo(40);
  });

  it('gives the blood pressure allowed label "< 120/80" from the systolic and diastolic green bands', () => {
    const row = rowOf(buildHomeView(input({ now: at(9, 35), lastCheckToday: CA4 })), 'pressure');

    expect(row.allowedLabel).toBe('< 120/80');
  });

  it('gives pulse, temperature and oxygen their markers, units and allowed labels', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: CA4 }));

    expect(rowOf(view, 'pulse')).toMatchObject({ marker: 72, unit: 'lpm', scale: [40, 130], allowedLabel: '60–100' });
    expect(rowOf(view, 'temperature')).toMatchObject({ marker: 36.8, unit: '°C', scale: [35, 39], allowedLabel: '36,1–37,2' });
    expect(rowOf(view, 'oxygen')).toMatchObject({ marker: 98, unit: '%', scale: [85, 100], allowedLabel: '≥ 95' });
  });

  it('takes the source and the simulated flag from the observation of each sensor', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: CA4 }));

    expect(rowOf(view, 'sleep')).toMatchObject({ source: 'voice', simulated: false });
    expect(rowOf(view, 'pressure')).toMatchObject({ source: 'device', simulated: true });
  });

  it('keeps the rows in sensor order and adds no row for a sensor with no reading', () => {
    const withoutPressure = Object.fromEntries(
      Object.entries(ca4Readings()).filter(([sensor]) => sensor !== 'pressure'),
    );
    const check = CheckRecord.parse({ ...CA4, readings: withoutPressure });
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: check }));

    expect(view.status.readings.map((reading) => reading.sensor)).toEqual(['sleep', 'pulse', 'temperature', 'oxygen']);
  });

  it('shows the same blood pressure text as the check: formatReadingValue of the observation', () => {
    const bloodPressure = CA4.observations.find((observation) => observation.indicator === 'blood_pressure');
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: CA4 }));

    expect(rowOf(view, 'pressure').value).toBe(formatReadingValue('blood_pressure', bloodPressure));
  });

  it('marks the baseline not ready on the first 13 days (CL3)', () => {
    const previous = Array.from({ length: 13 }, (_, index) => dayCheck(14 - index, 62));
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: CA4, previousChecks: previous }));

    expect(rowOf(view, 'pulse').baseline.ready).toBe(false);
  });

  it('computes the pulse baseline from 14 previous days, floored at MIN_SD (RN3)', () => {
    const previous = Array.from({ length: 14 }, (_, index) => dayCheck(14 - index, 62));
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: CA4, previousChecks: previous }));

    expect(rowOf(view, 'pulse').baseline).toEqual({
      indicator: 'resting_heart_rate',
      mean: 62,
      sd: MIN_SD.resting_heart_rate,
      ready: true,
    });
  });
});

/** A check of the given local day with a pulse of `pulse` and green readings (history for "tu normal"). */
function dayCheck(day: number, pulse: number): CheckRecord {
  const savedAt = new Date(2026, 10, day, 9, 31).toISOString();
  const readings = Object.fromEntries(
    SENSOR_KEYS.map((sensor) => [
      sensor,
      { sensor, level: 'green', phase: 'confirmed', value: '—', outsideNormal: false, teamCriterion: false, reason: null },
    ]),
  );
  return CheckRecord.parse({
    id: savedAt,
    observations: [
      { indicator: 'resting_heart_rate', value: pulse, source: 'device', confirmed: true, simulated: true, at: savedAt },
    ],
    symptoms: ['none'],
    readings,
    verdict: 'ok',
    actionKey: '',
    simulated: true,
  });
}

describe('buildHomeView mood badge follows the sleep reading when the mood set it (CL4)', () => {
  /** A check with a confirmed voice mood of 4 and a sleep reading whose level was set by `reason`. */
  function moodInDoubtCheck(level: 'in_doubt' | 'green', reason: 'mood' | null): CheckRecord {
    const readings: Record<string, object> = Object.fromEntries(
      SENSOR_KEYS.map((sensor) => [
        sensor,
        { sensor, level: 'green', phase: 'confirmed', value: '—', outsideNormal: false, teamCriterion: false, reason: null },
      ]),
    );
    readings.sleep = { sensor: 'sleep', level, phase: 'in_doubt', value: '7 h', outsideNormal: false, teamCriterion: false, reason };
    return CheckRecord.parse({
      id: CHECK_SAVED_AT,
      observations: [{ indicator: 'mood', value: 4, source: 'voice', confirmed: true, simulated: false, at: CHECK_SAVED_AT }],
      symptoms: ['none'],
      readings,
      verdict: 'attention',
      actionKey: 'action.in_doubt',
      simulated: false,
    });
  }

  it('shows the mood badge in doubt when the mood put the sleep reading in doubt', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: moodInDoubtCheck('in_doubt', 'mood') }));

    expect(view.status.mood).toMatchObject({ value: 4, level: 'in_doubt', teamCriterion: true });
  });

  it('keeps the rule-based mood level when the sleep reading was not set by the mood', () => {
    const view = buildHomeView(input({ now: at(9, 35), lastCheckToday: moodInDoubtCheck('green', null) }));

    expect(view.status.mood).toMatchObject({ value: 4, level: 'green' });
  });
});
