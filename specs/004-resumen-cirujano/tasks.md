---
description: "Tasks for 004-resumen-cirujano"
---

# Tasks: Resumen para el cirujano de vuelo — sincronización y vista del cirujano

**Input**: `specs/004-resumen-cirujano/` (spec.md, plan.md, research.md, data-model.md,
contracts/http-api.md, quickstart.md)

**Tests**: requested (CLAUDE.md: domain and contracts are test-first). Test tasks come before the code
they cover and must fail first.

**Scope guard**: only `backend/`, `docker-compose.yml`, `.env.example`, `docs/`, `specs/004-*`. Never edit
`frontend/`, `libs/` or root config; write needed outside changes in
`specs/004-resumen-cirujano/pendientes-frontend.md`.

**Shared rules for every task**
- Code/comments in English; any Spanish text only in `backend/src/config/messages.es.ts`.
- Contracts only through `backend/src/shared/contracts.ts` (re-export of `libs/contracts/src`); never
  redefine a contract enum.
- Adapters are bound only in `backend/src/app.module.ts` via Nest providers (`useClass`/`useFactory`);
  never `new XxxRepository/Adapter/Clock` elsewhere (root ESLint rule).
- Numbers other than 0/1/-1 go in named `const`s (root ESLint `no-magic-numbers`).
- Run from `backend/`: `npm test` must pass; from the root `npx eslint backend --ext .ts` must pass.

## Phase 1: Setup

- [ ] T001 Create `backend/package.json` (name `@base-vital/backend`, private, CommonJS; scripts `build`=`tsc -p tsconfig.build.json`, `start`=`node dist/backend/src/main.js`, `test`=`vitest run`, `test:integration`=`vitest run tests/integration`, `seed:demo`=`node dist/backend/scripts/seed-demo.js`; deps `@nestjs/common@11 @nestjs/core@11 @nestjs/platform-express@11 reflect-metadata rxjs pg zod@^3.25.76`; dev `@nestjs/testing@11 @types/pg @types/express @types/supertest supertest typescript@^5.9 vitest@^2.1.9 unplugin-swc @swc/core @types/node`), run `npm install` in `backend/` (needs internet → main session)
- [ ] T002 [P] Create `backend/tsconfig.json` (strict, `module: commonjs`, `moduleResolution: node`, `target: ES2022`, `experimentalDecorators`, `emitDecoratorMetadata`, `rootDir: ".."`, `outDir: dist`, `esModuleInterop`, `skipLibCheck`, include `src`, `scripts`, `tests`, `../libs/contracts/src`) and `backend/tsconfig.build.json` (extends it, excludes `tests`)
- [ ] T003 [P] Create `backend/vitest.config.ts` using `unplugin-swc` (`swc.vite({ module: { type: 'es6' } })`), `test.include: ['tests/**/*.test.ts']`, `test.exclude` containing `tests/integration/**` unless `process.env.DATABASE_URL` is set
- [ ] T004 [P] Create `backend/src/shared/contracts.ts`: `export * from '../../../libs/contracts/src';` and a test `backend/tests/unit/contracts-import.test.ts` asserting `Verdict.options` equals `['ok','attention','alert']`
- [ ] T005 [P] Replace `backend/README.md` with a short English README: what the service is, `docker compose up`, link to `specs/004-resumen-cirujano/quickstart.md`; delete the `.gitkeep` files that are replaced by real files

## Phase 2: Foundational — first delivery infrastructure (blocks all stories)

