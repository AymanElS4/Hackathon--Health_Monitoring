# Research: Daily voice check-in with 3D body (001)

Phase 0 output. Inputs: `spec.md` (clarified 2026-11-14), the constitution v1.1.0, the stack in
`base-vital-speckit.md` §4 and `base-vital-voice-blender-integration-spec.md` (v2, "integration spec").
Rule of precedence used here: **spec.md (with its clarifications) > integration spec > this plan**.
Where the integration spec disagrees with a clarified spec decision, the spec wins and the conflict is
listed in §A.

## A. Conflicts between the integration spec and the clarified spec

| # | Integration spec says | Clarified spec says | Decision |
|---|---|---|---|
| A1 | `sleep` sensor includes `face_fatigue` (camera) | Camera is out of scope; sources are voice and device only | Drop `face_fatigue` from `INDICATORS` and `SENSOR_INDICATORS` for this feature. |
| A2 | Check-in may start "automatically at the Chequeo diario item" | Always started by one tap; agenda only shows it as "Lo próximo" | Tap only. No timer, no auto-start. |
| A3 | `LEVEL_COLORS` reuse sensor hexes (green = oxygen `#4A90E2`, amber = sleep `#F2A93B`, red = pulse `#E5675A`) | RN6: one color never means both things | Sensor colors changed so none resembles amber, red or green (user decision 2026-11-14). See §R7. |
| A4 | §5.3 exit script, gestures 👍 ✋ ☝️, MediaPipe | Out of scope (feature 002) | Not built. The reducer stays script-driven so 002 can add a script later, but no exit script ships. |
| A5 | §7 #9 WESAD evaluation script (pitch number) is P0 | Not in spec; base doc lists it as feature `003-medicion-wesad` | Not in this feature (Principle III). |
| A6 | §7 #7 full home screen from Stitch mockup (Ahora · Después · Cómo estás), #11 Salud trend screen, #13 Agenda screens | Spec only requires: start with one tap, "Lo próximo", history with sources | **Updated 2026-11-15**: the Home screen is built per `docs/base-vital-ui-build-spec.md` and spec FR-014–FR-019 (now in the spec). Salud, Agenda and Guía screens are still not built; their tabs are visible but disabled. |
| A7 | Step 7 line "Lo próximo: chequeo de salida a las 09:30" | Exit check is out of scope | The line is generated from the agenda data. **Updated 2026-11-15**: the demo agenda may list an EVA as a plain activity (title and time only, as in the data mapping); nothing of the exit check (feature 002) is built. |

## B. Decisions

### R1. App shape (superseded 2026-11-15 by R15)
- **Original decision**: one Vite + React 18 SPA at the repo root with folders `domain`,
  `application`, `adapters`, `ui`. Phases 1–2 were built this way.
- **Now**: npm workspaces `libs/contracts`, `libs/health-rules`, `frontend/` (R15); the same light
  hexagonal layers live inside `frontend/src/`.

### R2. Offline after first load (Principle VII, CA6)
- **Decision**: `vite-plugin-pwa` (Workbox) precaches the app shell, `body.glb`, fallback PNG, data
  JSON and the Vosk model; `maximumFileSizeToCacheInBytes` raised to 60 MB for the model.
- **Rationale**: only way a web app keeps working with wifi off after the first load.
- **Alternatives**: Electron/Tauri wrapper — rejected (more complexity, no gain for the demo).

### R3. Speech recognition
- **Decision**: `vosk-browser` with `vosk-model-small-es-0.42` (~40 MB, Apache-2.0), served from
  `public/models/vosk/`, recognizer in its Web Worker. One grammar per step (numbers, yes/no,
  symptoms, control words `para`, `repite`) plus `[unk]`.
- **Sleep grammar covers 0–24** (not 0–16 as in the integration spec) so that "veinte horas" is
  recognized and rejected by RN4 ("valor imposible → se pide de nuevo"); valid sleep is 0–16 h.
- **Rationale**: runs fully offline; grammars make short Spanish answers reliable.
- **Alternatives**: Web Speech API recognition — rejected: in Chrome it is cloud-based (breaks VII).

### R4. Speech synthesis
- **Decision**: `window.speechSynthesis`, picking a voice with `lang` starting `es` and
  `localService === true`. Every spoken line is also shown as an on-screen caption.
- **Risk**: some devices have only network voices. If no local Spanish voice exists, Vita stays silent
  and captions carry the dialogue; the check-in still completes. Verify on the demo tablet.
- **Alternatives**: pre-recorded audio — rejected: read-backs include dynamic numbers.

