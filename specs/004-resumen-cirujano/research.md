# Research — 004-resumen-cirujano

## R1. Sharing `libs/contracts` with a compiled NestJS service
- **Decision**: `backend/src/shared/contracts.ts` re-exports `../../../libs/contracts/src` with a relative
  path; `tsc` (CommonJS, `rootDir: ".."`) compiles both into `backend/dist/{backend,libs}`. At runtime
  `zod` resolves from `backend/node_modules` (the compiled lib sits under `backend/dist`).
- **Rationale**: contracts are published as TS source (`main: src/index.ts`); a relative import needs no
  alias rewriting and no change to `libs/`.
- **Alternatives**: `paths` + `tsc-alias` (extra build step); bundling with esbuild (no decorator
  metadata); adding backend to root workspaces (root `package.json` out of scope now — pending).

## R2. Migrations
- **Decision**: own runner: reads `migrations/*.sql` sorted by the 4-digit prefix, `schema_migrations
  (version text primary key, applied_at)`, each file in its own transaction, whole run under
  `pg_advisory_lock`. Runs in `main.ts` before `listen`.
- **Rationale**: Principle I; the schema doc asks for versioned SQL files applied on start, not
  `docker-entrypoint-initdb.d`.
- **Alternatives**: node-pg-migrate / Prisma / TypeORM migrations (more dependencies and DSLs).

## R3. Access codes (M7)
- **Decision**: two env values, `SURGEON_ACCESS_CODE` and `SYNC_CODE`, compared with
  `crypto.timingSafeEqual` on SHA-256 digests (equal length). Sent as headers `X-Access-Code` /
  `X-Sync-Code`. The surgeon page keeps the code in `sessionStorage` (clarification 1). Failed attempts
  are counted in memory per client address (`CF-Connecting-IP`, else socket address); > 10 in a rolling
  minute → 429 until the minute passes. Minimum code length 12 (config validation).
- **Alternatives**: HTTP Basic (English browser dialog, cached until browser closes); signed cookie
  (that is a token, excluded by M7).

## R4. Health endpoint
- **Decision**: `GET /api/v1/health` → `200 {"status":"ok","database":"up"}` or
  `503 {"status":"ok","database":"down"}`; probe = `SELECT 1` with a 2 s timeout. No code required.
- **Rationale**: the server itself answers either way (US1.2); 503 lets compose/monitors see the
  dependency is down.

## R5. Tunnel
- **Decision**: `cloudflare/cloudflared` pinned image, `tunnel --no-autoupdate --url http://backend:3000`
  (Quick Tunnel, no account). The temporary URL is read with
  `docker compose logs cloudflared | grep trycloudflare.com`.

## R6. Frontend service (M10)
- **Decision**: compose `frontend` service built with `dockerfile_inline` from the repo root (`npm ci`,
  `npm run build`, `vite preview --host 0.0.0.0 --port 4173`), port `127.0.0.1:4173`. No file in
  `frontend/` changes.

## R7. Server-side storage of derived data (M9)
- **Decision**: store the tablet's `readings` snapshot as `jsonb` (validated by the contract's
  `SensorReading`), do not store per-observation level, do not recompute.
- **Rationale**: the surgeon must see exactly what the astronaut was shown; recomputing with a newer
  `thresholds.ts` would silently rewrite history.

## R8. CORS
- **Decision**: allow origins from `CORS_ORIGINS` (comma list, default `https://base-vital.pages.dev`)
  for `/api/v1/checks` and `/api/v1/health`. The surgeon page is same-origin.

## R9. Urgency mapping
- `alert` → `now`, `attention` → `soon`, `ok` → no alert. Queue order: `now` first, then oldest first.
