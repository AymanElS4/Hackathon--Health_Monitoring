# Data model — 004-resumen-cirujano

PostgreSQL 16, migration `backend/migrations/0001_init.sql`. Derived from
`docs/base-vital-db-schema.md` with decisions M1–M10 (spec). Removed from the draft: `devices`,
`surgeons`, `refresh_tokens` (M7), `observations.level` / `team_criterion` (M9), `button` source (M3),
`exit` kind (M8), alert status `acknowledged`, urgency `routine` and `decided_by` (no identities, M7).

## crew_members
| Column | Type | Rule |
|---|---|---|
| id | text PK | `^crew-[a-z0-9]{6}$` (FR-013) |
| mission_start_date | date | set on first check: `date(completedAt) − (missionDay − 1)` |
| created_at | timestamptz | default now() |

## check_records
| Column | Type | Rule |
|---|---|---|
| id | uuid PK | default `gen_random_uuid()` |
| client_check_id | uuid UNIQUE | idempotency key from the tablet (M4) |
| crew_id | text FK → crew_members | |
| kind | text | `IN ('daily')` (M8) |
| mission_day | integer | `>= 1` |
| verdict | text | `IN ('ok','attention','alert')` = contract `Verdict` (M1) |
| action_key | text NULL | `''` in the contract ⇔ NULL here (M2); CHECK `(verdict='ok') = (action_key IS NULL)`, non-empty when present |
| symptoms | text[] | each in contract `Symptom` (M6); default `{}` |
| simulated | boolean | (M5) |
| readings | jsonb | tablet snapshot `Record<SensorKey, SensorReading>` (M9), validated by the contract on the way in |
| completed_at | timestamptz | `CheckRecord.id` (tablet clock) |
| received_at | timestamptz | default now() |

Index: `(crew_id, completed_at DESC)`.

## observations
| Column | Type | Rule |
|---|---|---|
| id | bigint identity PK | |
| check_id | uuid FK → check_records ON DELETE CASCADE | |
| indicator | text | contract `Indicator` |
| value_numeric | numeric(6,2) NULL | all indicators but blood pressure |
| value_systolic / value_diastolic | smallint NULL | blood pressure only (`value_shape` CHECK) |
| unit | text | fixed by indicator: `h`, `1-5`, `lpm`, `mmHg`, `°C`, `%` (clarification 3) |
| source | text | contract `Source` = `voice`/`device` (M3) |
| confirmed | boolean | CHECK `source <> 'voice' OR confirmed` (Principle IX) |
| simulated | boolean | (M5) |
| captured_at | timestamptz | `Observation.at` |

Unique `(check_id, indicator)`. A sensor without a value has no observation row; its "sin dato" state
lives in the `readings` snapshot (`level = 'unknown'`).

## alerts
| Column | Type | Rule |
|---|---|---|
| id | uuid PK | |
| crew_id | text FK | |
| check_id | uuid UNIQUE FK | at most one alert per check (FR-007) |
| urgency | text | `IN ('soon','now')`: attention → soon, alert → now |
| status | text | `IN ('open','decided')`, default open |
| decision | text NULL | `IN ('manage_on_base','consult_surgeon','prepare_return')` |
| decided_at | timestamptz NULL | |
| created_at | timestamptz | default now() |

CHECK: `(status='open' AND decision IS NULL AND decided_at IS NULL) OR (status='decided' AND decision IS NOT NULL AND decided_at IS NOT NULL)`.
Index: `(urgency, created_at) WHERE status = 'open'`.

State: `open → decided` (once; a second decision returns 409).

## schema_migrations
`version text PK`, `applied_at timestamptz default now()` — written by the migration runner.

## Domain mapping (ingest)
`SyncCheck` (wire, see contracts) → `CheckToStore { clientCheckId, crewId, kind, missionDay, verdict,
actionKey|null, symptoms, simulated, readings, completedAt, observations[] {indicator, numeric|bp, unit,
source, confirmed, simulated, capturedAt} }` + `AlertToOpen | null`.