### R5. Interpreting answers (no AI)
- **Decision**: deterministic `parseUtterance(stepKind, transcript)` → `Observation | Intent | null`.
  Spanish number words 0–24 (`cero`…`veinticuatro`), digits, "y media" (+0.5), mood words mapped to
  1–5 (e.g., "mal" → 2, "bien" → 4), symptom whitelist, control words.
- **Rationale**: testable with plain unit tests; satisfies RF3.

### R6. 3D body
- **Decision**: Blender model per integration spec §3 (names are the API), loaded with
  `@react-three/fiber` v8 + `@react-three/drei` v9 (`useGLTF`, `Html`, `OrbitControls`), Draco decoder
  bundled locally (not from a CDN, for offline). Fallback PNG with fixed 2D dot positions in
  `config/constants.ts` when WebGL is unavailable or the model takes > 3 s (CL5).
- **Blender automation**: `scripts/blender/create_sensor_empties.py` creates/positions the 5 empties
  on a joined `body` mesh and exports with the settings of integration spec §3.4;
  `scripts/check-model.ts` enforces §3.5 (nodes present, ≤ 30k triangles, ≤ 3 MB, sensors ≤ 3 cm from
  the surface).
- **Model source**: MakeHuman export (CC0); license recorded in `data/SOURCES.md`.

### R7. Two color tables (RN6) — resolves A3
- **Decision** (user, 2026-11-14): change the sensor colors, keep warm/green hues for status only.
  - `SENSOR_COLORS` (identity): sleep indigo `#5B5FD6`, pulse magenta `#D946A8`, pressure violet
    `#9D5CE6`, temperature teal `#14A3A0`, oxygen sky `#38A3E8`.
  - `LEVEL_COLORS` (status): green = **no ring**, label slate `#64748B`; amber `#F2A93B`;
    red `#E5484D`; in_doubt `#9AA5B1` (dashed ring); unknown `#C9D2DC` (grey dot).
  - Only an altered sensor gets a status-colored ring, always with its label.
  - A unit test asserts the two tables share no value.
- **Alternatives**: keep integration-spec sensor colors and pick new status colors — rejected: amber
  and red stayed too close in hue to the old sleep/pulse colors.

### R8. Station devices (RF5) and data sources (Principle V)
- **Decision**:
  - Pulse: resting heart-rate series derived once from WESAD (wrist BVP/chest ECG, baseline
    segments) by `frontend/scripts/data/extract-wesad-hr.py`, committed as
    `frontend/data/wesad-hr.json`. **Updated 2026-11-15**: today's pulse in every demo scenario is the
    fixed scenario value (data mapping §4) so each scenario is deterministic; the WESAD series feeds
    the seeded 14-day history (variation around the scenario value).
  - Sleep history (14 simulated days): nightly totals from PhysioNet Sleep-EDF hypnograms by
    `scripts/data/extract-sleep-edf.py` → `data/sleep-history.json`.
  - Blood pressure, SpO₂, body temperature: seeded random values inside realistic ranges, declared
    as simulated in the UI ("equipo simulado") and in `data/SOURCES.md`.
- Only derived numeric series are committed, never raw files or subject IDs.
- **Verify first**: WESAD's license terms (academic, non-commercial use) and Sleep-EDF's (ODC-By)
  are checked and recorded in `data/SOURCES.md` before any data is extracted.
- Device values per scenario are fixed (R14), so the demo is deterministic. Data paths moved under
  `frontend/data/` and `frontend/scripts/` (R15).

### R9. Thresholds as data with sources (Principle VIII, constitution v1.1.0)
- **Decision**: `libs/health-rules/src/thresholds.ts` holds every range of RN1 with a `source` and a
  `sourceStatus: 'cited' | 'to_verify' | 'team_criterion'`:
  pressure, pulse → `cited` (AHA/ACC 2025, AHA); sleep → `cited` (AASM/SRS);
  pulse bands outside 60–100 and the sleep 3-night red rule → `team_criterion` (user decision
  2026-11-15); oxygen → WHO Pulse Oximetry Training Manual; temperature normal 36,1–37,2 → MedlinePlus;
  fever ≥ 38,0 → CDC; amber 37,3–37,9 → between MedlinePlus normal and CDC fever;
  hypothermia < 35,0 → Mayo Clinic (standard clinical definition); mood → `team_criterion`, shown
  in the app as "criterio del equipo, no clínico".
- **Verification comes first**: the sources are checked against the original documents in the
  Foundational phase, before `thresholds.ts` is written. If a verified source gives another value,
  the value is corrected in spec RN1 first, then in code.
- A unit test fails if any threshold has neither `source` nor `team_criterion`.

### R10. Rule details (accepted by the user 2026-11-14, now in spec Clarifications)
- **Temperature below 36,1 °C** (now in RN1): 35,0–36,0 °C → `in_doubt` and the thermometer is read
  once more; < 35,0 °C → `red` (hypothermia, Mayo Clinic, verified in the Foundational phase before
  `thresholds.ts` is written).
