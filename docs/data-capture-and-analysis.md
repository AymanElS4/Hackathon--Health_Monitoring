# Base Vital — Data we need, how we capture it, and the charts

Team guide. It covers what data the app needs, where each value comes from today, what is stored,
and which charts exist or are planned. Sources: `specs/001-chequeo-diario-voz-cuerpo/spec.md`,
`docs/base-vital-home-data-mapping.md`, `docs/base-vital-db-schema.md`, `libs/contracts`,
`libs/health-rules`. If this file and the spec disagree, the spec wins.

> Status legend: **Done** = in the code today · **Simulated** = works with fake values ·
> **Planned** = in a spec or doc, not built · **Not specified** = idea only; it needs a spec first
> (constitution, principle III).

---

## 1. The data in one table

Six indicators per daily check-in, plus symptoms.

| Indicator | Sensor / body spot | Unit | How it is captured | Source today | Valid input | Status |
|---|---|---|---|---|---|---|
| Sleep | `sleep` · forehead | hours | **Voice** ("cinco horas"), read back and confirmed; big buttons if voice fails twice | Today: the astronaut. History: PhysioNet Sleep-EDF (14 nights) | 0–16 h, steps of 0.5 | Done |
| Mood | (no dot) · chip "Ánimo 4/5*" | points 1–5 | **Voice**, confirmed | The astronaut | integer 1–5 | Done |
| Symptoms | — | list | **Voice** or chips | The astronaut | `dizziness`, `fainting`, `chest_pain`, `shortness_of_breath`, `none` | Done |
| Resting pulse | `pulse` · chest | bpm | **Device** (no typing) | Simulated per demo scenario (WESAD replay planned, not used) | 30–220 | Simulated |
| Blood pressure | `pressure` · arm | mmHg (systolic/diastolic) | **Device** | Simulated per demo scenario | 70–250 / 40–150 | Simulated |
| Body temperature | `temperature` · abdomen | °C | **Device** | Simulated per demo scenario | 30–43 | Simulated |
| Oxygen (SpO₂) | `oxygen` · fingertip | % | **Device** | Simulated per demo scenario | 70–100 | Simulated |

Rules that apply to every value:

- **Voice values are saved only after "sí"** (constitution IX). The contract rejects an unconfirmed voice value.
- **Impossible values do not raise an alarm.** A spoken value outside its range is asked again (RN4). A device
  value outside the valid range is saved as **"sin dato"** (grey dot) (CL2).
- **A missing sensor never gives "Bien".** The verdict can be at best "atención" (CL2).
- **Every value keeps its origin:** `source` (`voice` / `device`), `simulated` (true/false) and the time `at`.
- Valid ranges for devices live in `frontend/src/adapters/simulated-devices/SimulatedDevices.ts`; sleep and mood
  limits live in `libs/contracts`.

---

## 2. What one saved check-in contains

Stored on the tablet in IndexedDB (store `checks`). Shape: `CheckRecord` in `libs/contracts/src/entities.ts`.

| Field | Meaning |
|---|---|
| `id` | ISO date-time of the check-in (also the key) |
| `observations[]` | One per indicator: `indicator`, `value`, `source`, `confirmed`, `simulated`, `at` |
| `symptoms[]` | Symptoms reported |
| `readings` | Snapshot per sensor at save time: level (`green` / `amber` / `red` / `in_doubt` / `unknown`), team-criterion flag |
| `verdict` | `ok` / `attention` / `alert` |
| `actionKey` | The one action for `attention` / `alert`; empty for `ok` |
| `simulated` | `true` for the 14 seeded history days |

**Not stored, on purpose:** names, photos, voice audio and transcripts (constitution V).

---

## 3. History and "tu normal"

"Tu normal" (RN3) needs history, so the app is seeded with **14 simulated days**.

- **Baseline:** mean and SD of the **first 14 days** per indicator, then fixed (`BASELINE_DAYS = 14`).
- **Out of normal:** more than **2 SD** away for **3 readings in a row** → "atención", even inside the guideline range.
- **Minimum SD** so a flat history does not give SD 0 (team criterion): sleep 0.5 h · mood 0.5 · pulse 3 bpm ·
  systolic 4 · diastolic 3 mmHg · temperature 0.2 °C · SpO₂ 1 %.
- Before day 14 there is no baseline: the app says "Aún aprendo tu normal" (CL3).

