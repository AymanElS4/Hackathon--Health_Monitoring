import type {
  AlertDecision,
  AlertView,
  CheckView,
  ObservationView,
  OpenAlertView,
} from '../../application/ports/check-repository.port';
import type { Urgency } from '../../domain/stored-check';
import type { CheckRecord, Indicator, Source, Symptom, Verdict } from '../../shared/contracts';

/** Pattern of a canonical UUID; non-UUID ids are rejected before they reach a uuid column. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `check_records` row as selected by the read methods. */
export type CheckRow = {
  id: string;
  crew_id: string;
  mission_day: number;
  completed_at: Date;
  verdict: Verdict;
  action_key: string | null;
  symptoms: string[];
  simulated: boolean;
  readings: CheckRecord['readings'];
};

/** `observations` row; numeric columns come back from pg as strings or numbers. */
export type ObservationRow = {
  check_id: string;
  indicator: Indicator;
  value_numeric: string | null;
  value_systolic: number | null;
  value_diastolic: number | null;
  unit: string;
  source: Source;
  confirmed: boolean;
  simulated: boolean;
};

/** `alerts` row as selected for the alert views. */
export type AlertRow = {
  id: string;
  check_id: string;
  urgency: Urgency;
  status: 'open' | 'decided';
  decision: AlertDecision | null;
  decided_at: Date | null;
};

/** Open alert joined with its check, as listed on the surgeon alerts queue. */
export type OpenAlertRow = {
  id: string;
  crew_id: string;
  check_id: string;
  mission_day: number;
  verdict: Verdict;
  urgency: Urgency;
  created_at: Date;
};

/** Formats a pg timestamp as an ISO date-time string. */
export function toIso(value: Date): string {
  return value.toISOString();
}

/** Maps an observation row to the surgeon view (blood pressure is a pair). */
export function mapObservation(row: ObservationRow): ObservationView {
  const base = {
    indicator: row.indicator,
    unit: row.unit,
    source: row.source,
    confirmed: row.confirmed,
    simulated: row.simulated,
  };
  if (row.value_systolic !== null && row.value_diastolic !== null) {
    return {
      ...base,
      value: { systolic: Number(row.value_systolic), diastolic: Number(row.value_diastolic) },
    };
  }
  if (row.value_numeric === null) {
    throw new Error(`observation ${row.indicator} has no value`);
  }
  return { ...base, value: Number(row.value_numeric) };
}

/** Maps an alert row to the surgeon view. */
export function mapAlert(row: AlertRow): AlertView {
  return {
    id: row.id,
    urgency: row.urgency,
    status: row.status,
    decision: row.decision,
    decidedAt: row.decided_at ? toIso(row.decided_at) : null,
  };
}

/** Assembles a full check view from its row, observations and alert. */
export function mapCheck(
  row: CheckRow,
  observations: ObservationView[],
  alert: AlertView | null,
): CheckView {
  return {
    id: row.id,
    missionDay: row.mission_day,
    completedAt: toIso(row.completed_at),
    verdict: row.verdict,
    actionKey: row.action_key,
    symptoms: [...row.symptoms] as Symptom[],
    simulated: row.simulated,
    readings: row.readings,
    observations,
    alert,
  };
}

/** Maps an open-alert row to the queue view. */
export function mapOpenAlert(row: OpenAlertRow): OpenAlertView {
  return {
    id: row.id,
    crewId: row.crew_id,
    checkId: row.check_id,
    missionDay: row.mission_day,
    verdict: row.verdict,
    urgency: row.urgency,
    createdAt: toIso(row.created_at),
  };
}