- **"Two amber at once" (RN5)** counts **indicator values** in `amber`, not sensors (sleep 5 h +
  mood 3 = two amber → alert); `in_doubt` and `unknown` make the verdict at least atención but do
  not count toward the two-amber alert.
- **Symptoms (RN5)**: any of `dizziness`, `fainting`, `chest_pain`, `shortness_of_breath` → verdict at
  least `attention`, with its own action text (no diagnosis, Principle VI).
- **Dot label (RN6)**: an altered dot shows "{reason} · {level}", where reason is the indicator
  that set the level (e.g., "Ánimo · atención*" on the forehead dot).
- **Team-criterion display (Principle VIII, v1.1.0)**: wherever a mood result appears in short form
  (dot label, history row) it carries a "*" and the screen shows "* criterio del equipo, no clínico"
  once. The mood metric card and the verdict panel (when the action comes from mood) show the full
  note inline.
- **Baseline SD floor (RN3)**: `sd = max(computed, MIN_SD[indicator])`, with `MIN_SD` in
  `libs/health-rules/src/constants.ts`: sleep 0.5 h, mood 0.5, resting HR 3 bpm, systolic 4 mmHg, diastolic
  3 mmHg, body temperature 0.2 °C, SpO₂ 1 %. Seeded history also varies slightly and
  deterministically (fixed seed) around the scenario values: HR ±3, BP ±4/±3, temp ±0.2, SpO₂ ±1.
- **"Tu normal" (RN3)**: mean and standard deviation of the first 14 days, fixed afterwards; applies to
  every numeric indicator (systolic and diastolic separately). "3 lecturas seguidas" = the last 3
  daily check-ins including today.
- **CL4**: if the mood answer is ≥ 4 and today's pulse is outside "tu normal" (> 2 SD), mood is
  `in_doubt` and Vita asks once more; if the answer repeats, it stays `in_doubt` (→ atención).
- **Ordering of the verdict action**: red > fever > two amber > single amber > outside normal >
  in doubt > missing data; the first match picks the single action text.

### R11. Storage
- **Decision**: IndexedDB through `idb` (tiny wrapper); one store `checks`, key = ISO date-time.
  On first run, the 14 simulated days are seeded and flagged `simulated: true`.
- **Alternatives**: localStorage — rejected (size, no structured queries).

### R12. Testing
- **Decision**: Vitest for domain/parser/reducer/thresholds (written first, as the base doc asks for the
  domain), React Testing Library for a few UI states, fake adapters for voice/devices.
  Acceptance (CA1–CA8) is checked by hand per `quickstart.md` (Principle IV).
- **Alternatives**: Playwright e2e — rejected for now (mic and WebGL make it brittle; not needed for IV).

### R14. Demo scenarios (FR-013, Principle IV)
- **Decision** (values updated 2026-11-15 to `docs/base-vital-home-data-mapping.md` §4):
  `frontend/src/config/demoScenarios.ts` defines five deterministic scenarios, chosen from a visible
  "Escenario de demo" selector on Home (persisted per device). Prior nights listed as
  [yesterday, the day before]:
  - `normal`: BP 112/72, pulse 64, SpO₂ 98, temp 36,6; prior nights [7.2, 7.8]; expected answers
    sleep 7,5 h, mood 4 → Bien.
  - `ca4`: BP 118/76, pulse 72, SpO₂ 98, temp 36,8; prior nights [7.1, 7.4]; CA4 answers sleep 5 h,
    mood 4 → Atención, "Dormiste poco: tómalo con calma".
  - `missing_sensor`: **blood pressure sends nothing**; pulse 66, SpO₂ 97, temp 36,7; prior
    [7.0, 7.6] → never Bien (CL2).
  - `low_temp`: BP 114/74, pulse 66, SpO₂ 97, temp 35,6; prior [7.1, 7.5] → en duda, re-measure.
  - `voice_not_understood`: devices as `normal`; the recognizer returns nothing twice (CL1 → big
    buttons).
- Device adapters read their values from the active scenario; the seeded 14-day history is built
  from the scenario too, so CA4 gives "atención" every time.
- Changing the scenario clears the history and re-seeds the 14 simulated days; the selector shows an
  inline warning ("Cambiar de escenario reinicia el historial") and a confirm button before it
  switches (no browser dialog).
- `?fake=voice` stays as a developer-only switch for running without a microphone.

