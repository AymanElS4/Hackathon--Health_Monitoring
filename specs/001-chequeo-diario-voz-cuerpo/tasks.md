---

description: "Task list for 001 — daily voice check-in with 3D body"
---

# Tasks: Base Vital — Chequeo diario por voz con cuerpo 3D v0

**Input**: Design documents from `/specs/001-chequeo-diario-voz-cuerpo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included for `domain`, `contracts` and key UI states, written first (research R12 and the
base guide: domain and contracts are test-first). Acceptance CA1–CA8 is checked by hand with
`quickstart.md` using the in-app "Escenario de demo" selector (Principle IV).

**Organization**: Tasks are grouped by user story. Story labels match spec.md (US1 = HU1 … US6 = HU6).
Phases follow priority: P1 (US1, US2, US5) → P2 (US3, US4) → P3 (US6).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

T001–T026 were built in a single project at the repo root (`src/`, `tests/`, …) and keep their
original paths below for history. Phase 2b moves that code into npm workspaces; from T027 on, every
path is `libs/contracts/…`, `libs/health-rules/…` or `frontend/…` (plan.md). Spanish UI text lives
ONLY in `frontend/src/config/messages.es.ts`; code and comments in English. No `backend/` in 001.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, assets and license checks

- [X] T001 Initialize a Vite + React 18 + TypeScript (strict) app at repo root: `package.json`, `vite.config.ts`, `tsconfig.json` (`"strict": true`), `index.html` (`lang="es"`), `src/main.tsx`
- [X] T002 Install dependencies in `package.json`: `react@18`, `react-dom@18`, `react-router-dom@5.3.4`, `zod@3`, `three`, `@react-three/fiber@8`, `@react-three/drei@9`, `vosk-browser`, `idb`; dev: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `vite-plugin-pwa`, `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`, `draco3dgltf`, `tsx`, `@types/react@18`, `@types/react-dom@18`, `@types/react-router-dom@5`, `@types/three`
- [X] T003 [P] Add Vitest config (environment `jsdom`, setup file `tests/setup.ts` importing jest-dom) to `vite.config.ts` and npm scripts `dev`, `test`, `build`, `preview`, `check:model` (`tsx scripts/check-model.ts`) to `package.json`
- [X] T004 [P] Add ESLint + Prettier config in `.eslintrc.cjs` and `.prettierrc`, with `no-restricted-imports` so files under `src/domain/` cannot import from `src/adapters/`, `src/ui/` or `src/application/`
- [X] T005 Create the folder skeleton from plan.md with `.gitkeep` files: `src/{contracts,config,domain/health-rules,domain/parsing,domain/checkin,application,adapters/voice/vosk,adapters/voice/tts,adapters/voice/fake,adapters/devices/simulated,adapters/devices/fake,adapters/storage/indexeddb,adapters/storage/memory,adapters/agenda,adapters/clock,ui/screens,ui/body3d,ui/metrics,ui/checkin}`, `public/models/{vosk,draco}`, `data/`, `scripts/{blender,data}`, `tests/{unit,ui}`
- [X] T006 [P] Create `data/SOURCES.md` with one entry each for WESAD (UCI), PhysioNet Sleep-EDF, MakeHuman base mesh, `vosk-model-small-es-0.42`, and each threshold source (AHA/ACC 2025, AHA, AASM/SRS, WHO Pulse Oximetry Training Manual, MedlinePlus, CDC, Mayo Clinic): name, URL, license or reference, what is used from it, and `status: to verify`
- [X] T007 [P] Place `vosk-model-small-es-0.42.tar.gz` in `public/models/vosk/` and copy the Draco decoder files from `node_modules/three/examples/jsm/libs/draco/` into `public/models/draco/` (no CDN at runtime, Principle VII)
- [X] T008 Verify the WESAD license (academic, non-commercial use) and the Sleep-EDF license (ODC-By) against their official pages and record terms + `status: verified` in `data/SOURCES.md`; if either does not allow this use, stop and report before T020/T087 (Principle V)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Source verification, contracts, constants, ports, demo scenarios and adapters that every story uses

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T009 [DONE 2026-11-15: CDC, MedlinePlus, WHO verified against the original; AHA/ACC BP, AHA pulse 60–100 and Mayo hypothermia verified via secondary sources (recheck by hand before the demo); pulse bands outside 60–100 and the sleep 3-night rule declared team criterion] Verify every threshold source against the original document and record the exact reference (title, section/page, URL, access date) and `status: verified` in `data/SOURCES.md`: fever ≥ 38,0 °C (CDC), normal 36,1–37,2 °C (MedlinePlus), hypothermia < 35,0 °C (Mayo Clinic), SpO₂ ≥ 95 / 90–94 / < 90 % (WHO Pulse Oximetry Training Manual), BP (AHA/ACC 2025), resting pulse (AHA), sleep (AASM/SRS). If a verified source gives a different value, first correct RN1 in `specs/001-chequeo-diario-voz-cuerpo/spec.md`, then continue (Principle VIII — blocks T066)
- [X] T010 [P] Write `tests/unit/contracts.test.ts`: `Indicator` has no `face_fatigue`; `Source` is only `voice | device`; `Observation` rejects `sleep_hours` outside 0–16 or not a multiple of 0.5 and `mood` outside integer 1–5; `CheckRecord` rejects a `voice` observation with `confirmed: false` (Principle IX); `SensorReading.reason` is an `Indicator` or `null`
- [X] T011 [P] Define Zod enums in `src/contracts/enums.ts`: `SensorKey` (`sleep`, `pulse`, `pressure`, `temperature`, `oxygen`), `Indicator` (`sleep_hours`, `mood`, `resting_heart_rate`, `blood_pressure`, `body_temperature`, `oxygen_saturation`), `Level` (`green`, `amber`, `red`, `in_doubt`, `unknown`), `SensorPhase` (`idle`, `asking`, `measuring`, `confirmed`, `in_doubt`), `Verdict` (`ok`, `attention`, `alert`), `Source` (`voice`, `device`), `Symptom` (`dizziness`, `fainting`, `chest_pain`, `shortness_of_breath`, `none`), `DemoScenarioId` (`normal`, `ca4`, `missing_sensor`, `low_temp`, `voice_not_understood`), and `SENSOR_INDICATORS` (sleep → [`sleep_hours`, `mood`]; pulse → [`resting_heart_rate`]; pressure → [`blood_pressure`]; temperature → [`body_temperature`]; oxygen → [`oxygen_saturation`])
- [X] T012 Define Zod schemas in `src/contracts/entities.ts` and barrel `src/contracts/index.ts` per data-model.md: `Observation` (`value` is a number or `{ systolic, diastolic }`; "Voice values MUST be `true` before saving"; `simulated` boolean; `at` ISO date-time), `SensorReading` (`value` already formatted, `outsideNormal` boolean, `reason`: `Indicator | null`), `BodyView`, `Baseline` (`ready` false while fewer than 14 days), `Threshold` (`source` required unless `sourceStatus` is `team_criterion`; `sourceStatus`: `cited` | `to_verify` | `team_criterion`), `AgendaItem` (`time` `HH:mm`, `titleKey`), `DemoScenario` (`id`, `devices`, `priorNights`, `voice`), `CheckRecord` (`id` ISO date-time, `observations`, `symptoms`, `readings`, `verdict`, `actionKey`, `simulated`) with a refine that rejects unconfirmed voice observations — make T010 pass
- [X] T013 [P] Write `tests/unit/colors.test.ts`: `SENSOR_COLORS` and `LEVEL_COLORS` share no hex value; `LEVEL_COLORS.green.ring` is `null` (no ring); every `Indicator` (with BP split into systolic/diastolic) has a `MIN_SD` value > 0
- [X] T014 [P] Create `src/config/constants.ts` with `SENSOR_COLORS` = sleep `#5B5FD6`, pulse `#D946A8`, pressure `#9D5CE6`, temperature `#14A3A0`, oxygen `#38A3E8`, and `LEVEL_COLORS` = green `{ ring: null, label: '#64748B' }`, amber `#F2A93B`, red `#E5484D`, in_doubt `#9AA5B1` (dashed ring), unknown `#C9D2DC` (grey dot); `MIN_SD` = sleep 0.5 h, mood 0.5, resting HR 3 bpm, systolic 4 mmHg, diastolic 3 mmHg, body temperature 0.2 °C, SpO₂ 1 % (RN3: "tu normal" never has SD 0); plus an empty `FALLBACK_DOTS` placeholder — make T013 pass
- [X] T015 [P] Write `tests/unit/messages.test.ts`: every key used in `src/config/checkinScripts.ts` exists in `messages.es.ts`; no `verdict.*` or `action.*` text contains a disease or medication word from a blocklist (`diagnóstico`, `hipertensión`, `taquicardia`, `bradicardia`, `hipoxemia`, `hipotermia`, `insomnio`, `depresión`, `medicamento`, `pastilla`, `tome `) (Principle VI); `team.criterion` equals exactly "criterio del equipo, no clínico" and `team.criterion.note` equals "* criterio del equipo, no clínico" (Principle VIII)
- [X] T016 [P] Create `src/config/messages.es.ts` with all keys from contracts/checkin-script.md (`greet`, `ask.sleep`, `confirm.sleep`, `ask.mood`, `confirm.mood`, `ask.symptoms`, `measure`, `verdict.ok|attention|alert`, `action.*` incl. "Dormiste poco: tómalo con calma", "Falta el dato de {sensor}: repite la medida" and a non-diagnostic symptom action, `retry.sleep`, `retry.mood`, `next`), level labels (bien / atención / alerta / en duda / sin dato), indicator labels (Sueño, Ánimo, Pulso, Presión, Temperatura, Oxígeno), `dot.label` = "{reason} · {level}", `team.criterion` = "criterio del equipo, no clínico", `team.criterion.mark` = "*", `team.criterion.note` = "* criterio del equipo, no clínico", "Aún aprendo tu normal", "equipo simulado", "simulado", the "Vita" button label, the selector texts ("Escenario de demo": Normal, CA4, Sensor sin dato, Temperatura baja, Voz no entendida) and `scenario.resetWarning` = "Cambiar de escenario reinicia el historial" with a confirm label
- [X] T017 Create `src/application/ports.ts` with `SpeechRecognizerPort` (plus `preload(): Promise<void>`), `SpeechSynthesizerPort`, `DevicePort`, `CheckRepositoryPort`, `AgendaPort`, `ClockPort` as in contracts/ports.md
- [X] T018 [P] Implement `src/adapters/storage/memory/MemoryCheckRepository.ts` (`save` validates with `CheckRecord` schema; `list` newest first; `seedIfEmpty`)
- [X] T019 [P] Implement `src/adapters/storage/indexeddb/IdbCheckRepository.ts` with `idb`: database `base-vital`, store `checks`, keyPath `id`; `save` validates with `CheckRecord` schema; `list` newest first; `seedIfEmpty` only writes when the store is empty; `clear()` used when the demo scenario changes
- [ ] T020 [PARTIAL: script written and tested on synthetic data; real extraction pending WESAD download; continues at `frontend/scripts/data/` after T029] [P] Write `scripts/data/extract-wesad-hr.py` (needs T008; run with `python3 -I`; input path as argument) that derives resting heart rate (beats/min, 1 value per minute) from WESAD baseline segments and writes `data/wesad-hr.json` as `{ "source": "WESAD (UCI)", "bpm": [...] }` with no subject IDs; commit the generated JSON
- [X] T021 Create `src/config/demoScenarios.ts` (FR-013, research R14): `normal` (devices all in green: BP 112/72, SpO₂ 98, temp 36,7, pulse = WESAD minutes within 60–100; `priorNights` [7.5, 7.0]; voice `real`), `ca4` (same devices and nights as `normal`), `missing_sensor` (as `normal`, SpO₂ `null`), `low_temp` (as `normal`, temp 35,6), `voice_not_understood` (as `normal`, voice `never_understands`)
- [X] T022 Implement `src/adapters/devices/simulated/SimulatedDevices.ts` (`DevicePort`) reading values from the active demo scenario (pulse replayed from `data/wesad-hr.json`, filtered to 60–100 bpm in `normal`/`ca4`); every observation has `source: 'device'`, `confirmed: true`, `simulated: true`; `null` in the scenario or values outside plausibility (HR 30–220, SpO₂ 70–100, temp 30–43 °C, BP systolic 70–250, diastolic 40–150) return `null` (→ `unknown`, CL2)
- [X] T023 [P] Implement `src/adapters/devices/fake/FakeDevices.ts` (`DevicePort`) with fixed values passed in the constructor, for unit tests only
- [X] T024 [P] Create `src/config/agenda.ts` (demo day; no exit-check item; includes a "Chequeo diario" item) and implement `src/adapters/agenda/StaticAgenda.ts` (`next(now)` = first item after `now`) and `src/adapters/clock/{SystemClock,FixedClock}.ts`
- [X] T025 Create composition root `src/application/container.ts` (active demo scenario, persisted in `localStorage` with try/catch, default `normal`; picks real or fake voice — fake when `?fake=voice` or scenario voice is `never_understands`), `src/ui/App.tsx` with React Router v5 routes `/` (Home), `/checkin` (CheckIn), `/historial` (History) using placeholder screens, and mount it in `src/main.tsx`
- [X] T026 Implement `src/ui/DemoScenarioPicker.tsx`: visible "Escenario de demo" selector (Normal, CA4, Sensor sin dato, Temperatura baja, Voz no entendida); choosing a different scenario first shows the inline `scenario.resetWarning` with a confirm button (no browser dialog); on confirm it updates the container, clears the `checks` store and re-seeds history (FR-013)

