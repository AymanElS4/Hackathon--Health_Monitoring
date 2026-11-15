# Quickstart — 004-resumen-cirujano

## Prerequisites
Docker with Compose v2. Nothing else for the run; Node 24 only to run tests outside Docker.

## 1. Start everything (US1, SC-001)
```bash
cp .env.example .env      # then fill every value (codes ≥ 12 characters)
docker compose up -d --build
docker compose ps         # postgres, backend, frontend, cloudflared: running/healthy
curl -s http://127.0.0.1:3000/api/v1/health
# {"status":"ok","database":"up"}
docker compose logs cloudflared | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com'
curl -s https://<that-address>/api/v1/health      # same answer, from anywhere
```
Database down (US1.2): `docker compose stop postgres` → health answers 503 `"database":"down"`;
`docker compose start postgres` → back to `up`.

Missing value (US1.4): blank `SURGEON_ACCESS_CODE` in `.env` → `docker compose up` refuses and names it.

## 2. Send a check (US2)
```bash
curl -s -X POST http://127.0.0.1:3000/api/v1/checks \
  -H 'Content-Type: application/json' -H "X-Sync-Code: $SYNC_CODE" \
  --data @backend/tests/fixtures/sync-check.alert.json
```
First time `201 created`; again `200 duplicate` (SC-003).

## 3. Demo data (FR-016)
```bash
docker compose exec backend node dist/backend/scripts/seed-demo.js
```

## 4. Surgeon view (US3, US4)
Open `http://127.0.0.1:3000/cirujano` (or the tunnel address + `/cirujano`), type the access code:
crew list → `crew-a1b2c3` → latest check, sensors, symptoms, 14-day history with "simulado"; alert queue →
choose a decision → the alert leaves the queue.

## 5. Tests
```bash
cd backend && npm ci && npm test                     # unit + e2e + contract (in-memory)
DATABASE_URL=postgres://USER:PASS@127.0.0.1:5432/DB npm run test:integration   # real Postgres
```

## 6. Persistence (SC-002)
`docker compose down && docker compose up -d` → the checks are still in the surgeon view.
`docker compose down -v` deletes the volume (all data).