- [ ] T006 Write the failing contract test `backend/tests/contract/schema-enums.test.ts` (FR-015): read `backend/migrations/0001_init.sql`, extract the `CHECK (<column> IN (...))` lists and assert: `check_records.verdict` = `Verdict.options`; `observations.indicator` = `Indicator.options`; `observations.source` = `Source.options`; the symptoms array check = `Symptom.options`; `check_records.kind` = `['daily']`
- [ ] T007 Write `backend/migrations/0001_init.sql` exactly per `specs/004-resumen-cirujano/data-model.md` (tables `crew_members`, `check_records`, `observations`, `alerts`; `CREATE EXTENSION IF NOT EXISTS pgcrypto`; crew id `CHECK (id ~ '^crew-[a-z0-9]{6}$')`; `kind IN ('daily')`; `mission_day >= 1`; verdict `IN ('ok','attention','alert')`; `action_matches_verdict CHECK ((verdict = 'ok' AND action_key IS NULL) OR (verdict IN ('attention','alert') AND action_key IS NOT NULL AND action_key <> ''))`; `symptoms text[] NOT NULL DEFAULT '{}' CHECK (symptoms <@ ARRAY['dizziness','fainting','chest_pain','shortness_of_breath','none']::text[])`; `readings jsonb NOT NULL`; `simulated boolean NOT NULL`; observations `value_shape` with 2 branches, `voice_is_confirmed CHECK (source <> 'voice' OR confirmed)`, `UNIQUE (check_id, indicator)`; alerts `urgency IN ('soon','now')`, `status IN ('open','decided')`, decision `IN ('manage_on_base','consult_surgeon','prepare_return')`, the open/decided CHECK, `check_id UNIQUE`, partial index on open) so T006 passes. No `schema_migrations` table here (the runner owns it)
- [ ] T008 [P] Write failing tests then `backend/src/config/env.ts`: Zod schema for `DATABASE_URL` (url), `PORT` (default 3000), `SURGEON_ACCESS_CODE` and `SYNC_CODE` (string, min 12), `CORS_ORIGINS` (comma list, default `https://base-vital.pages.dev`); `loadEnv(source)` throws an Error whose message names every missing/invalid variable (FR-005). Tests in `backend/tests/unit/env.test.ts`
- [ ] T009 [P] Create `backend/src/config/constants.ts` (`API_PREFIX='api/v1'`, `DB_PROBE_TIMEOUT_MS=2000`, `MAX_FAILED_ATTEMPTS=10`, `FAILED_ATTEMPTS_WINDOW_MS=60000`, `HISTORY_DAYS=14`, `MIGRATIONS_DIR` resolved relative to the package root, `MIGRATION_LOCK_KEY` integer)
- [ ] T010 Implement `backend/src/adapters/postgres/pool.ts` (`createPool(databaseUrl)` → `pg.Pool`, `connectionTimeoutMillis` = `DB_PROBE_TIMEOUT_MS`) and `backend/src/adapters/postgres/migrator.ts` (`runMigrations(pool, dir)`: `pg_advisory_lock(MIGRATION_LOCK_KEY)`, create `schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())` if missing, apply each `NNNN_*.sql` not yet recorded in filename order, each in its own transaction, record version, unlock in `finally`; returns applied versions)
- [ ] T011 Create `backend/Dockerfile` (multi-stage, `node:24-alpine`; build context = repo root: copy `libs/contracts/src`, `backend/package*.json` → `npm ci` → copy `backend/` → `npm run build` → `npm prune --omit=dev`; runtime stage copies `backend/node_modules`, `backend/dist`, `backend/migrations`, `backend/public`; `USER node`; `CMD ["node","dist/backend/src/main.js"]`) and `backend/Dockerfile.dockerignore` (ignore `**/node_modules`, `**/dist`, `frontend`, `.git`, `.env*`)
- [ ] T012 Create `docker-compose.yml` (research R5, R6, data-model): `postgres` (`postgres:16-alpine`, env `POSTGRES_USER/PASSWORD/DB` with `${VAR:?set VAR in .env}`, volume `pgdata:/var/lib/postgresql/data`, `127.0.0.1:5432:5432`, healthcheck `pg_isready`); `backend` (build `context: .`, `dockerfile: backend/Dockerfile`, env `DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`, `SURGEON_ACCESS_CODE`, `SYNC_CODE` with `:?`, `CORS_ORIGINS`; `127.0.0.1:3000:3000`; `depends_on: postgres: condition: service_healthy`; healthcheck with `node -e` fetch of `/api/v1/health`); `frontend` (`dockerfile_inline` node:24-alpine: `npm ci`, `npm run build -w @base-vital/frontend`, `CMD npx vite preview --host 0.0.0.0 --port 4173` in `frontend/`; `127.0.0.1:4173:4173`); `cloudflared` (`cloudflare/cloudflared` pinned tag, `tunnel --no-autoupdate --url http://backend:3000`, `depends_on: backend: condition: service_healthy`); volume `pgdata`. No other published ports
- [ ] T013 [P] Create `.env.example` with names only and comments (English): `POSTGRES_USER=`, `POSTGRES_PASSWORD=`, `POSTGRES_DB=`, `SURGEON_ACCESS_CODE=` (≥12 chars), `SYNC_CODE=` (≥12 chars), `CORS_ORIGINS=`; add it with `git add -f` (root `.gitignore` ignores `.env*`, see pendientes)

