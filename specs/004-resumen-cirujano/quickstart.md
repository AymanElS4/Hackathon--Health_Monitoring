# Quickstart — 004-resumen-cirujano

## Prerequisites
Docker with Compose v2. Nothing else for the run; Node 24 only to run tests outside Docker.
Run every command from the repository root unless it says otherwise.

## 1. Start everything (US1, SC-001)
```bash
cp .env.example .env      # then fill every value (codes ≥ 12 characters, different from each other)
docker compose up -d --build
docker compose ps         # postgres and backend: healthy; frontend and cloudflared: running
curl -s http://127.0.0.1:3000/api/v1/health
# 200 {"status":"ok","database":"up"}
docker compose logs cloudflared | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com'
curl -s https://<that-address>/api/v1/health      # same answer, from anywhere
```
Host ports default to 3000 (backend), 5432 (Postgres) and 4173 (frontend). To change them, set
`BACKEND_HOST_PORT`, `POSTGRES_HOST_PORT` or `FRONTEND_HOST_PORT` in `.env`; then use that port in the URLs.

Database down (US1.2): `docker compose stop postgres` → health answers 503
`{"status":"ok","database":"down"}`; `docker compose start postgres` → back to 200 `"database":"up"`.

Missing value (US1.4): blank `SURGEON_ACCESS_CODE` in `.env` → `docker compose up` refuses to start and names the variable.

## 2. Send a check (US2)
Replace `<your SYNC_CODE>` with the value of `SYNC_CODE` in your `.env`. Do not paste it into files or commits.
```bash
curl -s -X POST http://127.0.0.1:3000/api/v1/checks \
  -H 'Content-Type: application/json' -H 'X-Sync-Code: <your SYNC_CODE>' \
  --data @backend/tests/fixtures/sync-check.ok.json
curl -s -X POST http://127.0.0.1:3000/api/v1/checks \
  -H 'Content-Type: application/json' -H 'X-Sync-Code: <your SYNC_CODE>' \
  --data @backend/tests/fixtures/sync-check.alert.json
```
First time for each file `201 {"status":"created","id":"..."}`; the same request again
`200 {"status":"duplicate","id":"..."}` (SC-003).

## 3. Demo data (FR-016)
```bash
docker compose exec backend node dist/backend/scripts/seed-demo.js
```
Idempotent. The first run prints `seed-demo: created=14 duplicate=0 invalid=0` (after any
`Applied migration …` lines); a second run prints `seed-demo: created=0 duplicate=14 invalid=0`.

## 4. Surgeon view (US3, US4)
1. Open `http://127.0.0.1:3000/cirujano` (or the tunnel address + `/cirujano`).
2. Type the value of `SURGEON_ACCESS_CODE` in the "Código de acceso" field and press "Entrar".
   A wrong code shows "Código incorrecto."; too many attempts show "Demasiados intentos. Espera un minuto."
3. The page shows the "Avisos abiertos" queue above the "Tripulantes" list.
4. In "Tripulantes", open `crew-a1b2c3`: "Último chequeo", "Sensores", "Síntomas", and
   "Últimos 14 días" with the "simulado" marks. "Volver a la lista" goes back.
5. In the queue, "Ver resumen" opens that crew's summary. Each alert has three decision buttons:
   "Manejar en la base", "Consultar con el cirujano" and "Preparar regreso". After a decision the
   alert leaves the queue.

The access code is kept only in this tab's session storage; "Salir" clears it.

## 5. Tests
```bash
cd backend && npm ci && npm test                     # unit + e2e + contract (in-memory)
DATABASE_URL=postgres://USER:PASS@127.0.0.1:<POSTGRES_HOST_PORT>/DB npm run test:integration   # real Postgres
```
Replace `USER`, `PASS` and `DB` with your `.env` values and `<POSTGRES_HOST_PORT>` with its port
(5432 by default). Integration tests run only when `DATABASE_URL` is set.

## 6. Persistence (SC-002)
`docker compose down && docker compose up -d` → the checks are still in the surgeon view.
`docker compose down -v` deletes the volume (all data).
