import type { CheckRecord, Indicator, Source, Symptom, Verdict } from '../../shared/contracts';
import type { AlertToOpen, CheckToStore, Urgency } from '../../domain/stored-check';

/** Injection token for the check repository (bound in `app.module.ts`). */
export const CHECK_REPOSITORY = Symbol('CHECK_REPOSITORY');

/** Decision a surgeon takes on an open alert. */
export type AlertDecision = 'manage_on_base' | 'consult_surgeon' | 'prepare_return';

/** Result of saving a check: `duplicate` when the `clientCheckId` was already stored. */
export type SaveResult = { status: 'created' | 'duplicate'; id: string };

/** Alert as shown to the surgeon, with its decision state. */
export type AlertView = {
  id: string;
  urgency: Urgency;
  status: 'open' | 'decided';
  decision: AlertDecision | null;
  decidedAt: string | null;
};

/** One observation of a check as exposed to the surgeon (blood pressure is a pair). */
export type ObservationView = {
  indicator: Indicator;
  value: number | { systolic: number; diastolic: number };
  unit: string;
  source: Source;
  confirmed: boolean;
  simulated: boolean;
};

/** A full daily check as exposed to the surgeon API. */
export type CheckView = {
  id: string;
  missionDay: number;
  completedAt: string;
  verdict: Verdict;
  actionKey: string | null;
  symptoms: Symptom[];
  simulated: boolean;
  readings: CheckRecord['readings'];
  observations: ObservationView[];
  alert: AlertView | null;
};

/** Latest check of one crew member, as listed on the surgeon crew overview. */
export type CrewLatest = {
  crewId: string;
  missionDay: number;
  completedAt: string;
  verdict: Verdict;
  actionKey: string | null;
  simulated: boolean;
  openAlert: { id: string; urgency: Urgency } | null;
};

/** Crew member identity and the mission start date used to compute mission days. */
export type CrewInfo = {
  crewId: string;
  /** `YYYY-MM-DD`, UTC. */
  missionStartDate: string;
};

/** Open alert as listed on the surgeon alerts queue. */
export type OpenAlertView = {
  id: string;
  crewId: string;
  checkId: string;
  missionDay: number;
  verdict: Verdict;
  urgency: Urgency;
  /** ISO date-time the alert was opened. */
  createdAt: string;
};

/** Outcome of deciding an alert: `not_found` for an unknown id, `already_decided` if decided before. */
export type DecideResult =
  | { status: 'decided'; alert: AlertView }
  | { status: 'not_found' }
  | { status: 'already_decided' };

/** Persistence port for crew, checks, observations and alerts. */
export interface CheckRepository {
  /**
   * Atomic: upsert crew (first missionStartDate wins), insert check + observations + alert.
   * Duplicate clientCheckId → existing id, nothing written.
   */
  saveCheck(check: CheckToStore, alert: AlertToOpen | null): Promise<SaveResult>;

  /** Latest check per crew member (unordered; ordering is domain logic). */
  listCrewLatest(): Promise<CrewLatest[]>;

  /** Crew member by id, or `null` when unknown. */
  getCrew(crewId: string): Promise<CrewInfo | null>;

  /** Checks of a crew member with completedAt in [from, to) (ISO instants), newest first. */
  listChecks(crewId: string, from: string, to: string): Promise<CheckView[]>;

  /** Most recent check of a crew member or `null`. */
  getLatestCheck(crewId: string): Promise<CheckView | null>;

  /** Open (undecided) alerts across the crew (unordered; ordering is domain logic). */
  listOpenAlerts(): Promise<OpenAlertView[]>;

  /** Records the decision on an alert at instant `at` (ISO date-time). */
  decideAlert(id: string, decision: AlertDecision, at: string): Promise<DecideResult>;
}