## Phase 3: User Story 1 — servidor en marcha y estado (P1) 🎯 first delivery

**Goal**: one command starts everything; `/api/v1/health` reports server + database.
**Independent test**: quickstart §1.

- [ ] T014 [P] [US1] Port `backend/src/application/ports/database-probe.port.ts` (`DATABASE_PROBE` token, `isReachable(): Promise<boolean>`) and fake `backend/src/adapters/memory/fake-database-probe.ts` (settable `reachable`)
- [ ] T015 [US1] Failing test then use case `backend/src/application/use-cases/get-health.ts` → `{ status: 'ok', database: 'up' | 'down' }` (`backend/tests/unit/get-health.test.ts`; probe throwing ⇒ `down`)
- [ ] T016 [US1] `backend/src/adapters/postgres/pg-database-probe.ts`: `SELECT 1` raced against `DB_PROBE_TIMEOUT_MS`, any error/timeout ⇒ `false`
- [ ] T017 [US1] `backend/src/adapters/http/health.controller.ts`: `GET /api/v1/health` → 200 when up, 503 when down, body from T015 (contracts/http-api.md)
- [ ] T018 [US1] Composition: `backend/src/app.module.ts` (`AppModule.forRoot(env)` binding `PG_POOL` via factory, `DATABASE_PROBE`→`PgDatabaseProbe`) and `backend/src/main.ts` (`loadEnv(process.env)` → on error log the message and `process.exit(1)`; `runMigrations`; `NestFactory.create`, global prefix from constants, CORS from `CORS_ORIGINS`, `enableShutdownHooks`, listen on `0.0.0.0:PORT`)
- [ ] T019 [US1] E2E test `backend/tests/e2e/health.e2e.test.ts`: build a testing module overriding `DATABASE_PROBE` with the fake; up ⇒ 200 `{"status":"ok","database":"up"}`, down ⇒ 503 `database: down`
- [ ] T020 [US1] Integration test `backend/tests/integration/migrations.test.ts` (runs only with `DATABASE_URL`): runs migrations twice on a fresh schema (second run applies nothing), and the probe returns true
- [ ] T021 [US1] Verify first delivery: `docker compose up -d --build`, `curl 127.0.0.1:3000/api/v1/health` = up; stop postgres ⇒ 503 down; start ⇒ up; read the trycloudflare address from logs and curl it; record results in `specs/004-resumen-cirujano/quickstart.md` if anything differs (main session)

## Phase 4: User Story 2 — la tablet envía chequeos (P1)

**Goal**: idempotent ingest. **Independent test**: quickstart §2, SC-003.

