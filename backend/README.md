# Base Vital backend

Flight-surgeon sync service (feature 004). It receives daily check-in summaries from the astronaut app and exposes them to the flight surgeon. It is off the astronaut's critical path: the astronaut app works fully with this service down.

## Quick start

```bash
cp .env.example .env        # fill in POSTGRES_USER/PASSWORD/DB, SURGEON_ACCESS_CODE, SYNC_CODE (>= 12 chars), CORS_ORIGINS
docker compose up -d --build
curl http://127.0.0.1:3000/api/v1/health
```

Tests: `cd backend && npm ci && npm test`

## Layout

- `src/domain`: pure rules, no framework or I/O imports.
- `src/application/ports`, `src/application/use-cases`: interfaces and use cases.
- `src/adapters/http`, `postgres`, `memory`, `system`: transport, storage, fakes, clock.
- `src/config`: environment parsing and validation.
- `migrations`: SQL schema.

Specs: [Quickstart](../specs/004-resumen-cirujano/quickstart.md) · [Spec](../specs/004-resumen-cirujano/spec.md)
