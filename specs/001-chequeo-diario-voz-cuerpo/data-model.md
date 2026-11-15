# Data Model: Daily voice check-in with 3D body (001)

All shapes are Zod schemas in `libs/contracts/src/` (`@base-vital/contracts`, defined once, shared with 004). Types below are the inferred
TypeScript types. Spanish UI strings never live here; they live in `frontend/src/config/messages.es.ts`.

## Enumerations

| Name | Values | Notes |
|---|---|---|
| `SensorKey` | `sleep`, `pulse`, `pressure`, `temperature`, `oxygen` | One per body dot (RF6). |
| `Indicator` | `sleep_hours`, `mood`, `resting_heart_rate`, `blood_pressure`, `body_temperature`, `oxygen_saturation` | No `face_fatigue` (camera out of scope). |
| `Level` | `green`, `amber`, `red`, `in_doubt`, `unknown` | UI labels: bien / atención / alerta / en duda / sin dato. |
| `SensorPhase` | `idle`, `asking`, `measuring`, `confirmed`, `in_doubt` | Drives dot animation. |
| `Verdict` | `ok`, `attention`, `alert` | UI: bien / atención / alerta. |
| `Source` | `voice`, `device` | RF11 (no camera). |
| `Symptom` | `dizziness`, `fainting`, `chest_pain`, `shortness_of_breath`, `none` | The 4 that count for pulse < 50 (RN1); the list may grow in the plan only with spec approval. |

`SENSOR_INDICATORS`: sleep → [`sleep_hours`, `mood`]; pulse → [`resting_heart_rate`];
pressure → [`blood_pressure`]; temperature → [`body_temperature`]; oxygen → [`oxygen_saturation`].

## Entities

### Observation
One value captured during a check-in.

| Field | Type | Rules |
|---|---|---|
| `indicator` | `Indicator` | |
| `value` | `number` or `{ systolic: number; diastolic: number }` | BP uses the object form. |
| `source` | `Source` | `voice` for sleep/mood; `device` for vitals. |
| `confirmed` | `boolean` | Voice values MUST be `true` before saving (Principle IX, RF4). Device values are `true` on arrival. |
| `simulated` | `boolean` | `true` for every device value in this version. |
| `at` | ISO date-time | |

Validation (RN4, values outside are re-asked, never stored): `sleep_hours` 0–16 (0.5 steps);
`mood` integer 1–5. Device plausibility: HR 30–220, SpO₂ 70–100, temp 30–43 °C, BP systolic 70–250,
diastolic 40–150; out of range → `unknown` (CL2). Temperature 35,0–36,0 °C → `in_doubt` and the
thermometer is read once more (RN1); if still in that band it stays `in_doubt`.

### Threshold
Static data in `libs/health-rules/src/thresholds.ts`.

| Field | Type | Rules |
|---|---|---|
| `indicator` | `Indicator` | |
| `green` / `amber` / `red` | range predicates | Exact values of RN1 (and R10 defaults). |
| `consecutiveForRed` | `number?` | sleep 3 nights, mood 2 days (RN1, RN2). |
| `source` | `string` | Required for every threshold except `team_criterion` (Principle VIII, v1.1.0). Temperature normal → MedlinePlus; fever → CDC; hypothermia → Mayo Clinic; oxygen → WHO Pulse Oximetry Training Manual. |
| `sourceStatus` | `cited` \| `to_verify` \| `team_criterion` | Every sourced threshold must be `cited` (verified) before it is coded; mood = `team_criterion`, displayed as "criterio del equipo, no clínico". |

### Baseline ("tu normal")
| Field | Type | Rules |
|---|---|---|
| `indicator` | `Indicator` (BP split into systolic/diastolic) | |
| `mean`, `sd` | `number` | From the first 14 days only; fixed afterwards (RN3). `sd = max(computed, MIN_SD[indicator])`, never 0. |
| `ready` | `boolean` | `false` while fewer than 14 days → UI says "Aún aprendo tu normal" (CL3). |

### SensorReading (only input of the 3D body and the metric cards)
| Field | Type | Rules |
|---|---|---|
| `sensor` | `SensorKey` | |
| `level` | `Level` | Worst level of its indicators. |
| `phase` | `SensorPhase` | |
| `value` | `string` | Already formatted ("118/76", "5 h"). |
| `outsideNormal` | `boolean` | > 2 SD for 3 readings in a row (RN3). |
| `teamCriterion` | `boolean` | `true` when `level` was set by a team-criterion band (mood; pulse outside 60–100; sleep red by the 3-night rule); the UI then shows the "*" mark and note (Principle VIII). |
| `reason` | `Indicator \| null` | The indicator that set `level` (e.g., `mood` on the sleep dot); the dot label reads "{reason} · {level}" (RN6). `null` when green. |

### BodyView
`{ readings: Record<SensorKey, SensorReading>; focus: SensorKey | null; verdict: Verdict | 'pending' }`

