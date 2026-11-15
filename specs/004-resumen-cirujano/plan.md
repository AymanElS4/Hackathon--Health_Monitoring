# Implementation Plan: Resumen para el cirujano de vuelo — sincronización y vista del cirujano

**Branch**: `004-resumen-cirujano` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-resumen-cirujano/spec.md`

## Summary

A small NestJS service, hexagonal (domain → application ports/use cases → adapters), that (1) reports
its own and the database's health, (2) accepts completed daily check-ins from the crew tablet,
idempotently keyed by a device-generated UUID, (3) serves a Spanish flight-surgeon page behind a shared
access code with a per-crew summary, 14-day history and an alert queue with one decision per alert.
PostgreSQL 16 sits behind the ports; an in-memory adapter backs every unit/e2e test. Versioned SQL
migrations (`backend/migrations/NNNN_*.sql`) are applied by the service on start. `docker compose up`
starts postgres (named volume, `127.0.0.1` only), backend, frontend (M10) and a cloudflared Quick
Tunnel that exposes only the backend.

**First delivery (before everything else)**: `0001_init.sql`, `docker-compose.yml`, `.env.example`,
`GET /api/v1/health`. Verified with `docker compose up` + `curl`.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 24 (container `node:24-alpine`).

**Primary Dependencies**: NestJS 11 (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`),
`pg` 8, `zod` 3 (shared contracts from `libs/contracts`), no ORM.

**Contracts**: imported from `libs/contracts/src` through one re-export file
`backend/src/shared/contracts.ts` (relative path, compiled together by `tsc`, so no path-alias rewriting
at runtime). The backend adds only its wire envelope (`clientCheckId`, `crewId`, `kind`, `missionDay`)
around the unchanged `CheckRecord` ([contracts/http-api.md](./contracts/http-api.md)).

**Packaging**: `backend/` is its own npm package with its own lockfile. It is NOT added to the root
workspaces in this feature because the root `package.json` is outside this session's scope (another
session owns it); recorded in [pendientes-frontend.md](./pendientes-frontend.md).

**Storage**: PostgreSQL 16 (`postgres:16-alpine`), schema in `backend/migrations/0001_init.sql`
([data-model.md](./data-model.md)). Migration runner: ~60 lines in the postgres adapter, table
`schema_migrations`, one transaction per file, `pg_advisory_lock` against concurrent starts.

**Testing**: Vitest + `unplugin-swc` (decorator metadata for Nest) + `supertest`. Unit tests on domain
and use cases with the in-memory adapter; e2e tests boot the Nest app with the in-memory adapter; one
integration test runs the migrations and the repository against a real Postgres when `DATABASE_URL` is
set (skipped otherwise; quickstart runs it against the compose database). A contract test compares the
SQL `CHECK (... IN (...))` lists with the Zod enums (FR-015).

**Target Platform**: Linux container behind cloudflared; surgeon page in any modern browser.

**Project Type**: web service + one server-served page.

**Performance Goals**: a demo crew of 1–3 people, ≤ 1 check-in/day each; health answers in < 2 s even
with the database down (query timeout 2 s).

**Constraints**: off the astronaut's critical path (constitution 1.2.0); no accounts, no tokens; no PII;
only the tunnel is reachable from outside; secrets only in `.env`.

**Scale/Scope**: 7 endpoints, 1 page, 4 tables.

## Constitution Check

| Principle | Status |
|---|---|
| I. Simplicity | Pass. No ORM, own 60-line migration runner, page is static HTML + vanilla JS served by the backend, two shared codes instead of auth. NestJS is the requested framework (see Complexity Tracking). |
| II. Language split | Pass. Surgeon page text only in `backend/src/config/messages.es.ts`; code/docs in English. |
| III. No phantom scope | Pass. `exit` kind not accepted (M8); `button` source dropped (M3); no users/tokens tables (M7); no notifications. |
| IV. Verifiable by non-technical person | Pass. Health and surgeon page are opened in a browser; quickstart lists browser steps. |
| V. Respectful data | Pass. Pseudonymous `crew-xxxxxx` only; strict schemas drop unknown fields; secrets only in `.env`; `simulated` stored and shown (M5). |
| VI. Never diagnose | Pass. Page shows the tablet's verdict/action keys and the surgeon's decision only; messages reviewed by a test that greps for forbidden words. |
| VII. Offline by default | Pass. Nothing on the astronaut path depends on the backend. |
| VIII. Every threshold has a source | Pass. The backend has no thresholds; it stores the tablet's snapshot including `teamCriterion` and shows "criterio del equipo, no clínico" (M9). |
| IX. Confirm before recording | Pass. Rejected at the boundary (contract `superRefine`) and in the database (`voice_is_confirmed`). |

Post-design re-check: unchanged, pass.

## Project Structure

### Documentation (this feature)

```text
specs/004-resumen-cirujano/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/http-api.md
├── pendientes-frontend.md
└── tasks.md
```

### Source Code

```text
docker-compose.yml            # postgres, backend, frontend, cloudflared
.env.example                  # names only, no values
backend/
├── Dockerfile                # build context = repo root (needs libs/contracts)
├── Dockerfile.dockerignore   # BuildKit per-Dockerfile ignore (root .dockerignore is out of scope)
├── package.json  tsconfig.json  tsconfig.build.json  vitest.config.ts
├── migrations/0001_init.sql
├── public/cirujano.html  public/cirujano.js  public/cirujano.css
├── src/
│   ├── main.ts               # bootstrap: config → migrations → listen
│   ├── app.module.ts         # composition root (only place adapters are bound)
│   ├── shared/contracts.ts   # re-export of libs/contracts/src
│   ├── config/{env.ts, constants.ts, messages.es.ts}
│   ├── domain/               # ingest mapping, alert rules, summary ordering (pure)
│   ├── application/ports/    # CheckRepository, DatabaseProbe, Clock
│   ├── application/use-cases/# getHealth, ingestCheck, listCrew, getCrewSummary, listAlerts, decideAlert
│   └── adapters/
│       ├── http/             # controllers, guards (codes + rate limit), zod pipe, page controller
│       ├── postgres/         # pool, migrator, PgCheckRepository, PgDatabaseProbe
│       ├── memory/           # InMemoryCheckRepository, FakeDatabaseProbe (tests)
│       └── system/           # SystemClock
├── scripts/seed-demo.ts      # FR-016, dev only
└── tests/{unit,e2e,contract,integration}/
```

**Structure Decision**: single backend package in `backend/`, layers as in the frontend
(`domain` imports only libs; adapters bound only in `app.module.ts` through Nest providers, never
`new`-ed elsewhere, which also satisfies the root ESLint adapter rule).

## Complexity Tracking

| Choice | Why needed | Simpler alternative rejected because |
|---|---|---|
| NestJS instead of a bare HTTP server | Requested by the team; DI binds ports to adapters in one module (hexagonal) | Bare `node:http` would need hand-rolled DI and routing |
| Second shared code for the tablet (`SYNC_CODE`) | Without it anyone with the public tunnel URL can write fake check-ins | Reusing the surgeon code would put the surgeon's code on every tablet |
| `unplugin-swc` in tests | Vitest's esbuild does not emit decorator metadata Nest needs | Jest would add a second test runner to the repo |
