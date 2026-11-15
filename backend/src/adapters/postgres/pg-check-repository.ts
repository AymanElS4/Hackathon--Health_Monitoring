import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
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
import type { AlertToOpen, CheckToStore, Urgency } from '../../domain/stored-check';
import type { Verdict } from '../../shared/contracts';
import { PG_POOL } from './pool';
import {
  type AlertRow,
  type CheckRow,
  mapAlert,
  mapCheck,
  mapObservation,
  mapOpenAlert,
  type ObservationRow,
  toIso,
  type OpenAlertRow,
  UUID_PATTERN,
} from './rows';

const CHECK_COLUMNS = `id, crew_id, mission_day, completed_at, verdict, action_key, symptoms, simulated, readings`;
const ALERT_COLUMNS = `id, check_id, urgency, status, decision, decided_at`;
const OBSERVATION_COLUMNS = `check_id, indicator, value_numeric, value_systolic, value_diastolic, unit, source, confirmed, simulated`;

/** Latest check of a crew member with its open alert (if any), from the crew overview query. */
type CrewLatestRow = {
  crew_id: string;
  mission_day: number;
  completed_at: Date;
  verdict: Verdict;
  action_key: string | null;
  simulated: boolean;
  alert_id: string | null;
  alert_urgency: Urgency | null;
};