| History series | Where it comes from | File |
|---|---|---|
| Sleep, 14 nights | PhysioNet Sleep-EDF Expanded (sleep-cassette), ODC-By 1.0 — only nightly totals | `frontend/data/sleep-history.json` |
| Pulse | Scenario value ± 3 bpm (fixed seed) | generated in code |
| Pressure, temperature, SpO₂ | Scenario value with small fixed-seed variation | generated in code |
| Mood | Seeded | generated in code |

Licenses and citations: `frontend/data/SOURCES.md`.

---

## 4. Thresholds (bien / atención / alerta)

Single place: `libs/health-rules/src/thresholds.ts`. Every threshold has a source or is marked
"criterio del equipo, no clínico" (constitution VIII). The full table with sources is in the root `README.md`.

| Indicator | Bien | Atención | Alerta |
|---|---|---|---|
| Pressure | < 120 and < 80 | 120–139 or 80–89 | ≥ 140 or ≥ 90 |
| Pulse | 60–100 | 50–59 or 101–110; < 50 without a symptom* | > 110; < 50 with a symptom* |
| Sleep | ≥ 7 h | 6–6.9 h, or < 6 h for 1–2 nights | < 6 h for 3 nights in a row* |
| Temperature | 36.1–37.2 °C | 37.3–37.9 °C | ≥ 38.0 °C; < 35.0 °C |
| SpO₂ | ≥ 95 % | 90–94 % | < 90 % |
| Mood* | 4–5 | 3, or ≤ 2 on one day | ≤ 2 for 2 days in a row |

\* team criterion. 35.0–36.0 °C is "en duda": the app measures again.

---

## 5. Charts and analysis

### 5.1 Built (feature 001)

| Chart | Where | What it shows | Code |
|---|---|---|---|
| **Range bar** per metric | Home "Estado" and check-in result | Red / amber / allowed zones, today's marker, and the "tu normal" bracket (mean ± 2 SD) | `frontend/src/ui/components/rangeBarLayout.ts`, `MetricRows.tsx` |
| **3D body with dots** | Home and check-in | One dot per sensor; a ring shows the level when it is not green; grey = "sin dato" | `frontend/src/ui/body3d/` |
| **Verdict + one action** | End of check-in | `ok` / `attention` / `alert` with one sentence | `libs/health-rules/src/verdict.ts` |
| **History list** | `/historial` | Each day with the source of each value (voz / equipo) and "simulado" | `frontend/src/ui/screens/History.tsx` |

### 5.2 In the design only (not in any spec)

- **Sparkline inside each metric tile** (`docs/design/DESIGN.md`, "Cards & Metric Tiles"). No requirement asks
  for it. To build it, add it to a spec first.

### 5.3 Planned features (specs not written yet)

| Feature | Analysis it brings | Data it needs |
|---|---|---|
| `003-medicion-wesad` | The pitch number: **hits, false alarms avoided, early warning** of the rules over WESAD | WESAD (UCI, non-commercial use, credit required). A script extracts heart-rate series; raw data is never committed |
| `004-resumen-cirujano` | Flight surgeon page `/cirujano`: crew ordered by verdict, 14-day history per astronaut, alert queue (routine / soon / now), decision | Built (backend, PRs #7 and #9). Schema: `backend/migrations/0001_init.sql` (4 tables). No charts yet |

### 5.4 Not specified — proposals for the team to discuss

These are ideas, not commitments. Each one needs `/speckit-specify` before anyone builds it.

- 14-day trend line per indicator with the "tu normal" band behind it (surgeon view, 004).
- Calendar view of verdicts per day (green / amber / red) (surgeon view, 004).
- Confusion matrix and alert timeline for the WESAD evaluation (003).

---

## 6. What is still missing (data the team must get or decide)

| # | Missing | Who / where |
|---|---|---|
| 1 | Real pulse data: the WESAD replay is planned but not used; pulse is simulated today | 003 — extract HR series with `frontend/scripts/data/extract-wesad-hr.py` |
| 2 | Manual recheck of the AHA/ACC and Mayo Clinic sources (checked only through secondary sources) | `frontend/data/SOURCES.md` |
| 3 | Run the full backend check: `docker compose up` + `specs/004-resumen-cirujano/quickstart.md` §1–§6 | 004 task T043 |
| 4 | Any chart beyond the range bars (trends, sparklines, WESAD metrics) | New spec (003 or 004) |
| 5 | Camera fatigue (`face_fatigue`) and exit check data | Feature 002 — out of 001 |

Out of scope everywhere: diagnosis, medication, radiation, and real astronaut data.
