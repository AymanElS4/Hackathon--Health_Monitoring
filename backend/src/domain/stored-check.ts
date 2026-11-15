import type { CheckRecord, Indicator, Source, Symptom, Verdict } from '../shared/contracts';

/** Urgency of an open alert: `now` is handled before `soon` (R9). */
export type Urgency = 'soon' | 'now';

/** One observation as stored: numeric indicators use `numeric`, blood pressure uses `systolic`/`diastolic`. */
export type ObservationToStore = {
  indicator: Indicator;
  numeric: number | null;
  systolic: number | null;
  diastolic: number | null;
  unit: string;
  source: Source;
  confirmed: boolean;
  simulated: boolean;
  capturedAt: string;
};

/** A daily check ready to be saved by the check repository. */
export type CheckToStore = {
  clientCheckId: string;
  crewId: string;
  kind: 'daily';
  missionDay: number;
  /** `YYYY-MM-DD`, UTC. */
  missionStartDate: string;
  verdict: Verdict;
  /** `null` for `ok`, which has no action. */
  actionKey: string | null;
  symptoms: Symptom[];
  simulated: boolean;
  readings: CheckRecord['readings'];
  /** ISO date-time of the completed check. */
  completedAt: string;
  observations: ObservationToStore[];
};

/** Alert to open together with the check; absent for `ok`. */
export type AlertToOpen = { urgency: Urgency };