/** Postgres implementation of `CheckRepository`. Every value goes through `$n` parameters. */
@Injectable()
export class PgCheckRepository implements CheckRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async saveCheck(check: CheckToStore, alert: AlertToOpen | null): Promise<SaveResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO crew_members (id, mission_start_date) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [check.crewId, check.missionStartDate],
      );
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO check_records
           (client_check_id, crew_id, kind, mission_day, verdict, action_key, symptoms, simulated, readings, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9::jsonb, $10)
         ON CONFLICT (client_check_id) DO NOTHING
         RETURNING id`,
        [
          check.clientCheckId,
          check.crewId,
          check.kind,
          check.missionDay,
          check.verdict,
          check.actionKey,
          check.symptoms,
          check.simulated,
          JSON.stringify(check.readings),
          check.completedAt,
        ],
      );
      const checkId = inserted.rows[0]?.id;
      if (!checkId) {
        await client.query('ROLLBACK');
        return { status: 'duplicate', id: await this.findCheckId(client, check.clientCheckId) };
      }

      for (const observation of check.observations) {
        await client.query(
          `INSERT INTO observations
             (check_id, indicator, value_numeric, value_systolic, value_diastolic, unit, source, confirmed, simulated, captured_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            checkId,
            observation.indicator,
            observation.numeric,
            observation.systolic,
            observation.diastolic,
            observation.unit,
            observation.source,
            observation.confirmed,
            observation.simulated,
            observation.capturedAt,
          ],
        );
      }
      if (alert) {
        await client.query(
          'INSERT INTO alerts (crew_id, check_id, urgency) VALUES ($1, $2, $3)',
          [check.crewId, checkId, alert.urgency],
        );
      }
      await client.query('COMMIT');
      return { status: 'created', id: checkId };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listCrewLatest(): Promise<CrewLatest[]> {
    const result = await this.pool.query<CrewLatestRow>(
      `SELECT DISTINCT ON (c.crew_id)
              c.crew_id, c.mission_day, c.completed_at, c.verdict, c.action_key, c.simulated,
              a.id AS alert_id, a.urgency AS alert_urgency
         FROM check_records c
         LEFT JOIN alerts a ON a.check_id = c.id AND a.status = 'open'
        ORDER BY c.crew_id, c.completed_at DESC, c.received_at, c.id`,
    );
    return result.rows.map((row) => ({
      crewId: row.crew_id,
      missionDay: row.mission_day,
      completedAt: toIso(row.completed_at),
      verdict: row.verdict,
      actionKey: row.action_key,
      simulated: row.simulated,
      openAlert:
        row.alert_id && row.alert_urgency ? { id: row.alert_id, urgency: row.alert_urgency } : null,
    }));
  }

  async getCrew(crewId: string): Promise<CrewInfo | null> {
    const result = await this.pool.query<{ crew_id: string; mission_start_date: string }>(
      'SELECT id AS crew_id, mission_start_date::text AS mission_start_date FROM crew_members WHERE id = $1',
      [crewId],
    );
    const row = result.rows[0];
    return row ? { crewId: row.crew_id, missionStartDate: row.mission_start_date } : null;
  }

  async listChecks(crewId: string, from: string, to: string): Promise<CheckView[]> {
    const result = await this.pool.query<CheckRow>(
      `SELECT ${CHECK_COLUMNS} FROM check_records
        WHERE crew_id = $1 AND completed_at >= $2 AND completed_at < $3
        ORDER BY completed_at DESC, id`,
      [crewId, from, to],
    );
    return this.loadViews(result.rows);
  }

  async getLatestCheck(crewId: string): Promise<CheckView | null> {
    const result = await this.pool.query<CheckRow>(
      `SELECT ${CHECK_COLUMNS} FROM check_records
        WHERE crew_id = $1
        ORDER BY completed_at DESC, id
        LIMIT 1`,
      [crewId],
    );
    const views = await this.loadViews(result.rows);
    return views[0] ?? null;
  }

  async listOpenAlerts(): Promise<OpenAlertView[]> {
    const result = await this.pool.query<OpenAlertRow>(
      `SELECT a.id, a.crew_id, a.check_id, c.mission_day, c.verdict, a.urgency, a.created_at
         FROM alerts a
         JOIN check_records c ON c.id = a.check_id
        WHERE a.status = 'open'
        ORDER BY a.created_at, a.id`,
    );
    return result.rows.map(mapOpenAlert);
  }

  async decideAlert(id: string, decision: AlertDecision, at: string): Promise<DecideResult> {
    if (!UUID_PATTERN.test(id)) {
      return { status: 'not_found' };
    }
    const updated = await this.pool.query<AlertRow>(
      `UPDATE alerts SET status = 'decided', decision = $2, decided_at = $3
        WHERE id = $1 AND status = 'open'
        RETURNING ${ALERT_COLUMNS}`,
      [id, decision, at],
    );
    const row = updated.rows[0];
    if (row) {
      return { status: 'decided', alert: mapAlert(row) };
    }
    const existing = await this.pool.query('SELECT 1 FROM alerts WHERE id = $1', [id]);
    return existing.rowCount ? { status: 'already_decided' } : { status: 'not_found' };
  }

  /** Looks up the id of a stored check by its client idempotency key. */
  private async findCheckId(client: PoolClient, clientCheckId: string): Promise<string> {
    const result = await client.query<{ id: string }>(
      'SELECT id FROM check_records WHERE client_check_id = $1',
      [clientCheckId],
    );
    const id = result.rows[0]?.id;
    if (!id) {
      throw new Error(`check ${clientCheckId} reported as duplicate but not found`);
    }
    return id;
  }

  /** Loads observations and alerts for the given check rows (two queries, regardless of count). */
  private async loadViews(rows: CheckRow[]): Promise<CheckView[]> {
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.id);
    const observationRows = await this.pool.query<ObservationRow>(
      `SELECT ${OBSERVATION_COLUMNS} FROM observations WHERE check_id = ANY($1::uuid[]) ORDER BY id`,
      [ids],
    );
    const alertRows = await this.pool.query<AlertRow>(
      `SELECT ${ALERT_COLUMNS} FROM alerts WHERE check_id = ANY($1::uuid[])`,
      [ids],
    );

    const observationsByCheck = new Map<string, ObservationView[]>();
    for (const row of observationRows.rows) {
      const list = observationsByCheck.get(row.check_id) ?? [];
      list.push(mapObservation(row));
      observationsByCheck.set(row.check_id, list);
    }
    const alertByCheck = new Map<string, AlertView>();
    for (const row of alertRows.rows) {
      alertByCheck.set(row.check_id, mapAlert(row));
    }

    return rows.map((row) =>
      mapCheck(row, observationsByCheck.get(row.id) ?? [], alertByCheck.get(row.id) ?? null),
    );
  }
}