- [ ] T022 [P] [US2] Failing tests then `backend/src/domain/sync-check.ts`: `SyncCheck` Zod envelope `.strict()` `{ clientCheckId: uuid, crewId: /^crew-[a-z0-9]{6}$/, kind: z.literal('daily'), missionDay: int ≥ 1, check: CheckRecord }` + refinement: no repeated `indicator` in `check.observations`; numeric values `abs < 10000` (fits `numeric(6,2)`). Tests in `backend/tests/unit/sync-check.test.ts` (unconfirmed voice, ok+action, attention without action, repeated indicator, `kind: 'exit'`, `source: 'button'`, unknown field ⇒ all invalid)
- [ ] T023 [P] [US2] Failing tests then `backend/src/domain/to-stored-check.ts`: pure mapping `SyncCheck → { check: CheckToStore, alert: { urgency } | null }` per data-model "Domain mapping" (`actionKey ''`⇒`null`; units `sleep_hours:'h'`, `mood:'1-5'`, `resting_heart_rate:'lpm'`, `blood_pressure:'mmHg'`, `body_temperature:'°C'`, `oxygen_saturation:'%'`; `alert`⇒`now`, `attention`⇒`soon`, `ok`⇒null; `missionStartDate = date(completedAt) − (missionDay − 1)` in UTC). Units live in `backend/src/config/constants.ts`
- [ ] T024 [US2] Port `backend/src/application/ports/check-repository.port.ts` (`CHECK_REPOSITORY` token): `saveCheck(check, alert): Promise<{ status: 'created' | 'duplicate'; id: string }>` (crew upsert + check + observations + alert atomically; duplicate on `clientCheckId`), plus read/decide methods used by US3/US4 (`listCrewLatest`, `getCrew`, `listChecks(crewId, fromDate, toDate)`, `listOpenAlerts`, `decideAlert(id, decision, at)` → `'decided' | 'not_found' | 'already_decided'`)
- [ ] T025 [US2] `backend/src/adapters/memory/in-memory-check-repository.ts` implementing the whole port (used by unit/e2e tests); tests `backend/tests/unit/in-memory-check-repository.test.ts` for created/duplicate
- [ ] T026 [US2] Failing test then use case `backend/src/application/use-cases/ingest-check.ts` (validate with `SyncCheck`, map, save; returns created/duplicate or `invalid` with Zod issues); `backend/tests/unit/ingest-check.test.ts` (5 sends ⇒ 1 check, ≤ 1 alert)
- [ ] T027 [US2] `backend/src/adapters/postgres/pg-check-repository.ts` `saveCheck`: one transaction; `INSERT ... ON CONFLICT (id) DO NOTHING` crew; `INSERT check_records ... ON CONFLICT (client_check_id) DO NOTHING RETURNING id` → if none, select existing id and return duplicate; insert observations and alert. Integration test in `backend/tests/integration/pg-check-repository.test.ts`
- [ ] T028 [US2] Access guard `backend/src/adapters/http/code.guard.ts`: factory for header `X-Sync-Code` / `X-Access-Code` compared with SHA-256 + `timingSafeEqual`; failed-attempt limiter `backend/src/adapters/http/attempt-limiter.ts` (per `CF-Connecting-IP` or socket address, > `MAX_FAILED_ATTEMPTS` in `FAILED_ATTEMPTS_WINDOW_MS` ⇒ 429 `too_many_attempts`); 401 `invalid_code`. Unit tests in `backend/tests/unit/code-guard.test.ts`
- [ ] T029 [US2] `backend/src/adapters/http/checks.controller.ts` `POST /api/v1/checks` (contracts/http-api.md: 201/200/400 `invalid_check` with issues/401/429/503 `database_unavailable` when the repository throws a connection error) and bind `CHECK_REPOSITORY`→`PgCheckRepository` in `app.module.ts`
- [ ] T030 [US2] Fixtures `backend/tests/fixtures/sync-check.ok.json` and `sync-check.alert.json` (valid per contract; alert with `actionKey` e.g. `action.call_surgeon`) and e2e `backend/tests/e2e/checks.e2e.test.ts` (created, duplicate, invalid, bad code, 11th bad code ⇒ 429)

## Phase 5: User Story 3 — resumen del cirujano (P2)

**Goal**: Spanish page behind the shared code. **Independent test**: quickstart §4.