### R15. Repository split (ui-build D1, constitution 1.2.0)
- **Decision**: npm workspaces `libs/contracts` (`@base-vital/contracts`), `libs/health-rules`
  (`@base-vital/health-rules`) and `frontend/` (`@base-vital/frontend`). `backend/` is created by
  feature 004, not here. Existing root code is moved in a dedicated restructure phase (no behaviour
  change; all tests must still pass). `MIN_SD` moves to `libs/health-rules/src/constants.ts`
  because `computeBaseline` lives in that package; `SENSOR_COLORS`/`LEVEL_COLORS` stay in
  `frontend/src/config/constants.ts`.
- Ports keep their current names (contracts/ports.md) and move to one file each under
  `frontend/src/application/ports/`; `ConnectivityPort` is added; `SyncGateway` belongs to 004.
  `container.ts` becomes `composition-root.ts`; adapters move to the ui-build §1 folder names.
- **Alternatives**: keep one app — rejected because 004 must reuse contracts and rules unchanged.

### R16. Design tokens, styling, fonts, icons (ui-build §2, §3 #1)
- **Decision**: `frontend/src/config/design-tokens.ts` is the single token source (DESIGN.md values
  kept in ui-build §2, plus the spec overrides). Tailwind CSS 3 is compiled at build time with its
  theme generated from the tokens; no hex literals inside `frontend/src/ui/**` (test). Inter is
  self-hosted with `@fontsource/inter`; icons are `lucide-react` SVG components (bundled, no icon
  font, no CDN); logo and a generic avatar live in `frontend/public/`.
- `LEVEL_COLORS.green` gains a badge background `#EEF2F6` (slate text `#64748B`). The range-bar
  allowed zone uses `#4A90E2` as a zone color, not a status badge. Smallest text 13 px.
- **Alternatives**: Material Symbols font self-hosted — rejected: a font subset needs tooling and
  is heavier than tree-shaken SVG icons.

### R17. Home view model (data mapping §1–§2)
- **Decision**: a pure use case `buildHomeView({ now, agenda, lastCheck, history, connectivity,
  mission })` returns one `HomeView` (data-model.md). Rules:
  - `now` = the first agenda item of today whose time is not yet past, else the last item;
    `progress` = { done: items earlier than `now`, total: items today }, where the daily check-in
    counts as done only when today's record exists.
  - `next` = up to 2 items after `now` (Miller); `pendingToday` = items after `now`.
  - `status.verdict` from the last saved check of today, or "none" ("Sin chequeo hoy").
  - `readings[i]` carry value, unit, level, marker (numeric), scale (from `UI_SCALES` in
    `constants.ts`), allowedLabel (derived from thresholds), source and baseline. Zone segments are
    NOT in the view model; `RangeBar` builds them from thresholds.
- Mission day and light phase come from `frontend/src/domain/mission/missionClock.ts` with the values in `frontend/src/config/mission.ts` (data-model.md MissionProfile).
- The mockup's "1 de 5" and "2 actividades pendientes" are illustrative; the numbers come from the
  rules above and the demo agenda.

### R18. Architecture enforced by lint (ui-build §1.1)
- **Decision**: replace the current `no-restricted-imports` rule with `eslint-plugin-boundaries`
  element types `libs`, `domain`, `application`, `ports`, `adapters`, `ui`, `config`, `composition`,
  `backend`. `domain` imports only `libs` — the check-in script, agenda and scenario data enter the
  reducer as parameters (user decision 2026-11-15); `application`, `adapters`, `ui` and
  `composition` may import `config`; only `App.tsx`/`main.tsx` import `composition-root.ts`, and the
  UI receives the wired ports through a React context (`frontend/src/ui/AppServices.tsx`);
  `frontend` and `backend` never import each other;
  `no-restricted-syntax` forbids `new <X>Adapter|Repository|Devices|Recognizer|Synth|Agenda|Clock|
  Connectivity(...)` outside `composition-root.ts` and tests; `max-lines` 200 for
  `application/use-cases/**`; `no-magic-numbers` everywhere except `config/**`,
  `libs/health-rules/src/{thresholds,constants}.ts` and tests (ignore 0, 1, -1); `react/jsx-no-literals`
  for `frontend/src/ui/**`.

### R19. Connectivity indicator (ui-build §3 #10)
- **Decision**: `ConnectivityPort` (`isOnline()`, `subscribe(cb)`), adapter on `navigator.onLine` +
  `online`/`offline` events, fake for tests; both pass one shared contract test. Offline shows
  "Sin internet · todo funciona", online "Conectado". Nothing else depends on connectivity.

### R13. Performance budgets
- Final transcript ≤ 800 ms after end of speech; voice start ≤ 300 ms after the prompt ends;
  3D ≥ 30 fps on the demo tablet; full check-in ≤ 60 s from the tap (SC-001).
- The Vosk model (~40 MB) is preloaded when Home opens, so model loading never counts against the
  60 s budget. Measured with timestamps logged in dev mode and the R3F `Perf`
  panel during development only.
