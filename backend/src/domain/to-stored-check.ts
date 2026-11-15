import { INDICATOR_UNITS, MS_PER_DAY } from '../config/constants';
import type { AlertToOpen, CheckToStore, ObservationToStore, Urgency } from './stored-check';
import type { SyncCheck } from './sync-check';
import type { Verdict } from '../shared/contracts';

/** Urgency opened for each verdict; `ok` opens no alert (R9). */
const URGENCY_BY_VERDICT: Record<Verdict, Urgency | null> = {
  alert: 'now',
  attention: 'soon',
  ok: null,
};

/** Empty action key on the wire means "no action" and is stored as `null`. */
const NO_ACTION_KEY = '';

type WireObservation = SyncCheck['check']['observations'][number];

function toObservationToStore(observation: WireObservation): ObservationToStore {
  const base = {
    indicator: observation.indicator,
    unit: INDICATOR_UNITS[observation.indicator],
    source: observation.source,
    confirmed: observation.confirmed,
    simulated: observation.simulated,
    capturedAt: observation.at,
  };
  if (observation.indicator === 'blood_pressure') {
    return {
      ...base,
      numeric: null,
      systolic: observation.value.systolic,
      diastolic: observation.value.diastolic,
    };
  }
  return { ...base, numeric: observation.value, systolic: null, diastolic: null };
}

/**
 * `missionStartDate` = UTC calendar date of `completedAt` minus `missionDay - 1` days, as `YYYY-MM-DD`.
 */
function missionStartDateOf(completedAt: string, missionDay: number): string {
  const completed = new Date(completedAt);
  const completedDayStartMs = Date.UTC(
    completed.getUTCFullYear(),
    completed.getUTCMonth(),
    completed.getUTCDate(),
  );
  const startMs = completedDayStartMs - (missionDay - 1) * MS_PER_DAY;
  return new Date(startMs).toISOString().split('T')[0] ?? '';
}

/** Pure mapping from the validated wire envelope to what the check repository stores. */
export function toStoredCheck(input: SyncCheck): { check: CheckToStore; alert: AlertToOpen | null } {
  const { check } = input;
  const urgency = URGENCY_BY_VERDICT[check.verdict];
  const completedAt = check.id;

  return {
    check: {
      clientCheckId: input.clientCheckId,
      crewId: input.crewId,
      kind: input.kind,
      missionDay: input.missionDay,
      missionStartDate: missionStartDateOf(completedAt, input.missionDay),
      verdict: check.verdict,
      actionKey: check.actionKey === NO_ACTION_KEY ? null : check.actionKey,
      symptoms: check.symptoms,
      simulated: check.simulated,
      readings: check.readings,
      completedAt,
      observations: check.observations.map(toObservationToStore),
    },
    alert: urgency === null ? null : { urgency },
  };
}
