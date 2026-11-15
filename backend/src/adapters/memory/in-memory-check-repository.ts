import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  AlertDecision,
  AlertView,
  CheckRepository,
  CheckView,
  CrewInfo,
  CrewLatest,
  DecideResult,
  ObservationView,
  OpenAlertView,
  SaveResult,
} from '../../application/ports/check-repository.port';
import type { AlertToOpen, CheckToStore, ObservationToStore, Urgency } from '../../domain/stored-check';
import type { CheckRecord, Symptom, Verdict } from '../../shared/contracts';

/** Scale of the `numeric(6,2)` column: two decimal places. */
const DECIMAL_SCALE = 100;

/** Stored alert row, kept with the fields needed by the open-alerts queue. */
type AlertRow = {
  id: string;
  checkId: string;
  crewId: string;
  missionDay: number;
  verdict: Verdict;
  urgency: Urgency;
  status: 'open' | 'decided';
  decision: AlertDecision | null;
  decidedAt: string | null;
  createdAt: string;
};

/** Stored check row; `alertId` points into the alerts map. */
type CheckRow = {
  id: string;
  clientCheckId: string;
  crewId: string;
  missionDay: number;
  completedAt: string;
  verdict: Verdict;
  actionKey: string | null;
  symptoms: Symptom[];
  simulated: boolean;
  readings: CheckRecord['readings'];
  observations: ObservationView[];
  alertId: string | null;
};

/** Crew row; the first `missionStartDate` seen is kept. */
type CrewRow = CrewInfo;

/** Maps a stored observation to the surgeon-facing view (blood pressure is a pair). */
function toObservationView(observation: ObservationToStore): ObservationView {
  const base = {
    indicator: observation.indicator,
    unit: observation.unit,
    source: observation.source,
    confirmed: observation.confirmed,
    simulated: observation.simulated,
  };
  if (observation.systolic !== null && observation.diastolic !== null) {
    return { ...base, value: { systolic: observation.systolic, diastolic: observation.diastolic } };
  }
  if (observation.numeric === null) {
    throw new Error(`observation ${observation.indicator} has no value`);
  }
  // Mirrors the numeric(6,2) column: values are rounded to two decimals.
  return { ...base, value: Math.round(observation.numeric * DECIMAL_SCALE) / DECIMAL_SCALE };
}

/**
 * In-memory `CheckRepository` for unit and e2e tests. Every read and write returns a deep copy,
 * so callers cannot mutate internal state.
 */
@Injectable()
export class InMemoryCheckRepository implements CheckRepository {
  /** Clock used for alert `createdAt`; tests replace it to get fixed instants. */
  now: () => string = () => new Date().toISOString();

  private readonly crews = new Map<string, CrewRow>();
  private readonly checks = new Map<string, CheckRow>();
  private readonly alerts = new Map<string, AlertRow>();

  async saveCheck(check: CheckToStore, alert: AlertToOpen | null): Promise<SaveResult> {
    const existing = [...this.checks.values()].find((row) => row.clientCheckId === check.clientCheckId);
    if (existing) {
      return structuredClone({ status: 'duplicate', id: existing.id });
    }

    if (!this.crews.has(check.crewId)) {
      this.crews.set(check.crewId, {
        crewId: check.crewId,
        missionStartDate: check.missionStartDate,
      });
    }

    const checkId = randomUUID();
    let alertId: string | null = null;
    if (alert) {
      alertId = randomUUID();
      this.alerts.set(alertId, {
        id: alertId,
        checkId,
        crewId: check.crewId,
        missionDay: check.missionDay,
        verdict: check.verdict,
        urgency: alert.urgency,
        status: 'open',
        decision: null,
        decidedAt: null,
        createdAt: this.now(),
      });
    }

    this.checks.set(checkId, {
      id: checkId,
      clientCheckId: check.clientCheckId,
      crewId: check.crewId,
      missionDay: check.missionDay,
      // Normalized like the timestamptz column, so both adapters return the same string form.
      completedAt: new Date(check.completedAt).toISOString(),
      verdict: check.verdict,
      actionKey: check.actionKey,
      symptoms: [...check.symptoms],
      simulated: check.simulated,
      readings: structuredClone(check.readings),
      observations: check.observations.map(toObservationView),
      alertId,
    });

    return { status: 'created', id: checkId };
  }

