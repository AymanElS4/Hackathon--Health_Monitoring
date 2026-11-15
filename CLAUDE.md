# Base Vital

Offline daily health check-in for astronauts (NASA Space Apps Guayaquil 2026, challenge 04):
voice check-in in Spanish or English + rotatable 3D body + one-action verdict. Prototype; never diagnoses.

## Stack
TypeScript (strict) · React 18 · React Router v5.3.4 · Vite · Zod · Vosk (Web Worker) ·
speechSynthesis · React Three Fiber + drei · IndexedDB · vite-plugin-pwa · Tailwind (tokens).
npm workspaces. No accounts. A server is allowed only off the astronaut's path (feature 004); the app
must work with it down.

## Commands
From the root: `npm test` · `npm run lint` · `npm run dev` · `npm run build && npm run preview` ·
`npm run check:model`

## Layout
`libs/contracts` (Zod, defined once) · `libs/health-rules` (pure rules, thresholds) · `frontend/src/`:
`domain` (imports only libs) · `application/{ports,use-cases}` · `adapters` (each with a fake) · `ui` ·
`config` · `composition-root.ts` (only place adapters are created). `backend/` comes with 004.
Layer rules are enforced by eslint-plugin-boundaries.
Active feature: `specs/001-chequeo-diario-voz-cuerpo/` (spec, plan, tasks).

## Conventions
- UI and voice text ONLY in `frontend/src/config/messages.es.ts` / `messages.en.ts` (ES | EN toggle drives
  screen and voice); code, comments, docs in English.
- `.glb` node names are fixed: `body`, `sensor_sleep`, `sensor_pulse`, `sensor_pressure`,
  `sensor_temperature`, `sensor_oxygen`. Never rename; `npm run check:model` must pass.
- Two separate color tables in `frontend/src/config/constants.ts`: `SENSOR_COLORS` (which sensor) and
  `LEVEL_COLORS` (is it fine). Never mix them; they share no hex value.
- Every threshold in `libs/health-rules/src/thresholds.ts` has a verified source or is a declared team
  criterion shown as "criterio del equipo, no clínico".
- Domain and contracts are test-first. Build only what the spec asks for.

## Model routing
- Planning, spec, clarify, analyze: main session (Opus).
- /speckit-implement: delegate EACH task to `implementer` (Haiku), one at a time, in tasks.md order.
- Tasks that need internet (T008 licenses, T009 threshold sources): main session.
- After each phase: run `reviewer` (Opus); send its findings back to `implementer` as fix tasks.
- If `implementer` marks a task [BLOCKED]: retry once with model sonnet; if it fails again, stop
  and report.

Las reglas de producto viven en .specify/memory/constitution.md y el estado del producto en specs/README.md
