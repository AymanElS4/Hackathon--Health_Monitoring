# Pending changes outside `backend/` (for the session that owns `frontend/` and `libs/`)

Feature 004 was built without touching `frontend/`, `libs/` or root files. These items are needed to
finish it end to end.

## libs/contracts
1. **M4 — idempotency key**: add `clientCheckId: z.string().uuid()` to `CheckRecord` (generated with
   `crypto.randomUUID()` when the check is saved). Today the backend carries it in its own envelope
   (`SyncCheck`, `specs/004-resumen-cirujano/contracts/http-api.md`); once it is in the contract the
   envelope field can be dropped.
2. **Crew pseudonym**: add a `CrewId` schema (`^crew-[a-z0-9]{6}$`) so tablet and backend share it.
3. **Sync envelope**: optionally move `SyncCheck` (envelope: `clientCheckId`, `crewId`, `kind`,
   `missionDay`, `check`) into the contracts so the frontend sync adapter validates with the same schema.

## frontend
4. **Sync adapter** (port `CheckSyncPort` + adapter + fake): after a check is saved, POST it to
   `${VITE_BACKEND_URL}/api/v1/checks` with header `X-Sync-Code`; keep an outbox in IndexedDB and retry
   when online; never block or fail the check-in if the backend is down (constitution 1.2.0).
5. **Config**: crew pseudonym (`crew-a1b2c3` for the demo) in `config/mission.ts`; the sync code is typed
   once on the tablet (not in the bundle) and kept in local storage.
6. **Seeded history**: the 14 simulated days already sync as `simulated: true`; the backend demo seed
   (`backend/scripts/seed-demo.ts`) has its own fixed variation. Move the generator from
   `frontend/src/application/use-cases/seedHistory.ts` to `libs/` so both sides produce the same days.

## root
7. `package.json`: add `"backend"` to `workspaces` and let `npm test` include it (today:
   `cd backend && npm test`).
8. `.gitignore`: `.env*` also ignores `.env.example`; add `!.env.example` (the file was added with
   `git add -f`).
9. Optional `.dockerignore` at the root (the backend uses `backend/Dockerfile.dockerignore`) — it would also keep host node_modules out of the frontend image build context.
10. `.eslintrc.cjs`: declare backend layers as `eslint-plugin-boundaries` elements (`backend/src/application/ports/**`, `application/**`, `adapters/**`, `config/**`, `shared/**`, composition `app.module.ts`/`main.ts`) and add `backend/src/app.module.ts` to the adapter-instantiation rule's `excludedFiles`. Today `backend/.eslintrc.cjs` enforces the two key rules locally.