- [ ] T031 [P] [US3] Failing tests then `backend/src/domain/crew-ordering.ts` (order `alert`, `attention`, `ok`, then newest) and `backend/src/domain/history-window.ts` (14 calendar days ending on the latest check's UTC day)
- [ ] T032 [US3] Use cases `backend/src/application/use-cases/list-crew.ts` and `get-crew-summary.ts` (latest + history, newest first; `not_found`), with tests on the in-memory repository
- [ ] T033 [US3] Read methods of `pg-check-repository.ts` (`listCrewLatest`, `getCrew`, `listChecks` with observations and alert) + integration test cases
- [ ] T034 [US3] `backend/src/adapters/http/surgeon.controller.ts`: `GET /api/v1/surgeon/crew`, `GET /api/v1/surgeon/crew/:crewId` behind `X-Access-Code`; e2e `backend/tests/e2e/surgeon.e2e.test.ts` (wrong code ⇒ 401 and no data; ordering; history window)
- [ ] T035 [US3] `backend/src/config/messages.es.ts`: all Spanish page text (title, code prompt, wrong code, too many attempts, crew list, verdict names `ok`→"Bien", `attention`→"Atención", `alert`→"Alerta", sensor names, level names, symptom names, "simulado", "criterio del equipo, no clínico", "sin dato", action keys used by the tablet copied from the 001 messages as values, urgency, decisions, empty states). No diagnosis or medication words. Test `backend/tests/unit/messages.test.ts` fails on any of: `diagnóstico`, `diagnostica`, `medicamento`, `medicación`, `dosis`, `tome`
- [ ] T036 [US3] Page: `backend/src/adapters/http/page.controller.ts` (`GET /cirujano` returns `backend/public/cirujano.html` with `window.MESSAGES = <JSON of messages.es.ts>` injected; static assets `/cirujano/assets/*` from `backend/public`), `backend/public/cirujano.html`, `cirujano.css`, `cirujano.js` (vanilla: code form → `sessionStorage` → crew list → crew summary with sensors, symptoms, verdict, action, 14-day history, "simulado" and "criterio del equipo, no clínico" marks; all text from `window.MESSAGES`)

## Phase 6: User Story 4 — avisos y decisión (P3)

- [ ] T037 [US4] Use cases `list-alerts.ts` and `decide-alert.ts` (decision ∈ `manage_on_base|consult_surgeon|prepare_return`; second decision ⇒ `already_decided`; uses `CLOCK` port `backend/src/application/ports/clock.port.ts` + `backend/src/adapters/system/system-clock.ts`), unit tests
- [ ] T038 [US4] `listOpenAlerts`/`decideAlert` in `pg-check-repository.ts` (`UPDATE ... WHERE id=$1 AND status='open'`) + integration tests
- [ ] T039 [US4] Endpoints `GET /api/v1/surgeon/alerts`, `POST /api/v1/surgeon/alerts/:id/decision` in `surgeon.controller.ts` + e2e (order `now` first then oldest; 409 on second decision)
- [ ] T040 [US4] Alert queue and decision buttons in `backend/public/cirujano.js` (text from messages)

## Phase 7: Polish

- [ ] T041 [P] `backend/scripts/seed-demo.ts` (FR-016): 14 simulated daily checks for `crew-a1b2c3`, mission start `2026-10-24`, fixed variation, `simulated: true` everywhere, through the ingest use case and the Postgres repository; idempotent (fixed `clientCheckId`s)
- [ ] T042 [P] Update `backend/README.md` and `specs/004-resumen-cirujano/quickstart.md` with the final commands; update `specs/README.md` row 004 to "Implementada (backend)"
- [ ] T043 Full verification: `npm test` in `backend/`, `npx eslint backend --ext .ts`, quickstart §1–§6 against `docker compose up`, `git grep` for code values (SC-006)

## Dependencies

- Phase 1 → Phase 2 → US1 (first delivery, then commit/push/PR) → US2 → US3 → US4 → Polish.
- US3 needs data from US2 (or the seed T041); US4 needs US2's alerts.

## Parallel examples

- Phase 1: T002, T003, T004, T005 together after T001.
- Phase 2: T008, T009, T013 next to T006→T007.
- US2: T022 and T023 together.

## Implementation strategy

MVP = Phases 1–3 (first delivery: migration, compose, `.env.example`, health) → push + PR. Then US2, US3,
US4 and polish as incremental commits on the same branch/PR.
