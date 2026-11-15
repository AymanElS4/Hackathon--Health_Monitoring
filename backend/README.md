# Base Vital backend

Flight-surgeon sync service (spec 004). It receives daily check-in summaries from the crew tablet and serves them to the flight surgeon. It is off the astronaut's critical path: the tablet keeps working when this service is down. Prototype; it never diagnoses.

## Quick start

Run from the repository root:

```bash
cp .env.example .env        # fill every value; codes >= 12 characters, different from each other
docker compose up -d --build
curl -s http://127.0.0.1:3000/api/v1/health   # 200 {"status":"ok","database":"up"}, or 503 if the database is down
docker compose logs cloudflared | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com'   # temporary public address
```

Port 3000 is the default (see [Host ports](#host-ports)). Never commit `.env`.

Demo data (simulated history for `crew-a1b2c3`, idempotent):

```bash
docker compose exec backend node dist/backend/scripts/seed-demo.js
```

Surgeon page: `http://127.0.0.1:3000/cirujano`, or the tunnel address + `/cirujano`. Enter the `SURGEON_ACCESS_CODE` value from `.env`.

## API

| Method | Path | Header | Purpose |
|---|---|---|---|
| GET | `/api/v1/health` | none | Service and database status (200 / 503) |
| POST | `/api/v1/checks` | `X-Sync-Code` | Store a check (201 created, 200 duplicate) |
| GET | `/api/v1/surgeon/crew` | `X-Access-Code` | Crew list |
| GET | `/api/v1/surgeon/crew/:crewId` | `X-Access-Code` | Latest check and 14-day history |
| GET | `/api/v1/surgeon/alerts` | `X-Access-Code` | Open alerts queue |
| POST | `/api/v1/surgeon/alerts/:id/decision` | `X-Access-Code` | Record a decision |

Full contract: [HTTP API](../specs/004-resumen-cirujano/contracts/http-api.md).

## Tests and layout

```bash
cd backend && npm ci && npm test                                               # unit, e2e, contract (in-memory)
DATABASE_URL=postgres://USER:PASS@127.0.0.1:5432/DB npm run test:integration   # needs a real Postgres
```

Integration tests run only when `DATABASE_URL` is set. Node 24 is needed outside Docker.

`src/domain` (pure rules) · `src/application` (ports, use cases) · `src/adapters` (`http`, `postgres`,
`memory` fakes, `system` clock) · `src/config` · `migrations` · `scripts` (demo seed).

## Host ports and stop

Set in `.env`, all bound to 127.0.0.1: `BACKEND_HOST_PORT` (3000), `POSTGRES_HOST_PORT` (5432), `FRONTEND_HOST_PORT` (4173).

- `docker compose down`: stops the stack, keeps the data.
- `docker compose down -v`: also deletes the database volume (all checks).

Pending: sending checks from the tablet is not wired yet, see [pendientes-frontend.md](../specs/004-resumen-cirujano/pendientes-frontend.md).

Specs: [Quickstart](../specs/004-resumen-cirujano/quickstart.md) · [Spec](../specs/004-resumen-cirujano/spec.md)