**Checkpoint**: Foundation ready — sources verified, scenarios deterministic

---

## Phase 2b: Restructure into npm workspaces (blocking)

**Purpose**: move the Phase 1–2 code, built at the repo root, into `libs/` + `frontend/` (plan.md,
research R15, ui-build §1) with **no behaviour change**, and enforce the architecture by lint.

**⚠️ CRITICAL**: must finish before any user story work.

- [X] T027 Create the workspaces root: root `package.json` (`"private": true`, `"workspaces": ["libs/*", "frontend"]`, scripts `test` = `npm test --workspaces --if-present`, `lint` = `eslint . --ext .ts,.tsx`, and `dev`/`build`/`preview`/`check:model` delegating to `-w @base-vital/frontend`); `libs/contracts/package.json` (`@base-vital/contracts`, dependency `zod@3`, entry `src/index.ts`); `libs/health-rules/package.json` (`@base-vital/health-rules`, dependency `@base-vital/contracts`); `frontend/package.json` (`@base-vital/frontend`, the current runtime and dev dependencies, plus both libs); `tsconfig.base.json` (strict) and one `tsconfig.json` per workspace resolving `@base-vital/*`; run `npm install` at the root. Create `backend/` as an empty hexagonal skeleton only — `backend/src/{domain,application/ports,application/use-cases,adapters,config}/` each with a `.gitkeep`, and `backend/README.md` with the single line "Flight-surgeon sync service — feature 004-resumen-cirujano. Not part of 001." — no `package.json` and not listed in `workspaces` (004 adds it)
- [X] T028 Move `src/contracts/*` → `libs/contracts/src/` and `tests/unit/contracts.test.ts` → `libs/contracts/tests/`; move `MIN_SD` from `src/config/constants.ts` → `libs/health-rules/src/constants.ts` (+ `libs/health-rules/src/index.ts`) and its assertion from `tests/unit/colors.test.ts` → `libs/health-rules/tests/minSd.test.ts`; add a Vitest config per lib; update every import to `@base-vital/contracts` / `@base-vital/health-rules`
- [X] T029 Move everything else into `frontend/` with the ui-build §1 layout: `index.html`, `vite.config.ts`, `public/`, `scripts/`, `data/`, `src/{config,ui,App.tsx,main.tsx}`, `tests/` → `frontend/…`; split `src/application/ports.ts` into `frontend/src/application/ports/{SpeechRecognizerPort,SpeechSynthesizerPort,DevicePort,CheckRepositoryPort,AgendaPort,ClockPort}.ts` + `index.ts`; rename `src/application/container.ts` → `frontend/src/composition-root.ts`; move adapters to `frontend/src/adapters/{simulated-devices,indexeddb,static-agenda,clock}/` and `MemoryCheckRepository`, `FakeDevices`, `FixedClock` to `frontend/src/adapters/fakes/`; move `src/ui/DemoScenarioPicker.tsx` → `frontend/src/ui/components/DemoScenarioSelect.tsx` (rename the component, same props); fix the `import.meta.glob` path to `frontend/data/wesad-hr.json`; delete the emptied root folders and the root `dist/`. Acceptance: the same 83 tests pass with `npm test` from the root, type-check is clean in every workspace, `npm run build` succeeds
- [X] T030 Replace the domain `no-restricted-imports` rule with `eslint-plugin-boundaries` and add `eslint-plugin-react`, per research R18 and ui-build §1.1: `frontend/src/domain` imports only `libs/*` (never `config/`); `application` imports `domain`, `application/ports` and `config`; `adapters` and `ui` depend inward only and may import `config`; `ui` never imports `adapters`; only `App.tsx`/`main.tsx` import `composition-root.ts`; `libs` never import `frontend` or `backend`; `frontend` and `backend` never import each other; `no-restricted-syntax` forbids instantiating adapters outside `frontend/src/composition-root.ts` and tests; `max-lines` 200 on `frontend/src/application/use-cases/**`; `no-magic-numbers` (ignore 0, 1, -1; off for `frontend/src/config/**`, `libs/health-rules/src/{thresholds,constants}.ts` and tests); `react/jsx-no-literals` on `frontend/src/ui/**`. Prove each rule with `eslint --stdin` probes (no files created), fix existing violations, `npm run lint` clean
- [X] T031 Update Phase 2 data to the data mapping (research R8, R14): `frontend/src/config/demoScenarios.ts` = normal 112/72 · 64 · 98 · 36.6, prior [7.2, 7.8]; ca4 118/76 · 72 · 98 · 36.8, prior [7.1, 7.4]; missing_sensor BP `null` · 66 · 97 · 36.7, prior [7.0, 7.6]; low_temp 114/74 · 66 · 97 · 35.6, prior [7.1, 7.5]; voice_not_understood devices as normal, voice `never_understands`. `SimulatedDevices` returns the scenario pulse for today's reading; export a pure helper `pulseSeriesFor(scenario, series)` in `frontend/src/application/use-cases/pulseSeries.ts` (WESAD minutes in 60–100 bpm, or the scenario pulse if no series) for history seeding (T088). Update `frontend/tests/unit/demoScenarios.test.ts`, `frontend/tests/unit/devices/simulatedDevices.test.ts`, `frontend/tests/unit/pulseSeries.test.ts` and the "Simulated device values" entry of `frontend/data/SOURCES.md`

