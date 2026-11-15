# Base Vital

An offline daily health check-in for astronauts, built for the NASA Space Apps Guayaquil 2026
challenge 04. The astronaut answers a short check-in by voice in Spanish, sees the result on a
rotatable 3D body, and gets one verdict with one action.

**Base Vital never diagnoses.** It reads the values, compares them with the bands below, and points
to the next step. The flight surgeon decides. This is a prototype.

- **Live demo:** https://base-vital.pages.dev (open it once with internet; after that it works offline)
- **Browsers:** Chrome or Edge. The microphone needs HTTPS or `localhost`.
- **Project status:** see [specs/README.md](specs/README.md). The daily check-in (feature 001) is in
  implementation. The surgeon-side backend (feature 004) is tracked in
  [issue #5](https://github.com/AymanElS4/Hackathon--Health_Monitoring/issues/5).

## What the app does

1. **Check-in (Chequeo diario).** Tap **Vita** (or **Empezar** on Home). Vita asks about sleep,
   mood and symptoms, and reads the device values (pressure, pulse, oxygen, temperature). Every
   spoken number is confirmed before it is used ("¿Es correcto?", "Di «sí» o «no»").
   Answers can also be given with the chips (👍 Sí · 👎 No, and the symptom options).
2. **Body.** A 3D body with one dot per sensor. The dot of a value outside its band is highlighted
   with its status. The body can be rotated. Without WebGL, a static image with the same dots is shown.
3. **Verdict.** One verdict (ok, atención, alerta) and one action in Spanish, shown at the end of the check-in.
4. **Historial.** Today's check-in with the source of each value (voz = spoken, equipo = device),
   plus the 14 earlier days, marked "simulado".

Everything the astronaut needs runs in the browser. No accounts, no server.

## Try the demo

On Home, use the **Escenario de demo** selector (at the bottom of Home). Each scenario sets the simulated
device values for today:

| Selector option | What it shows |
|---|---|
| **Normal** | All device readings in the green band. Complete the check-in with normal answers. |
| **CA4** | Pressure 118/76, pulse 72. Answer sleep "cinco horas", mood "cuatro", symptoms "no": the sleep dot shows "Sueño · atención" and the verdict is "atención" ("Dormiste poco: tómalo con calma"). |
| **Sensor sin dato** | No pressure reading. The pressure dot is grey ("sin dato") and the verdict asks to repeat the measure ("Falta el dato de la presión: repite la medida"). |
| **Temperatura baja** | Temperature 35.6 °C, which is "en duda". Vita measures it again once; the verdict is "atención". |
| **Voz no entendida** | The voice recognizer does not understand. After two failed tries, big buttons with the options appear (sleep 0–16 h). |

Changing the scenario resets the history: after you confirm, **Historial** shows only the 14
simulated days.

Suggested path: select **Normal**, tap **Vita**, answer "cinco horas", "sí", "cuatro", "sí", "no", and a final "sí" to finish.
The target is under a minute (CA1 in the quickstart). Then tap **Ver historial** on Home.

## Repository layout

npm workspaces (declared in the root `package.json`):

| Path | What it is |
|---|---|
| `libs/contracts` | Zod schemas, defined once. Used by the frontend and, later, by the backend. |
| `libs/health-rules` | Pure health rules and the thresholds (`src/thresholds.ts`). |
| `frontend/` | The React app: domain, application (ports and use cases), adapters, UI, config. Layer rules are checked by eslint-plugin-boundaries. |
| `frontend/src/features-002/` | The team's feature 002 work, kept for reference. It is not routed or imported by the app. |
| `backend/` | Skeleton for feature 004 (surgeon sync service). It has no `package.json` and is not a workspace yet. |
| `specs/` | Spec Kit specifications: `001-chequeo-diario-voz-cuerpo` and `005-despliegue`; 002–004 are listed in `specs/README.md`, not yet specified. |
| `docs/` | Design and data-mapping documents (`docs/design/README.md` is the design reference). |

The backend is outside the astronaut's path. The app must work with the server down.

## Develop

Requirements: Node.js 20 or newer and npm (CI uses Node 22).

```bash
npm install          # from the repo root (installs all workspaces)
npm test             # all workspaces (Vitest)
npm run lint         # layer boundaries, magic numbers, JSX literals
npm run dev          # Vite dev server
npm run build && npm run preview   # production build with the offline service worker
npm run check:model  # checks frontend/public/models/body.glb (node names are fixed)
```

`npm run build` also type-checks, runs `check:model`, and fails if any file in `dist/` is 25 MiB or
larger.

### Voice model (Vosk)

The Spanish model archive is not in the repository. To rebuild the published parts:

1. Download `vosk-model-small-es-0.42.tar.gz` from https://alphacephei.com/vosk/models.
2. Put it in `frontend/models-src/vosk/`.
3. Run `npm run split:model -w @base-vital/frontend`.

The script writes the parts and `manifest.json` (with the SHA-256 of the whole archive) to
`frontend/public/models/vosk/parts/`. The app joins the parts in the browser and checks the hash.
If a part is missing or corrupt, the check-in still works with captions and big buttons.

### Developer URL flags

- `?fake=voice` uses a fake voice adapter, for developers without a microphone.
- `?dev=metrics` shows the timing overlay and the 3D frame-rate meter in any build. The dev server
  always shows them. The demo URL without the flag shows neither.

## Deploy

The frontend is published to **Cloudflare Pages**, project `base-vital`. Only Pages is used, never Workers.

- **Automatic:** `.github/workflows/pages.yml` runs on every push to `main` (tests, lint, build, then
  deploy). The repository needs two secrets:
  - `CLOUDFLARE_API_TOKEN`, with the permission "Cloudflare Pages: Edit".
  - `CLOUDFLARE_ACCOUNT_ID`.
- **Manual:**
  ```bash
  npm run build
  npx wrangler@4 pages deploy frontend/dist --project-name base-vital --branch main
  ```

Cloudflare Pages limits each file to 25 MiB, so the Vosk model is published as two parts and joined
in the browser (see the voice model section). Specification: `specs/005-despliegue/spec.md`.

## Health thresholds and sources

Every threshold is in `libs/health-rules/src/thresholds.ts`. Each has a verified source or is a
declared team criterion. The bands are half-open: the minimum is included and the maximum is not.

| Indicator | Green | Amber | Red | Source |
|---|---|---|---|---|
| Blood pressure (mmHg) | < 120 and < 80 | 120–139 or 80–89 | ≥ 140 or ≥ 90 | AHA/ACC 2025 High Blood Pressure Guideline |
| Resting pulse (bpm) | 60–100 | 50–59 or 101–110; below 50 without a symptom (team criterion) | above 110; below 50 with a symptom (team criterion) | AHA, "All About Heart Rate (Pulse)"; the amber and red bands outside 60–100 are a team criterion |
| Sleep (h) | ≥ 7 | 6–6.9; below 6 for one or two nights | below 6 h for three consecutive nights (team criterion) | AASM/SRS Joint Consensus Statement (Watson et al., 2015) |
| Body temperature (°C) | 36.1–37.2 | 37.3–37.9 | ≥ 38.0 (fever) | MedlinePlus "Body temperature norms"; CDC "Definitions of Signs, Symptoms, and Conditions of Ill Travelers" |
| Hypothermia (°C) | — | 35.0–36.0 is "en duda" (measured again, not a level) | < 35.0 | Mayo Clinic, "Hypothermia: Symptoms and causes" |
| SpO₂ (%) | ≥ 95 | 90–94 | < 90 | WHO Pulse Oximetry Training Manual (2011) |
| Mood (1–5 points) | 4–5 (team criterion) | 3, or ≤ 2 on one day (team criterion) | ≤ 2 on two consecutive days (team criterion) | Team criterion |

Sources are recorded in `frontend/data/SOURCES.md`. The AHA/ACC and Mayo Clinic values were checked
through secondary sources, and they are marked for a manual recheck there.

### "Criterio del equipo, no clínico"

Some bands are decisions of the team, not values from a published guideline. Examples are the
amber and red bands of the pulse outside 60–100, the three-night sleep rule, and mood. The app marks
these values with "* criterio del equipo, no clínico" on screen. The rule is written in
`.specify/memory/constitution.md` (principle VIII, "Every threshold has a source"). The 35.0–36.0 °C
"en duda" band is a measurement rule (measure again), not a clinical threshold.

## Data and licenses

The app ships with derived data only. Raw datasets are not in the repository.

### Créditos

- **Sleep data:** PhysioNet Sleep-EDF Expanded (sleep-cassette), Open Data Commons Attribution License
  v1.0. Only the sleep-stage annotations of 14 hypnogram files were used, to derive 14 nightly sleep
  totals in `frontend/data/sleep-history.json`. No signals and no subject identifiers are used.
  Required citations:
  - Kemp B., Zwinderman A.H., Tuk B., Kamphuisen H.A.C., Oberyé J.J.L., "Analysis of a sleep-dependent
    neuronal feedback loop: the slow-wave microcontinuity of the EEG", IEEE Transactions on
    Biomedical Engineering 47(9):1185–1194, 2000.
  - Goldberger A.L. et al., "PhysioBank, PhysioToolkit, and PhysioNet: Components of a New Research
    Resource for Complex Physiologic Signals", Circulation 101(23):e215–e220, 2000.
- **Body mesh:** MakeHuman base mesh (hm08), CC0 1.0 Universal. Only the `body` group is used. There
  is no face texture and no likeness.
- **Speech recognition:** Vosk model `vosk-model-small-es-0.42`, Apache 2.0 (alphacephei.com/vosk).
  The `vosk-browser` library is Apache-2.0.
- **Fonts:** Inter via `@fontsource/inter`, SIL Open Font License 1.1.
- **Icons:** `lucide-react`, ISC license.
- **3D loading:** Draco decoder files from `draco3dgltf`, Apache-2.0.

### Not used yet: WESAD

WESAD (UCI, dataset DOI 10.24432/C57K5T; Schmidt P., Reiss A., Duerichen R., Marberger C., Van
Laerhoven K., "Introducing WESAD, a Multimodal Dataset for Wearable Stress and Affect Detection",
ICMI 2018) has terms of non-commercial scientific use with credit to the owners. Its license is
recorded in `frontend/data/SOURCES.md`. **It is not used yet.** The pulse in this prototype is
simulated: each scenario sets today's value, and the seeded history is the scenario pulse ±3 bpm.

### Simulated values

Today's device values are fixed per demo scenario (`frontend/src/config/demoScenarios.ts`). The
14 earlier days are simulated and labelled "simulado". The app shows "equipo simulado" where it uses them.

## Spec-driven workflow

The project is built with [Spec Kit](https://github.com/github/spec-kit). Each feature has its own
folder in `specs/`, with `spec.md`, `plan.md`, `tasks.md`, and `quickstart.md` (manual acceptance
checks). Product rules are in `.specify/memory/constitution.md`. Implementation decisions, with the
rejected alternatives, are in `specs/001-chequeo-diario-voz-cuerpo/decisions.md`.