### CheckRecord (stored in IndexedDB, store `checks`)
| Field | Type | Rules |
|---|---|---|
| `id` | ISO date-time | Primary key. |
| `observations` | `Observation[]` | Each keeps its `source` (RF11, HU6). |
| `symptoms` | `Symptom[]` | |
| `readings` | `Record<SensorKey, SensorReading>` | Snapshot at save time. |
| `verdict` | `Verdict` | |
| `actionKey` | `string` | Key into `messages.es.ts`; exactly one action (RF9). |
| `simulated` | `boolean` | `true` for the 14 seeded history days. |

### DemoScenario (static data, `frontend/src/config/demoScenarios.ts`, FR-013)
| Field | Type | Rules |
|---|---|---|
| `id` | `normal` \| `ca4` \| `missing_sensor` \| `low_temp` \| `voice_not_understood` | Chosen from the visible "Escenario de demo" selector. |
| `devices` | per device indicator: value or `null` | Values from `docs/base-vital-home-data-mapping.md` §4 (research R14): all inside green except `missing_sensor` (blood pressure `null`) and `low_temp` (temperature 35,6 °C). Today's pulse is the scenario value. |
| `priorNights` | `number[]` (length 2) | [yesterday, the day before]; ≥ 7 h in every scenario (normal [7.2, 7.8], ca4 [7.1, 7.4], missing_sensor [7.0, 7.6], low_temp [7.1, 7.5]). |
| `voice` | `real` \| `never_understands` | `voice_not_understood` → recognizer returns nothing (CL1). |

Switching scenario clears the `checks` store and re-seeds 14 simulated days (FR-013).

### AgendaItem (static demo data, `frontend/src/config/agenda.ts`)
`{ id: string; time: 'HH:mm'; titleKey: string; subtitleKey?: string; durationMin?: number; icon?:
'checkin' | 'eva' | 'meal' | 'exercise' | 'task'; action?: 'start_checkin' }`. The daily check-in
item has `id: 'daily-checkin'`, `durationMin: 1`, `action: 'start_checkin'`. "Lo próximo" = first item
after the current time (RF10, PA2).

### MissionProfile (static, `frontend/src/config/mission.ts`)
| Field | Type | Rules |
|---|---|---|
| `crewName` | `string` | "Ana" (single profile, v0). |
| `missionStartDate` | ISO date | Day 1 of the mission. |
| `avatarUrl` | `string` | Local generic placeholder in `frontend/public/avatars/` (no real face). |

Derived (pure, `frontend/src/domain/mission/missionClock.ts`): `missionDay = whole days since start + 1`;
`lightPhase` = lunar cycle of 14 light + 14 dark days → `{ kind: 'light' | 'dark', day: 1–14, of: 14 }`.

### Connectivity
`'online' | 'offline'` from `ConnectivityPort` (navigator.onLine). Shown only as the header label.

### HomeView (output of `buildHomeView`, research R17)
```
{
  header: { crewName, missionDay, lightPhase, connectivity, avatarUrl },
  now: { itemId, time, titleKey, durationMin, progress: { done, total }, action } | null,
  next: AgendaItem[]            // max 2
  pendingToday: number,
  status: {
    verdict: Verdict | 'none',  // 'none' → "Sin chequeo hoy"
    mood: { value, of: 5, level, teamCriterion: true } | null,
    readings: Array<{ sensor, value, unit, level, marker, scale: [min, max], allowedLabel,
                      source, baseline: { mean, sd } | null, reason }>,
    focus: SensorKey | null
  }
}
```
Field names follow this document (e.g. `verdict` uses `ok | attention | alert`, not colors). Zone
segments of each bar are not in the view model; `RangeBar` derives them from thresholds.

## State transitions

### Check-in step (reducer in `domain/checkin`)
```
idle → greeting → ask_sleep → confirm_sleep → ask_mood → confirm_mood → ask_symptoms
     → measuring (pressure → pulse → oxygen → temperature) → evaluating → summary → next_activity → saved
```
- `confirm_*`: "sí" → value `confirmed`; "no" → back to `ask_*`.
- Impossible value (RN4) → back to `ask_*` with the "otra vez" message.
- 2 failed recognitions in a step → `buttons` sub-mode for that step (CL1, RF12).
- Any step: `para` → `paused` (resume with tap or "sigue"); `repite` → replay current prompt.
- CL4: after `measuring`, if mood ≥ 4 and pulse outside normal → `reask_mood` once; still ≥ 4 → mood
  `in_doubt`.

### Sensor phase
`idle → asking (focus) → measuring → confirmed | in_doubt`; missing device data → level `unknown`.

### Verdict (RN5 + clarifications)
- `alert`: any confirmed `red` (includes temp < 35,0), fever (temp ≥ 38,0), or ≥ 2 **indicator
  values** `amber` (values, not sensors: sleep 5 h + mood 3 = two amber).
- `attention`: one `amber` value, any `outsideNormal`, any `in_doubt`, any `unknown` (CL2), or any
  reported symptom (`dizziness`, `fainting`, `chest_pain`, `shortness_of_breath`).
- `ok`: everything `green`, nothing outside normal, no `unknown`.