  async listCrewLatest(): Promise<CrewLatest[]> {
    const latestByCrew = new Map<string, CheckRow>();
    for (const row of this.checks.values()) {
      const current = latestByCrew.get(row.crewId);
      if (!current || Date.parse(row.completedAt) > Date.parse(current.completedAt)) {
        latestByCrew.set(row.crewId, row);
      }
    }

    const result: CrewLatest[] = [];
    for (const row of latestByCrew.values()) {
      const alert = row.alertId ? this.alerts.get(row.alertId) : undefined;
      result.push({
        crewId: row.crewId,
        missionDay: row.missionDay,
        completedAt: row.completedAt,
        verdict: row.verdict,
        actionKey: row.actionKey,
        simulated: row.simulated,
        openAlert: alert && alert.status === 'open' ? { id: alert.id, urgency: alert.urgency } : null,
      });
    }
    return structuredClone(result);
  }

  async getCrew(crewId: string): Promise<CrewInfo | null> {
    const crew = this.crews.get(crewId);
    return crew ? structuredClone(crew) : null;
  }

  async listChecks(crewId: string, from: string, to: string): Promise<CheckView[]> {
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    const rows = [...this.checks.values()]
      .filter((row) => {
        const completedMs = Date.parse(row.completedAt);
        return row.crewId === crewId && completedMs >= fromMs && completedMs < toMs;
      })
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
    return structuredClone(rows.map((row) => this.toCheckView(row)));
  }

  async getLatestCheck(crewId: string): Promise<CheckView | null> {
    let latest: CheckRow | null = null;
    for (const row of this.checks.values()) {
      if (row.crewId !== crewId) continue;
      if (!latest || Date.parse(row.completedAt) > Date.parse(latest.completedAt)) {
        latest = row;
      }
    }
    return latest ? structuredClone(this.toCheckView(latest)) : null;
  }

  async listOpenAlerts(): Promise<OpenAlertView[]> {
    const open: OpenAlertView[] = [];
    for (const alert of this.alerts.values()) {
      if (alert.status !== 'open') continue;
      open.push({
        id: alert.id,
        crewId: alert.crewId,
        checkId: alert.checkId,
        missionDay: alert.missionDay,
        verdict: alert.verdict,
        urgency: alert.urgency,
        createdAt: alert.createdAt,
      });
    }
    return structuredClone(open);
  }

  async decideAlert(id: string, decision: AlertDecision, at: string): Promise<DecideResult> {
    const alert = this.alerts.get(id);
    if (!alert) {
      return { status: 'not_found' };
    }
    if (alert.status === 'decided') {
      return { status: 'already_decided' };
    }
    alert.status = 'decided';
    alert.decision = decision;
    alert.decidedAt = at;
    return structuredClone({ status: 'decided', alert: this.toAlertView(alert) });
  }

  private toCheckView(row: CheckRow): CheckView {
    const alert = row.alertId ? this.alerts.get(row.alertId) : undefined;
    return {
      id: row.id,
      missionDay: row.missionDay,
      completedAt: row.completedAt,
      verdict: row.verdict,
      actionKey: row.actionKey,
      symptoms: [...row.symptoms],
      simulated: row.simulated,
      readings: row.readings,
      observations: row.observations,
      alert: alert ? this.toAlertView(alert) : null,
    };
  }

  private toAlertView(alert: AlertRow): AlertView {
    return {
      id: alert.id,
      urgency: alert.urgency,
      status: alert.status,
      decision: alert.decision,
      decidedAt: alert.decidedAt,
    };
  }
}
