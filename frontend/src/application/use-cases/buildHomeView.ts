/**
 * Home view model (T053, T072, research R17). Pure: no I/O, no globals. The clock, agenda, last
 * check of today, connectivity and mission profile are all passed in by the caller.
 * `status` is empty (verdict 'none') until a check of today exists.
 */
import {
  MOOD_MAX,
  SensorKey,
  type AgendaItem,
  type CheckRecord,
  type Indicator,
  type Level,
  type Verdict,
} from '@base-vital/contracts';
import { historyValues, levelFor } from '@base-vital/health-rules';
import { NEXT_MAX } from '../../config/constants';
import { lightPhase, missionDay } from '../../domain/mission/missionClock';
import type { LightPhase } from '../../domain/mission/missionClock';

/** Digits per clock field in `HH:mm`. */
const CLOCK_FIELD_WIDTH = 2;

export type Connectivity = 'online' | 'offline';

export interface HomeViewInput {
  now: Date;
  agenda: readonly AgendaItem[];
  lastCheckToday: CheckRecord | null;
  /** Records of the days before today, newest first; they feed the consecutive-day mood rule (RN2). */
  previousChecks: readonly CheckRecord[];
  connectivity: Connectivity;
  mission: {
    crewName: string;
    missionStartDate: string;
    avatarUrl: string;
    lightDays: number;
    darkDays: number;
    offsetDays: number;
  };
}

export interface NowItem {
  itemId: string;
  time: string;
  titleKey: string;
  durationMin?: number;
  progress: { done: number; total: number };
  action?: AgendaItem['action'];
}

/** Mood of today's confirmed voice check (RN4, 1–5). `teamCriterion` is always true (Principle VIII). */
export interface StatusMood {
  value: number;
  of: number;
  level: Level;
  teamCriterion: true;
}

/** Minimal per-sensor reading shown on Home; copied from the stored check (T091 extends it). */
export interface StatusReading {
  sensor: SensorKey;
  value: string;
  level: Level;
  reason: Indicator | null;
  teamCriterion: boolean;
}

export interface HomeView {
  header: {
    crewName: string;
    missionDay: number;
    lightPhase: LightPhase;
    connectivity: Connectivity;
    avatarUrl: string;
  };
  now: NowItem | null;
  next: AgendaItem[];
  pendingToday: number;
  status: {
    verdict: Verdict | 'none';
    mood: StatusMood | null;
    readings: StatusReading[];
    focus: null;
  };
}

/** Value of the last confirmed voice mood observation in `record`, else null. */
function confirmedVoiceMood(record: CheckRecord): number | null {
  let value: number | null = null;
  for (const observation of record.observations) {
    if (observation.indicator === 'mood' && observation.source === 'voice' && observation.confirmed) {
      value = observation.value;
    }
  }
  return value;
}

/** Status of Home from the last check of today; empty (verdict 'none') when there is none. */
function statusFrom(record: CheckRecord | null, previousChecks: readonly CheckRecord[]): HomeView['status'] {
  if (record === null) {
    return { verdict: 'none', mood: null, readings: [], focus: null };
  }
  const moodValue = confirmedVoiceMood(record);
  const mood: StatusMood | null =
    moodValue === null
      ? null
      : {
          value: moodValue,
          of: MOOD_MAX,
          level: levelFor('mood', moodValue, { history: historyValues(previousChecks, 'mood') }).level,
          teamCriterion: true,
        };
  const readings: StatusReading[] = SensorKey.options.flatMap((sensor) => {
    const reading = record.readings[sensor];
    return reading
      ? [
          {
            sensor,
            value: reading.value,
            level: reading.level,
            reason: reading.reason,
            teamCriterion: reading.teamCriterion,
          },
        ]
      : [];
  });
  return { verdict: record.verdict, mood, readings, focus: null };
}

/** Local `HH:mm` of `date`, the same format as `AgendaItem.time`. */
function formatHHmm(date: Date): string {
  const hh = String(date.getHours()).padStart(CLOCK_FIELD_WIDTH, '0');
  const mm = String(date.getMinutes()).padStart(CLOCK_FIELD_WIDTH, '0');
  return `${hh}:${mm}`;
}

/** The daily check-in is the one agenda item whose action starts a check. */
function isCheckinItem(item: AgendaItem): boolean {
  return item.action === 'start_checkin';
}

/**
 * An agenda item is done only when it was really completed. In 001 only the daily check-in can be
 * completed (a check record saved today); every other item is never done.
 */
function isCompleted(item: AgendaItem, hasCheckToday: boolean): boolean {
  return isCheckinItem(item) && hasCheckToday;
}

/**
 * Index in `pending` (the not-done items, in agenda order) of the current item, else -1.
 * The daily check-in is current until it is saved, even after its time. Any other item is current
 * when its time is not yet past.
 */
function currentIndex(pending: readonly AgendaItem[], nowHHmm: string): number {
  return pending.findIndex((item) => isCheckinItem(item) || item.time >= nowHHmm);
}

/**
 * Builds the Home view. Agenda times are compared with the local `HH:mm` of `now`.
 * Only items really completed count as done (`progress.done`); `pendingToday` is the number of
 * items not done. "Ahora" is the first pending item that is current; "Después" follows it.
 */
export function buildHomeView(input: HomeViewInput): HomeView {
  const agenda = [...input.agenda].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const hasCheckToday = input.lastCheckToday !== null;
  const pending = agenda.filter((item) => !isCompleted(item, hasCheckToday));
  const found = currentIndex(pending, formatHHmm(input.now));
  // With no upcoming item left, the last item not done stays current.
  const index = found === -1 ? pending.length - 1 : found;

  const current = index === -1 ? null : pending[index];
  const done = agenda.length - pending.length;

  const now: NowItem | null =
    current === null
      ? null
      : {
          itemId: current.id,
          time: current.time,
          titleKey: current.titleKey,
          durationMin: current.durationMin,
          progress: { done, total: agenda.length },
          action: current.action,
        };

  const mission = input.mission;
  const [year, month, day] = mission.missionStartDate.split('-').map(Number);
  const start = new Date(year, month - 1, day);

  return {
    header: {
      crewName: mission.crewName,
      missionDay: missionDay(start, input.now),
      lightPhase: lightPhase(
        start,
        input.now,
        mission.lightDays,
        mission.darkDays,
        mission.offsetDays,
      ),
      connectivity: input.connectivity,
      avatarUrl: mission.avatarUrl,
    },
    now,
    next: pending.slice(index + 1, index + 1 + NEXT_MAX),
    pendingToday: pending.length,
    status: statusFrom(input.lastCheckToday, input.previousChecks),
  };
}
