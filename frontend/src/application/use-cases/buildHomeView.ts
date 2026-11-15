/**
 * Home view model (T053, T072, T091, research R17). Pure: no I/O, no globals. The clock, agenda, last
 * check of today, connectivity and mission profile are all passed in by the caller.
 * `status` shows today's check; with none today it shows the latest earlier check (`source:
 * 'previous'`, D56), and is empty (verdict 'none') only when no record exists at all. Its readings
 * are the metric rows of `metricReadings.ts`.
 */
import { MOOD_MAX, type AgendaItem, type CheckRecord, type Level, type Verdict } from '@base-vital/contracts';
import { historyValues, levelFor } from '@base-vital/health-rules';
import { NEXT_MAX } from '../../config/constants';
import { lightPhase, missionDay } from '../../domain/mission/missionClock';
import type { LightPhase } from '../../domain/mission/missionClock';
import { metricReadingsOf, type StatusReading } from './metricReadings';

export type { StatusReading } from './metricReadings';

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

/** When a previous check was made: the day before `now`, or its local calendar date (`YYYY-MM-DD`). */
export type StatusWhen = { kind: 'yesterday' } | { kind: 'date'; date: string };

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
    /** `'previous'` when the status shows the latest earlier check because there is none today (D56). */
    source: 'today' | 'previous';
    /** When the shown check was made; null for today's check or when there is no record. */
    when: StatusWhen | null;
    /** The shown check is simulated (seeded history). */
    simulated: boolean;
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

/**
 * Level of the mood badge. The sleep reading carries the mood when the mood set its level (for
 * example "in doubt" after CL4, reason `mood`): Home then shows that reading's level, so the
 * badge and the sensor agree. Otherwise the level comes from the mood rules (RN2).
 */
function moodLevelOf(record: CheckRecord, moodValue: number, previousChecks: readonly CheckRecord[]): Level {
  const sleepReading = record.readings.sleep;
  if (sleepReading !== undefined && sleepReading.reason === 'mood') return sleepReading.level;
  return levelFor('mood', moodValue, { history: historyValues(previousChecks, 'mood') }).level;
}

/** Local `YYYY-MM-DD` of `date`. */
function localDay(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(CLOCK_FIELD_WIDTH, '0');
  const dd = String(date.getDate()).padStart(CLOCK_FIELD_WIDTH, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** "Yesterday" when the record's local day is the day before `now`'s, else its local date. */
function whenOf(record: CheckRecord, now: Date): StatusWhen {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const day = localDay(new Date(record.id));
  return day === localDay(yesterday) ? { kind: 'yesterday' } : { kind: 'date', date: day };
}

/**
 * Status of Home from `record`; empty (verdict 'none') when there is none. `previousChecks` are the
 * checks before `record`, newest first (baseline and consecutive-day rules). `earlierAt` is the
 * clock's now when `record` is an earlier day's check, else null.
 */
function statusFrom(
  record: CheckRecord | null,
  previousChecks: readonly CheckRecord[],
  earlierAt: Date | null,
  baselineChecks: readonly CheckRecord[] = previousChecks,
): HomeView['status'] {
  if (record === null) {
    return { verdict: 'none', mood: null, readings: [], focus: null, source: 'today', when: null, simulated: false };
  }
  const moodValue = confirmedVoiceMood(record);
  const mood: StatusMood | null =
    moodValue === null
      ? null
      : {
          value: moodValue,
          of: MOOD_MAX,
          level: moodLevelOf(record, moodValue, previousChecks),
          teamCriterion: true,
        };
  const readings = metricReadingsOf({
    readings: Object.values(record.readings),
    observations: record.observations,
    previousChecks: baselineChecks,
  });
  return {
    verdict: record.verdict,
    mood,
    readings,
    focus: null,
    source: earlierAt === null ? 'today' : 'previous',
    when: earlierAt === null ? null : whenOf(record, earlierAt),
    simulated: record.simulated,
  };
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
 * Today's check when there is one; else the latest earlier check, judged against the checks before
 * it (D56). The agenda ignores the earlier check: only today's real check completes the check-in (D13).
 */
function statusOf(input: HomeViewInput): HomeView['status'] {
  if (input.lastCheckToday !== null) return statusFrom(input.lastCheckToday, input.previousChecks, null);
  const [latest] = input.previousChecks;
  if (latest === undefined) return statusFrom(null, [], null);
  const before = input.previousChecks.filter((record) => record.id < latest.id);
  // Level and verdict history = the checks before `latest`; the "tu normal" band uses all the
  // previous checks, `latest` included, so yesterday is day 14 of the baseline (D56).
  return statusFrom(latest, before, input.now, input.previousChecks);
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
  const nowHHmm = formatHHmm(input.now);
  const found = currentIndex(pending, nowHHmm);
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
    // "Después" lists only upcoming items: a past item that is still not done is pending, not next.
    next: pending
      .slice(index + 1)
      .filter((item) => item.time >= nowHHmm)
      .slice(0, NEXT_MAX),
    pendingToday: pending.length,
    status: statusOf(input),
  };
}
