# Base Vital — Home screen data mapping (mockup "Distribución Corregida")

What feeds each element of the Home mockup, where it comes from, and the view model the screen receives.
Scope: feature `001-chequeo-diario-voz-cuerpo`. Field names follow `src/contracts` (plan.md / data-model.md);
if a name differs there, data-model.md wins.

---

## 1. View model (single object the Home screen renders)

```json
{
  "header": {
    "crewName": "Ana",
    "missionDay": 23,
    "lightPhase": { "kind": "light", "day": 9, "of": 14 },
    "connectivity": "offline",
    "avatarUrl": "/avatars/crew-a1b2c3.png"
  },
  "now": {
    "itemId": "daily-checkin",
    "time": "09:30",
    "titleKey": "agenda.dailyCheckin",
    "durationMin": 1,
    "progress": { "done": 1, "total": 5 },
    "action": "start_checkin"
  },
  "next": [
    { "time": "10:00", "titleKey": "agenda.eva", "subtitleKey": "agenda.eva.solarPanel", "icon": "eva" },
    { "time": "13:00", "titleKey": "agenda.vitaminD", "subtitleKey": "agenda.vitaminD.dose", "icon": "pill" }
  ],
  "pendingToday": 2,
  "status": {
    "verdict": "amber",
    "mood": { "value": 4, "of": 5, "level": "green", "teamCriterion": true },
    "readings": [
      { "sensor": "pressure",    "value": "118/76", "unit": "mmHg", "level": "green", "marker": 118,
        "scale": [90, 160],  "allowedLabel": "< 120/80",  "source": "device" },
      { "sensor": "pulse",       "value": "72",     "unit": "lpm",  "level": "green", "marker": 72,
        "scale": [40, 130],  "allowedLabel": "60–100",    "source": "device" },
      { "sensor": "oxygen",      "value": "98",     "unit": "%",    "level": "green", "marker": 98,
        "scale": [85, 100],  "allowedLabel": "≥ 95",      "source": "device" },
      { "sensor": "temperature", "value": "36,8",   "unit": "°C",   "level": "green", "marker": 36.8,
        "scale": [35, 39],   "allowedLabel": "36,1–37,2", "source": "device" },
      { "sensor": "sleep",       "value": "5",      "unit": "h",    "level": "amber", "marker": 5,
        "scale": [0, 10],    "allowedLabel": "≥ 7 h",     "source": "voice" }
    ],
    "focus": null
  }
}
```

Zone segments of each bar (red / amber / allowed) are NOT in the view model: the bar builds them from
`config/thresholds.ts`, so the numbers live in one place.

---

## 2. Element → data → origin

| Mockup element | Field | Origin | Notes |
|---|---|---|---|
| "Hola, Ana" | `header.crewName` | Static crew profile (`config`) | Single profile in v0 |
| "Día 23 · Luz 9/14" | `missionDay`, `lightPhase` | Derived from mission start date + injected Clock | Lunar day = 14 light + 14 dark; pure function |
| "Sin internet ✓" | `connectivity` | `navigator.onLine` adapter | The ✓ means "everything still works" |
| Avatar | `avatarUrl` | Static asset | Placeholder, no real face |
| AHORA: "Chequeo …" + 09:30 · 1 min | `now` | Static agenda (`adapters/agenda/static`) | First not-done item of today |
| Progreso "1 de 5" | `now.progress` | Agenda items done today / total | Done = check record saved for that item |
| Botón "Empezar" | `now.action` | — | Starts the check-in reducer |
| DESPUÉS (2 rows) | `next[]` | Static agenda, max 2 (Miller) | Times + message keys only |
| "2 actividades pendientes hoy" | `pendingToday` | Agenda count | |
| Chip "Atención" | `status.verdict` | `evaluateCheck` on the last saved check | Before the first check of the day: "Sin chequeo hoy" |
| Chip "Ánimo 4/5" | `status.mood` | Last confirmed voice answer | Needs the `*` + "criterio del equipo, no clínico" note (RN6 / constitution VIII) |
| 3D body + 5 dots | `readings[].sensor`, `level`, `focus` | Last check + session focus | Dot color = sensor (identity); ring = level, only when not green |
| Tarjeta Presión | `readings[pressure]` | Simulated BP device (seeded, in green for the demo scenario) | Label "simulado" in data/SOURCES.md |
| Tarjeta Pulso | `readings[pulse]` | WESAD heart-rate replay | |
| Tarjeta Oxígeno | `readings[oxygen]` | Simulated pulse oximeter | |
| Tarjeta Temperatura | `readings[temperature]` | Simulated body temperature | |
| Tarjeta Sueño | `readings[sleep]` | Voice answer of today; history from Sleep-EDF seed | |
| Marca "tu normal" (not in mockup yet) | computed | `computeBaseline` over first 14 days, with `MIN_SD` | Required by RF8 / US4 |
| "Toca un sensor" | — | UI hint | Tap → highlights the row |

---

## 3. Where the mockup differs from the spec (fix in the build, not in the spec)

| # | Mockup | Spec 001 says | Use |
|---|---|---|---|
| 1 | Sensor colors amber / coral / purple / teal / blue | RN6: indigo #5B5FD6 · magenta #D946A8 · violet #9D5CE6 · turquoise #14A3A0 · sky #38A3E8 | Spec |
| 2 | Sleep dot amber = same as "Atención" badge | Sensor colors never match status colors | Spec |
| 3 | Badge "Óptimo" | Levels are bien / atención / alerta | Use "Bien" |
| 4 | "Chequeo antes de salir" | Feature 001 is the daily check-in; exit check is 002 | "Chequeo diario" |
| 5 | "Ánimo 4/5" without note | Team-criterion marker required | "Ánimo 4/5*" + note once on screen |
| 6 | No "tu normal" mark on the bars | RF8 requires it | Add a small bracket above each bar |
| 7 | Salud / Agenda / Guía tabs | Out of scope in 001 | Keep tabs visible but disabled, or hide them |

---

## 4. Demo scenario values (deterministic, from the "Escenario de demo" selector)

| Scenario | Pressure | Pulse | SpO₂ | Temp | Sleep (today / prev 2) | Mood | Expected verdict |
|---|---|---|---|---|---|---|---|
| Normal | 112/72 | 64 | 98 | 36,6 | 7,5 / 7,2 / 7,8 | 4 | Bien |
| **CA4 (Ana)** | 118/76 | 72 | 98 | 36,8 | **5** / 7,1 / 7,4 | 4 | **Atención** — "Dormiste poco: tómalo con calma" |
| Sensor sin dato | — (no data) | 66 | 97 | 36,7 | 7,3 / 7,0 / 7,6 | 4 | Never "Bien" (CL2) |
| Temperatura baja | 114/74 | 66 | 97 | 35,6 | 7,2 / 7,1 / 7,5 | 4 | En duda → re-measure |
| Voz no entendida | 112/72 | 64 | 98 | 36,6 | (2 failed answers) | — | Big buttons (CL1) |

Previous-14-day history: seeded with fixed-seed small variation (U1) so "tu normal" never has SD 0.