**Checkpoint**: workspaces in place, architecture enforced by lint, same behaviour

---

## Phase 2c: UI foundation (blocking for the Home components)

**Purpose**: design tokens, self-hosted assets, base components, connectivity and mission clock (ui-build §2, §3 #1, #7, #10; FR-014, FR-019)

- [X] T032 [P] Write `frontend/tests/unit/designTokens.test.ts`: tokens hold the kept DESIGN.md values (font Inter; canvas `#F5F8FC`; card `#FFFFFF`; primary `#2F6FED`, hover `#2559C7`; track `#E8F1FE`; text `#1E2B3C`, secondary `#6B7A8F`; card radius 16–24 px; shadow `0 4px 20px -2px rgba(30,43,60,0.06)`; touch target 48 px, nav 56 px; smallest font size 13 px); range-bar allowed zone `#4A90E2`; `LEVEL_COLORS.green` has `label: '#64748B'` and `bg: '#EEF2F6'`; and a source scan: no hex color literal in any file under `frontend/src/ui/**`
- [X] T033 Create `frontend/src/config/design-tokens.ts`; install `tailwindcss@3`, `postcss`, `autoprefixer` in `@base-vital/frontend`; `frontend/tailwind.config.ts` builds `theme.extend` from the tokens and from `SENSOR_COLORS`/`LEVEL_COLORS`; `frontend/postcss.config.cjs`; `frontend/src/index.css` with the Tailwind layers, imported from `main.tsx`; add `bg: '#EEF2F6'` to `LEVEL_COLORS.green` in `frontend/src/config/constants.ts` — make T032 pass and keep the colors test passing
- [X] T034 [P] Self-host every asset (ui-build §3 #1, FR-019): `@fontsource/inter` (400, 600, 700, latin) imported in `main.tsx`; `lucide-react` for icons; `frontend/public/logo.svg` (simple "Base Vital" wordmark drawn as SVG paths, no external font) and `frontend/public/avatars/crew-placeholder.svg` (generic silhouette, no real face); add `frontend/tests/unit/noRemoteAssets.test.ts`: `frontend/index.html` and `frontend/src/**` contain no URL to fonts.googleapis.com, fonts.gstatic.com, googleusercontent.com, unpkg.com, jsdelivr.net or any `cdn.`
- [X] T035 [P] Write `frontend/tests/ui/components.test.tsx` for the base set: `Card` renders children; `SectionHeader` renders title and optional subtitle; `Badge` renders a level label with its `LEVEL_COLORS` classes (green = slate text on `#EEF2F6`, never primary blue — ui-build §3 #7); `Button` is at least 48 px high and supports `disabled`; `StatCard` renders label and value with the value in neutral text color (ui-build §3 #8)
- [X] T036 Implement `frontend/src/ui/components/{Card,SectionHeader,Badge,Button,StatCard}.tsx` with Tailwind token classes only (no hex, no literal Spanish text) — make T035 pass
- [X] T037 [P] Add `frontend/src/application/ports/ConnectivityPort.ts` (`isOnline(): boolean; subscribe(cb): () => void`), `frontend/src/adapters/navigator-connectivity/NavigatorConnectivity.ts` (`navigator.onLine` + `online`/`offline` events) and `frontend/src/adapters/fakes/FakeConnectivity.ts`; one shared contract test `frontend/tests/unit/connectivity.contract.test.ts` run against both; wire it in `frontend/src/composition-root.ts` (research R19)
- [X] T038 [P] Create `frontend/src/config/mission.ts` (`crewName: 'Ana'`, `missionStartDate`, `avatarUrl: '/avatars/crew-placeholder.svg'`, `LUNAR_LIGHT_DAYS = 14`, `LUNAR_DARK_DAYS = 14`); write `frontend/tests/unit/missionClock.test.ts` first (start date = day 1; 22 days later = day 23; light day 9 of 14 in the example; dark after 14 light days; 28-day cycle), then implement pure `missionDay(start, now)` and `lightPhase(start, now, lightDays, darkDays)` in `frontend/src/domain/mission/missionClock.ts`
- [X] T039 Extend `AgendaItem` in `libs/contracts/src/entities.ts` per data-model.md (`id`, optional `subtitleKey`, `durationMin`, `icon`, `action`) and rewrite the demo day in `frontend/src/config/agenda.ts`: 08:00 breakfast; 09:30 `daily-checkin` (`agenda.dailyCheckin`, 1 min, action `start_checkin`); 10:00 `agenda.eva` / `agenda.eva.solarPanel` (plain activity, icon `eva`; nothing of the exit check); 13:00 `agenda.bioExperiment` / `agenda.bioExperiment.lab` ("Experimento de biología" · "Laboratorio"; no medication — Principle VI); 18:00 exercise. Spanish titles in `frontend/src/config/messages.es.ts`; update `frontend/tests/unit/agenda.test.ts`

**Checkpoint**: tokens, base components, connectivity and mission clock ready

---

## Phase 3: User Story 1 - Chequeo diario hablando (Priority: P1) 🎯 MVP

**Goal**: One tap starts a spoken check-in that asks sleep, mood and symptoms one at a time, reads the devices and works offline; the Home screen shows the header, "Ahora" and "Después".

**Independent Test**: On Home, tap "Empezar" (or Vita), answer the three questions by voice and reach the end without a keyboard; repeat with wifi off (CA6). Home shows "Hola, Ana", mission day and light phase, connectivity, "Ahora" and "Después".

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T040 [P] [US1] Write `frontend/tests/unit/parsing/spanishNumbers.test.ts`: `cero`…`veinticuatro` → 0–24, digits, "cinco horas" → 5, "siete y media" → 7.5, "veinte horas" → 20, nonsense → null
- [X] T041 [P] [US1] Write `frontend/tests/unit/parsing/parseUtterance.test.ts`: mood words ("mal" → 2, "bien" → 4, "muy bien" → 5), mood digits 1–5; symptoms "mareo" → `dizziness`, "desmayo" → `fainting`, "dolor de pecho" → `chest_pain`, "falta de aire" → `shortness_of_breath`, "no"/"ninguno" → `none`; control words `para` → pause, `sigue` → resume, `repite` → repeat; "sí"/"no" → confirm/deny
- [X] T042 [P] [US1] Write `frontend/tests/unit/checkin/reducer.flow.test.ts`: from `idle` a `start` event walks greeting → ask_sleep → ask_mood → ask_symptoms → measuring → evaluating → summary → next_activity → saved; `ask_sleep` emits `setFocus('sleep')` + `speak('ask.sleep')` + `listen(sleepGrammar)`; measuring emits device reads in order pressure → pulse → oxygen → temperature with `setFocus` for each; `pause`/`resume`/`repeat` work in every listening step
- [X] T043 [P] [US1] Write `frontend/tests/unit/buildHomeView.test.ts` (research R17): `header` = `crewName`, `missionDay`, `lightPhase`, `connectivity`, `avatarUrl` from mission + injected clock + connectivity; `now` = first item of today not yet past (the 09:30 check-in at 09:20; still the check-in at 09:35 while not done); `progress` = { done: earlier items, with the check-in counted only when today's record exists; total: items today }; `next` has at most 2 items; `pendingToday` = items after `now`; `status.verdict` is `'none'` with no check today
- [X] T044 [P] [US1] Write `frontend/tests/ui/home.test.tsx`: `HomeHeader` shows "Hola, Ana", "Día 23 · Luz 9/14" and "Sin internet · todo funciona" (offline) or "Conectado" (online) and the avatar; `NowCard` shows title, time, "1 min", progress and an "Empezar" button that calls `onStart`; `NextList` shows at most 2 rows and "{n} actividades pendientes hoy"; `BottomNav` shows Inicio active and Salud, Agenda, Guía disabled with "Próximamente" (FR-014, FR-015, FR-018)

### Implementation for User Story 1

- [X] T045 [P] [US1] Implement `frontend/src/domain/parsing/spanishNumbers.ts` (words 0–24, digits, "y media" adds 0.5) — make T040 pass
- [X] T046 [US1] Implement `frontend/src/domain/parsing/parseUtterance.ts` (`(step, transcript) => Observation | Intent | null`, deterministic, no AI) — make T041 pass
- [X] T047 [US1] Create `frontend/src/config/checkinScripts.ts` with the `daily` script as data per contracts/checkin-script.md (steps, message keys, grammars: sleep numbers 0–24 + "y media"; mood 1–5 + mood words; sí/no; symptom whitelist + no/ninguno; control words `para`, `sigue`, `repite` in every listening step; `[unk]`; focus per step); enable the `it.todo` in `frontend/tests/unit/messages.test.ts`
- [X] T048 [US1] Implement `frontend/src/domain/checkin/checkinReducer.ts` as a pure `(state, event) => { state, effects }` executing the script, which enters as a parameter (`createCheckinState({ script, ... })`; the domain never imports `config/`) (effects: `speak`, `listen`, `setFocus`, `readDevices`, `evaluate`, `save`, `showButtons`); `evaluate` is an injected function so US5 can plug in rules — make T042 pass
- [X] T049 [P] [US1] Implement `frontend/src/adapters/vosk/VoskRecognizer.ts` (`SpeechRecognizerPort`) with `vosk-browser`: `preload()` loads `/models/vosk/vosk-model-small-es-0.42.tar.gz` once (idempotent); `listen` creates a recognizer per call with the step grammar and resolves the final transcript or `null` on timeout; in dev, log end-of-speech → final-transcript latency
- [X] T050 [P] [US1] Implement `frontend/src/adapters/web-speech-tts/SpeechSynth.ts` (`SpeechSynthesizerPort`): voice with `lang` starting `es` and `localService === true`; if none, resolve immediately (captions carry the dialogue)
- [X] T051 [P] [US1] Implement `frontend/src/adapters/fakes/FakeVoice.ts` (`SpeechRecognizerPort` + `SpeechSynthesizerPort`): answers from an on-screen text input, or always `null` when the scenario voice is `never_understands`
- [X] T052 [US1] Implement `frontend/src/application/use-cases/runCheckin.ts` (runs reducer effects through the ports, feeds results back as events) and the hook `frontend/src/ui/useCheckin.ts`; wire the voice adapters in `frontend/src/composition-root.ts` and expose the wired ports to the UI through a React context in `frontend/src/ui/AppServices.tsx` (only `App.tsx` imports the composition root); the use case passes `checkinScripts.daily` from `config/` into the reducer; the `save` effect is a no-op until T093
- [X] T053 [US1] Implement `frontend/src/application/use-cases/buildHomeView.ts` (header, now, next, pendingToday; `status.verdict = 'none'` until US5) — make T043 pass
- [X] T054 [US1] Implement `frontend/src/ui/components/{HomeHeader,NowCard,NextList,BottomNav}.tsx` composing the base components (icons from `lucide-react`, text from `messages.es.ts`; disabled tabs with "Próximamente") — make T044 pass
- [X] T055 [US1] Implement `frontend/src/ui/screens/Home.tsx` from `buildHomeView`: calls `recognizer.preload()` on mount (model loading never counts against the 60 s); "Empezar" in `NowCard` (and the Vita button) navigates to `/checkin` and starts the check-in in one tap (RF1); subscribes to connectivity; `DemoScenarioSelect` in a discreet corner (FR-013); "Chequeo diario" wording (ui-build §3 #6)
- [X] T056 [US1] Implement `frontend/src/ui/screens/CheckIn.tsx`: caption of every spoken line, current question, paused and listening indicators
- [X] T057 [US1] Configure `vite-plugin-pwa` in `frontend/vite.config.ts`: precache the app shell, fonts, `public/logo.svg`, `public/avatars/**`, `public/models/**` (glb, png, vosk, draco) and `data/**`; `maximumFileSizeToCacheInBytes` = 60 MB; `registerType: 'autoUpdate'` (CA6, SC-009)

**Checkpoint**: Home and the spoken check-in run end to end offline. The verdict is still a placeholder and **nothing is saved yet** (persistence arrives in T093).

---

## Phase 4: User Story 2 - Confirmar lo que entendió (Priority: P1)

**Goal**: Every spoken number is read back and confirmed before it is stored; impossible values and failed recognition are handled.

**Independent Test**: Say "cinco horas" → "Escuché que dormiste 5 horas. ¿Es correcto?" before saving (CA2); "veinte horas" → asked again (RN4); scenario "Voz no entendida" → big buttons (CL1).

### Tests for User Story 2 ⚠️

- [X] T058 [P] [US2] Write `frontend/tests/unit/checkin/reducer.confirm.test.ts`: "cinco horas" → `speak('confirm.sleep', { hours: 5 })` and no `save` yet; "sí" → observation `confirmed: true`; "no" → back to `ask_sleep`; "veinte horas" → `speak('retry.sleep')`, same step, nothing stored; mood 0 or 6 → `retry.mood`; two `null` transcripts in one step → `showButtons(step)`

### Implementation for User Story 2

- [X] T059 [US2] Add `confirm_sleep` / `confirm_mood`, RN4 retry ("`sleep_hours` 0–16", "`mood` integer 1–5") and the 2-failures → buttons counter to `frontend/src/domain/checkin/checkinReducer.ts` and `frontend/src/config/checkinScripts.ts` — make T058 pass
- [X] T060 [US2] Implement `frontend/src/ui/components/BigButtons.tsx` (sleep hours **0–16** in 0.5 steps, mood 1–5, sí/no, symptom list + "ninguno"; targets ≥ 48 px) and show it from `frontend/src/ui/screens/CheckIn.tsx` on `showButtons` (CL1, RF12)

**Checkpoint**: No voice number reaches storage unconfirmed

---

## Phase 5: User Story 5 - Qué hacer hoy (Priority: P1)

**Goal**: A verdict (bien / atención / alerta) with one concrete action and the next activity; Home shows "Estado de Ana · Hoy: … · Ánimo n/5*".

**Independent Test**: Scenario "CA4": sleep 5 h, mood 4 → "atención" + "Dormiste poco: tómalo con calma" + "Lo próximo"; back on Home, "Hoy: Atención" appears once (CA4, RN5, RF10, SC-010).

### Tests for User Story 5 ⚠️

- [X] T061 [P] [US5] Write `libs/health-rules/tests/thresholds.test.ts`: every entry in `libs/health-rules/src/thresholds.ts` has a non-empty `source` unless `sourceStatus` is `team_criterion`; every sourced entry is `cited`; pulse green 60–100 cites AHA while the pulse amber/red bands are `team_criterion`; sleep green ≥ 7 h cites AASM/SRS while the 3-night red rule is `team_criterion`; other sources are AHA/ACC 2025 (BP), WHO Pulse Oximetry Training Manual (SpO₂), MedlinePlus (temp normal), CDC (fever), Mayo Clinic (hypothermia); mood is `team_criterion`
- [X] T062 [P] [US5] Write `libs/health-rules/tests/levels.test.ts` with RN1 cases: BP 118/76 green, 128/76 amber, 140/85 red, 135/92 red; pulse 72 green, 55 amber, 105 amber, 115 red, 48 without symptoms amber, 48 with `dizziness` red; temp 36.8 green, 37.5 amber, 38.0 red, 35.6 in_doubt, 34.8 red; SpO₂ 97 green, 92 amber, 88 red; sleep 7.5 green, 6.5 amber, 5 one night amber, < 6 two nights amber, < 6 three nights red; mood 5 green, 3 amber, 2 one day amber, ≤ 2 two days red
- [X] T063 [P] [US5] Write `libs/health-rules/tests/verdict.test.ts`: all green → `ok`; sleep 5 h rest green → `attention` + `action.slept_little`; blood pressure `unknown` rest green → `attention` + `action.missing_data` (never `ok`, CL2); two amber **values** → `alert`, including sleep 5 h + mood 3 on the same sensor; one `amber` + one `in_doubt` → `attention`; any `red` → `alert`; temp ≥ 38.0 → `alert`; all green + any of `dizziness`, `fainting`, `chest_pain`, `shortness_of_breath` → at least `attention`; sleep sensor `reason` is `mood` when mood sets the level; action priority red > fever > two amber > single amber > symptom > outside normal > in doubt > missing data
- [X] T064 [P] [US5] Write `frontend/tests/unit/scenarios/ca4.test.ts`: with demo scenario `ca4` (118/76, 72, 98, 36.8; prior nights [7.1, 7.4]; SC-011), run `checkinReducer` + `evaluateCheck` with sleep "cinco horas" → "sí", mood "cuatro" → "sí", symptoms "no" → verdict `attention`, action `action.slept_little`, sleep reading `amber` with `reason: 'sleep_hours'`
- [X] T065 [P] [US5] Write `frontend/tests/ui/statusHeader.test.tsx` and extend `frontend/tests/unit/buildHomeView.test.ts`: `StatusHeader` shows "Estado de Ana", one chip "Hoy: Atención" (the status word appears once — SC-010) and a chip "Ánimo 4/5*"; with no check today it shows "Sin chequeo hoy" and no mood chip; `buildHomeView` takes `status.verdict` and `status.mood` (`{ value, of: 5, level, teamCriterion: true }`) from today's last check (ui-build §3 #5)

### Implementation for User Story 5

- [X] T066 [US5] Create `libs/health-rules/src/thresholds.ts` (needs T009) with every RN1 range as data and the verified references: pressure (AHA/ACC 2025), pulse (60–100 AHA; 50–59, 101–110, > 110 and the < 50 symptom rule `team_criterion`), temperature 36,1–37,2 (MedlinePlus) / 37,3–37,9 / ≥ 38,0 (CDC), low band 35,0–36,0 → in_doubt, hypothermia < 35,0 → red (Mayo Clinic), oxygen ≥ 95 / 90–94 / < 90 (WHO), sleep ≥ 7 (AASM/SRS) / 6–6,9 / < 6 with `consecutiveForRed: 3` (red rule `team_criterion`), mood 4–5 / 3 / ≤ 2 with `consecutiveForRed: 2` (`team_criterion`) — make T061 pass
- [X] T067 [US5] Implement `libs/health-rules/src/levels.ts` (`levelFor(indicator, value, { history, symptoms })`, consecutive-day logic from RN1/RN2) — make T062 pass
- [X] T068 [US5] Implement `libs/health-rules/src/verdict.ts` and `libs/health-rules/src/evaluateCheck.ts` (`{ observations, symptoms, history } → { readings, verdict, actionKey }`; sensor level = worst of its indicators, `reason` = the indicator that set it, and `teamCriterion` = whether a team-criterion band set it (add the field to `SensorReading` in `libs/contracts/src/entities.ts` per data-model.md); two-amber counts indicator values; symptoms → at least attention; `outsideNormal` false until US4); export from `libs/health-rules/src/index.ts` and inject into the reducer's `evaluate` — make T063 and T064 pass
- [X] T069 [US5] Add to `frontend/tests/unit/checkin/reducer.flow.test.ts` (test first, must fail): body temperature 35,6 °C → one extra thermometer read; still 35,6 → temperature `in_doubt` with `reason: 'body_temperature'`
- [X] T070 [US5] Implement the RN1 low-temperature re-read in `frontend/src/domain/checkin/checkinReducer.ts` — make T069 pass
- [X] T071 [US5] Write `frontend/tests/ui/VerdictPanel.test.tsx` first (verdict label, exactly one action, "Lo próximo"; full note "criterio del equipo, no clínico" only when the action comes from mood), then implement `frontend/src/ui/components/VerdictPanel.tsx` and show it in `CheckIn.tsx` at `summary` / `next_activity` (RF9, RF10, Principle VIII)
- [X] T072 [US5] Implement `frontend/src/ui/components/StatusHeader.tsx` and the `status.verdict`, `status.mood` and minimal `status.readings` (`sensor`, `value`, `level`, `reason`, `teamCriterion`) part of `buildHomeView`; mount `StatusHeader` on Home — make T065 pass (FR-016, SC-010)

**Checkpoint**: P1 complete — sourced, reproducible verdict on the check-in and on Home

---

## Phase 5b: Home layout per mockup (blocking for Phases 6–7 on Home)

**Goal**: The Home screen has the structure of `docs/design/home-mockup.png` (with the overrides of `docs/design/README.md`).

**Independent Test**: Screenshot of Home at 1280×800 next to `docs/design/home-mockup.png`: same header, 4/8 grid, card order and floating dock with the central Vita button.

- [X] T072a [US5] Home layout per mockup (references: `docs/design/home-mockup.png`, `docs/design/README.md`, `docs/design/stitch-home.html` as visual guide only, `docs/base-vital-ui-build-spec.md` §3–§4): content centered, `max-width` 1280 px; compact one-line header (40 px avatar + "Hola, Ana" left; chips "Día 23 · Luz 9/14" and connectivity right); the "Escenario de demo" selector small in a corner, not in the header; 12-column grid — left 4 columns with "Ahora" on top and "Después" below, right 8 columns with the "Cómo estás" card at full height (body area 40 % + metrics card 60 %); "Empezar" a normal pill button right-aligned in the "Ahora" footer (not full width); floating bottom dock centered, `max-width` 900 px, tabs Hoy · Salud · Agenda · Guía with Vita as a raised 64 px circular button in the center; remove the full-width "Vita" button; disabled tabs show only a gray icon and name, "Próximamente" in the tooltip (`title`) (FR-018); until the 3D body exists, "Cómo estás" shows the metrics card (`StatusHeader`, "Sin chequeo hoy" when there is none) and a reserved space for the body; tests updated. Acceptance: screenshot at 1280×800 compared with `home-mockup.png` by the reviewer

- [X] T072b [US5] Home corrections (review of 2026-11-15 screenshot): remove the loose "Historial" link; "Ver historial →" in the "Estado de Ana" card header and "Salud →" also opens the history while the Salud tab is disabled; an agenda item counts as done only when it was really completed (the daily check-in stays in "Ahora" until today's check is saved, even after its time; other items have no completion in 001, so they are never done) — with a test; "Estado de Ana" without a check shows the 5 rows with "—" and the legend at the bottom (docs/design/README.md); "1 actividad pendiente" / "N actividades pendientes" from `messages.es.ts`; keep the "Cómo estás" split 40 % body / 60 % metrics with the status pills inside the card

**Checkpoint**: Home has the mockup's structure; Phases 6–7 fill the body and the metric rows

---

## Phase 6: User Story 3 - Cuerpo 3D con sensores (Priority: P2)

**Goal**: A rotatable 3D body with one colored dot per sensor, on Home and during the check-in, highlighting the sensor being discussed and marking altered ones with their reason.

**Independent Test**: Rotate the body — each dot stays on its spot (CA5); while Vita asks about sleep the forehead dot is highlighted (CA3); without WebGL a local image with the same dots appears (CL5).

### Tests for User Story 3 ⚠️

- [X] T073 [P] [US3] Write `frontend/tests/ui/SensorDot.test.tsx`: fill is `SENSOR_COLORS[sensor]`; `green` → no ring and no status label; `amber`/`red` → ring in `LEVEL_COLORS[level]` AND label "{reason} · {level}" (the "*" mark when `teamCriterion` is true — e.g. "Ánimo · atención*", "Pulso · alerta*"; "Sueño · atención" without mark for one short night) (RN6, Principle VIII); `focus` → halo class; `measuring` → spinning-ring class; `in_doubt` → dashed ring + "en duda"; `unknown` → grey dot + "sin dato"; clicking calls `onSensorTap(sensor)` (state, no DOM manipulation — ui-build §3 #3)

### Implementation for User Story 3

- [X] T074 [P] [US3] Write `frontend/scripts/blender/create_sensor_empties.py` (run `blender --background --factory-startup --python frontend/scripts/blender/create_sensor_empties.py -- <in.obj> <out_dir>`; input is the MakeHuman OBJ in `frontend/scripts/blender/source/`): keep only group `body`, join into `body` into `body`, material `skin_pearl` (`#D9DDE2`, roughness 0.6), decimate to ≤ 30k triangles, empties `sensor_sleep` (forehead), `sensor_pulse` (left chest), `sensor_pressure` (right upper arm), `sensor_temperature` (navel), `sensor_oxygen` (right index fingertip) offset ~2 mm along the normal, optional `camera_default`, apply transforms, export glTF Binary (+Y up, Draco 6, no animation) to `frontend/public/models/body.glb`, render `frontend/public/models/body-fallback.png` from `camera_default` and print the 5 projected 2D dot positions as percentages
- [X] T075 [P] [US3] Write `frontend/scripts/check-model.ts` using `@gltf-transform/core` + Draco extension: fail if `body` or any `sensor_*` node is missing, triangles > 30 000, file > 3 MB, or any sensor node is farther than 3 cm from the `body` surface (contracts/body-glb.md)
- [X] T076 [US3] Use the MakeHuman (CC0) hm08 base mesh (`frontend/scripts/blender/source/makehuman-base-hm08.obj`, group `body` only), run T074 with `/snap/bin/blender --background --factory-startup --python frontend/scripts/blender/create_sensor_empties.py -- frontend/scripts/blender/source/makehuman-base-hm08.obj frontend/public/models` to produce `frontend/public/models/body.glb` and `body-fallback.png`, run `npm run check:model` until it passes, write the printed positions into `FALLBACK_DOTS` in `frontend/src/config/constants.ts`, and verify and record the MakeHuman license in `frontend/data/SOURCES.md`
- [X] T077 [US3] Implement `frontend/src/ui/body3d/SensorDot.tsx` (10 px dot in sensor color with 2 px white outline; altered → 14 px + pulsing ring in level color + "{reason} · {level}" label; focus halo; measuring spinner; dashed ring for in_doubt; respects `prefers-reduced-motion`; `onSensorTap`) — make T073 pass
- [X] T078 [US3] Implement `frontend/src/ui/body3d/BodyViewer.tsx` (props `readings`, `focus`, `onSensorTap`) with React Three Fiber + drei: `useGLTF('/models/body.glb')` with local Draco path `/models/draco/`, world positions of `sensor_${key}` read once, `<Html position occlude>` `SensorDot` per sensor with leader line (labels on the screen side away from the body centre), `OrbitControls` rotate only, azimuth ±60°, no zoom, no pan, no auto-rotate
- [X] T079 [US3] Implement `frontend/src/ui/body3d/BodyFallback.tsx` (local PNG + positioned `SensorDot`s from `FALLBACK_DOTS`) and the switch in `BodyViewer.tsx`: WebGL unavailable or model not loaded within 3 s → fallback (CL5, ui-build §3 #2)
- [X] T080 [US3] Mount `BodyViewer` in `CheckIn.tsx` (fed by `BodyView` from `useCheckin()`) and in the Home status card (fed by `HomeView.status.readings`, `focus` = the tapped dot's sensor (selected sensor)); when any element on the screen carries the "*" mark, render `team.criterion.note` exactly once on that screen

- [ ] T080a [US1] Check-in screen as a chat with Vita (UI only; reducer logic unchanged; tokens, existing components, text only in `messages.es.ts`): Vita messages left (white bubble + round avatar with the Vita button icon), Ana's answers right (primary bubble, white text), all messages of the check-in in order with auto-scroll to the last; live transcript in a dashed right bubble ("cinco horas…") that turns solid when confirmed; confirmations with context and unit ("Escuché que dormiste 5 horas. ¿Es correcto?", "Escuché que tu ánimo es 1 de 5. ¿Es correcto?") plus grey hint "Di «sí» o «no»"; quick-reply chips under the last Vita message (confirm: 👍 Sí · 👎 No; mood: 1–5 with its word below, muy mal … muy bien; symptoms: the 5 chips Ninguno · Mareo · Desmayo · Dolor de pecho · Falta de aire, one tap) sending the same events as voice; the big fallback buttons use the same chip style, large; controls top-right of the conversation: round 48 px buttons on the track background (`#E8F1FE` token) with a large emoji and the word below in 13 px — ✋ Pausa · ☝️ Repetir; while paused ✋ Pausa is replaced by ▶️ Seguir; below them in grey "También puedes decir «para» o «repite»"; every button and chip has an `aria-label` with its word from `messages.es.ts`; progress "Pregunta n de 3 · {tema}" with a thin bar; mic indicator: pulsing blue circle + "Te escucho…" while listening, grey + "Vita está hablando…" while speaking; layout at 1280×800: conversation 60 % left, 3D body 40 % right, vertically centred, current sensor highlighted with its name below ("Sueño"), nothing touching the edges; at the end the verdict is Vita's last message with the status label, the action and a "Volver al inicio" button. Tests: all messages in order; confirmations include value and unit; chips dispatch the same events as voice. Update quickstart.md CA2 text. Reviewer compares a 1280×800 screenshot

**Checkpoint**: The body shows which sensor is discussed and which is altered, and why

---

## Phase 7: User Story 4 - Medida contra rango y contra "tu normal" (Priority: P2)

**Goal**: Each value shown as a metric row with its range bar and "tu normal" mark, on Home and during the check-in; 14 simulated days of history.

**Independent Test**: Each row shows value, range bar with zones, today's marker on its value and the "tu normal" bracket (CA7, SC-013); tapping a dot highlights its row (SC-012); the legend is at the bottom (SC-010).

### Tests for User Story 4 ⚠️

- [ ] T081 [P] [US4] Write `libs/health-rules/tests/baseline.test.ts`: mean and SD "from the first 14 days only; fixed afterwards"; fewer than 14 days → `ready: false`; systolic and diastolic separate; baseline 62 ± 3 and the last 3 check-ins at 72 → `outsideNormal: true` → `attention` even though 72 is in range (RN3); 14 identical values → `sd` equals `MIN_SD[indicator]`, never 0, and a reading 1 unit away is not `outsideNormal`
- [ ] T082 [P] [US4] Write `frontend/tests/unit/checkin/reducer.cl4.test.ts`: mood ≥ 4 with pulse outside normal → mood asked once more; same answer → mood `in_doubt` (→ attention); a different answer is used normally
- [ ] T083 [P] [US4] Write `frontend/tests/unit/rangeBarLayout.test.ts` for the pure `computeRangeBar({ sensor, value, baseline, scale })`: zone segments (red / amber / allowed) come from `thresholds.ts` as percentages of the scale; marker % equals `(value − min) / (max − min)` (118 on [90, 160] → 40 %); baseline bracket % or `null` when not ready; values outside the scale are clamped (ui-build §3 #4)
- [ ] T084 [P] [US4] Write `frontend/tests/ui/metrics.test.tsx`: `MetricRow` (composes `StatCard`) shows label, value in neutral color, unit, `Badge` with level, "equipo simulado" for device values, and is highlighted when `highlighted`; `RangeBar` renders the zones, the marker and the "tu normal" bracket (hidden with "Aún aprendo tu normal" when not ready; allowed zone `#4A90E2` via token class); `Legend` renders the level labels and "* Ánimo: criterio del equipo, no clínico"

### Implementation for User Story 4

- [ ] T085 [US4] Implement `libs/health-rules/src/baseline.ts` (`computeBaseline(history)` with `sd = max(computed, MIN_SD[indicator])`, `isOutsideNormal(indicator, last3)`) and use it in `evaluateCheck.ts` — make T081 pass; T064 must still pass
- [ ] T086 [US4] Add the CL4 re-ask (once) to `frontend/src/domain/checkin/checkinReducer.ts` after measuring — make T082 pass
- [ ] T087 [P] [US4] Write `frontend/scripts/data/extract-sleep-edf.py` (needs T008; `python3 -I`; input path as argument) deriving 14 nightly total-sleep values from Sleep-EDF hypnograms into `frontend/data/sleep-history.json` (`{ "source": "PhysioNet Sleep-EDF", "hours": [...] }`, no subject IDs); commit the JSON
- [ ] T088 [US4] Implement `frontend/src/application/use-cases/seedHistory.ts`: 14 `CheckRecord`s with `simulated: true` from the active demo scenario (sleep from `frontend/data/sleep-history.json` with the last two nights replaced by the scenario's `priorNights`; pulse from `pulseSeriesFor`; other vitals with fixed-seed variation around the scenario values — BP ±4/±3, temp ±0.2, SpO₂ ±1 — staying in green; mood 4–5), evaluated with `evaluateCheck`; run `seedIfEmpty` at startup and pass it as `reseed` to `DemoScenarioSelect`; extend `ca4.test.ts` to use this history (baseline active) and still expect `attention` + `action.slept_little`
- [ ] T089 [US4] Add `UI_SCALES` to `frontend/src/config/constants.ts` (pressure [90, 160] mmHg, pulse [40, 130] lpm, oxygen [85, 100] %, temperature [35, 39] °C, sleep [0, 10] h; units) and implement `frontend/src/ui/components/rangeBarLayout.ts` — make T083 pass
- [ ] T090 [US4] Implement `frontend/src/ui/components/{RangeBar,MetricRow,Legend}.tsx` — make T084 pass
- [ ] T091 [US4] Extend `buildHomeView`'s `status.readings` (from T072) with unit, marker, scale, `allowedLabel` derived from thresholds, source and baseline (FR-016, SC-011) and render the Home status card: `StatusHeader` on top, `BodyViewer` + one `MetricRow` per reading, `Legend` at the bottom; the same rows on `CheckIn.tsx`; tapping a dot highlights its row and the focused sensor's row is highlighted (state, FR-017, SC-012)

**Checkpoint**: Values are read against the guideline and against the person's own normal

---

## Phase 8: User Story 6 - Historial con origen (Priority: P3)

**Goal**: Every check-in is saved with the source of each value and listed in a history.

**Independent Test**: Finish a check-in, open Historial — today's record shows each value with "voz" or "equipo"; the 14 seeded days show "simulado" (CA8).

### Tests for User Story 6 ⚠️

- [X] T092 [P] [US6] Write `frontend/tests/ui/History.test.tsx` with `MemoryCheckRepository`: newest first; each value shows its source (voz / equipo); seeded records show "simulado"; verdict label per record; mood values carry the "*" mark and `team.criterion.note` appears exactly once

### Implementation for User Story 6

- [X] T093 [US6] In `frontend/src/application/use-cases/runCheckin.ts`, make the `save` effect build the full `CheckRecord` (observations with `source`, symptoms, readings snapshot, verdict, `actionKey`, `simulated: false`) and persist it via `CheckRepositoryPort`; Home refreshes `HomeView` after saving
- [X] T094 [US6] Implement `frontend/src/ui/screens/History.tsx` (route `/historial`) listing records with date, verdict label, each value + source, the "simulado" tag, the "*" mark on mood values and `team.criterion.note` once at the bottom — make T092 pass

**Checkpoint**: All user stories work independently

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T095 Add dev-only timing in `frontend/src/application/devMetrics.ts`: full check-in from the tap to `saved` ≤ 60 s (SC-001), end of speech → final transcript ≤ 800 ms, prompt end → listening ≤ 300 ms; show the last run in a dev overlay; check 3D ≥ 30 fps on the demo tablet; fix regressions
- [X] T095a Split the Vosk model into parts < 25 MiB for Cloudflare Pages (005 FR-015): `frontend/scripts/split-model.ts` writes `frontend/public/models/vosk/parts/*.part` + `manifest.json` (part names, sizes, SHA-256 of the whole); the original `.tar.gz` moves out of `public/` so no published file exceeds 25 MiB; `VoskRecognizer` fetches the manifest and parts (precached by the service worker), checks the hash, joins them into a Blob URL and passes it to `createModel`; a missing/corrupt part → model unavailable (captions + big buttons); build fails if any file in `dist/` is ≥ 25 MiB
- [ ] T096 [P] Write `README.md` at the root (what it is, workspaces, how to run, the "Escenario de demo" selector, `?fake=voice` for developers, data/model/font licenses, threshold sources, "no diagnostica", backend arrives with 004)
- [ ] T097 Run every scenario in `specs/001-chequeo-diario-voz-cuerpo/quickstart.md` on the demo tablet with the in-app selector, including the Home visual checks (SC-009 – SC-013) with the network unplugged and the local Spanish TTS voice check; record results in the same file

---

## Dependencies & Execution Order

- **Setup (Phase 1)** and **Foundational (Phase 2)**: done except T020 (partial). T008 gates T020 and T087; T009 (done) gated T066.
- **Phase 2b (restructure)**: blocks everything after it. T027 → T028 → T029 → T030 → T031, strictly in order.
- **Phase 2c (UI foundation)**: after 2b; blocks the Home components (T054, T072, T080, T090, T091).
- **US1 (Phase 3)**: after 2c.
- **US2 (Phase 4)**: after US1 (extends `checkinReducer.ts` and `CheckIn.tsx`).
- **US5 (Phase 5)**: after US1 and T009; independent of US2.
- **US3 (Phase 6)**: T073–T077 can start right after 2c; T080 needs US1 (`useCheckin`) and T072 (minimal `status.readings`).
- **US4 (Phase 7)**: after US5 (`evaluateCheck`, `thresholds.ts`) and US3 (Home status card).
- **US6 (Phase 8)**: after US1; seeded "simulado" rows need T088.
- **Polish (Phase 9)**: after the desired stories.

### Within each story

- Tests first; they must fail before implementation.
- libs → domain → application → adapters/UI.
- Tasks touching `checkinReducer.ts` (T048, T059, T070, T086) and `buildHomeView.ts` (T053, T072, T091) are sequential.

### Parallel opportunities

- 2c: T032, T034, T035, T037, T038 together.
- US1: tests T040–T044 together; adapters T049, T050, T051 together.
- US5: tests T061–T065 together.
- US3: T074 (Blender) and T075 (check script) alongside US2/US5.
- US4: T081, T082, T083, T084, T087 together.

---

## Implementation Strategy

### MVP first

1. Phase 2b (restructure) → Phase 2c (UI foundation).
2. US1 (Home + spoken check-in) → US2 (confirmation) + US5 (verdict + status header) → the P1 MVP: CA1, CA2, CA4, CA6, SC-010 pass.
3. **STOP and VALIDATE** with quickstart.md.

### Incremental delivery

1. P1 MVP.
2. US3 3D body (start the Blender work T074–T076 early) → CA3, CA5, CL5.
3. US4 metric rows + "tu normal" → CA7, CL3, CL4, SC-012, SC-013.
4. US6 history → CA8.

### Model routing

See CLAUDE.md "Model routing": every task goes to `implementer` one at a time; T009 (and any task that needs internet) stays in the main session; `reviewer` after each phase.

---

## Notes

- Not in this feature (spec / Principle III): camera fatigue, exit check, gestures, auto-start, WESAD evaluation script (`003-medicion-wesad`), backend and flight-surgeon sync (`004-resumen-cirujano`), Salud/Agenda/Guía screens.
- [P] tasks = different files, no dependencies.
- Stop at any checkpoint to validate the story independently.
