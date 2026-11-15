# Quickstart: validate the daily voice check-in (001)

How to run the app and check CA1–CA8 by hand (Principle IV). Shapes and names: see
[data-model.md](./data-model.md) and [contracts/](./contracts/).

## Prerequisites
- Node.js 20+, npm.
- Chromium-based browser (Chrome/Edge) on a laptop or Android tablet, with a microphone.
- Blender 4.x only if you rebuild the model.
- Assets in place under `frontend/`: `public/models/body.glb`, `public/models/body-fallback.png`,
  `public/models/vosk/vosk-model-small-es-0.42.tar.gz`, `public/logo.svg`, `public/avatars/`,
  `data/wesad-hr.json`, `data/sleep-history.json`, `data/SOURCES.md`.

## Commands (developer)
```bash
npm install              # from the repo root (npm workspaces: libs/*, frontend)
npm test                 # all workspaces: contracts, health rules, domain, UI (Vitest)
npm run lint             # layer boundaries, magic numbers, JSX literals
npm run check:model      # frontend/scripts/check-model.ts — must pass
npm run build && npm run preview   # frontend production build with the offline service worker
```
Open the preview URL once with network on (first load caches everything). From then on, everything
below is done **inside the app**, with the "Escenario de demo" selector on Home — no URLs or flags.
(`?fake=voice` exists only for developers without a microphone.)

## Scenarios

| # | Scenario in selector | Do this | Expect |
|---|---|---|---|
| CA1 | Normal | Tap **Vita**, answer: "cinco horas" → "sí" → "cuatro" → "sí" → "no". Time it. | Check-in finishes in ≤ 60 s. |
| CA2 | Normal | At the sleep question say "cinco horas". | Vita says "Escuché 5 horas. ¿Correcto?" before anything is saved. |
| CA3 | Normal | Watch the body while Vita asks about sleep. | The forehead dot is highlighted. |
| CA4 | CA4 | Answer sleep "cinco horas", mood "cuatro", symptoms "no". | Forehead dot shows "Sueño · atención"; verdict "atención" with "Dormiste poco: tómalo con calma". Same result every run. |
| CA5 | Normal | Drag to rotate the body left and right. | Every dot stays on its spot (forehead, chest, arm, abdomen, fingertip). |
| CA6 | Normal | Turn wifi off, reload, repeat CA1. | Works the same. |
| CA7 | Normal | Look at each metric card. | Value, bar with the allowed range, today's mark and the "tu normal" mark; the mood card says "criterio del equipo, no clínico". |
| CA8 | Normal | Open **Historial**. | Today's check-in is listed with each value's source (voz / equipo); the 14 earlier days show "simulado". |

## Edge cases

| # | Scenario in selector | Do this | Expect |
|---|---|---|---|
| CL1 | Voz no entendida | Start the check-in. | After two failed tries, big buttons with the options appear (sleep 0–16 h). |
| CL2 | Sensor sin dato | Complete the check-in with normal answers. | Pressure dot grey "sin dato"; verdict "atención", action "Falta el dato de presión: repite la medida". |
| RN1 low temp | Temperatura baja | Complete the check-in. | Temperature dot "Temperatura · en duda", re-measured once; verdict "atención". |
| RN5 symptoms | Normal | Answer symptoms "mareo". | Verdict at least "atención". |
| RN5 two amber | Normal | Answer sleep "cinco horas" and mood "tres". | Forehead dot altered; verdict "alerta" (two amber values). |
| CL4 | Normal | Answer mood "cinco" on a day whose pulse is outside "tu normal" (developer: unit test `reducer.cl4`). | Vita asks mood again; if repeated, mood shows "en duda". |
| CL5 | — | Open on a device/browser without WebGL. | Static image of the same body with the same dots. |
| RN4 | Normal | Say "veinte horas". | Vita asks again; nothing saved. |
| RF12 | Normal | Say "para", then "sigue"; say "repite". | Pauses / resumes / repeats the question. |
| RN6 | CA4 | Compare a normal dot and the altered one. | Normal: sensor color only, no ring. Altered: amber ring with "Sueño · atención". |
| VIII mood | Normal | Answer mood "dos". | Forehead dot "Ánimo · atención*"; "* criterio del equipo, no clínico" once on screen; verdict panel shows the full note. |
| FR-013 reset | any | Change the scenario. | A warning says the history will be reset; after confirming, Historial shows only the 14 "simulado" days. |

## Home screen (visual, SC-009 – SC-013)

| # | Scenario in selector | Do this | Expect |
|---|---|---|---|
| SC-009 | Normal | Unplug the network cable / turn wifi off, reload Home. | Logo, avatar, body and icons all show; no broken images; header says "Sin internet · todo funciona". |
| SC-010 | CA4 | Finish the CA4 check-in, go back to Home. | Header "Estado de Ana · Hoy: Atención · Ánimo 4/5*"; "Atención" appears once in the header; legend and "* Ánimo: criterio del equipo, no clínico" at the bottom. |
| SC-011 | CA4 | Look at the Sueño row. | "Sueño 5 h · Atención"; the number "5" is in neutral text color, only the badge, ring and zone are amber. |
| SC-012 | Normal | Tap each body dot. | Its metric row is highlighted. |
| SC-013 | CA4 | Look at the Presión bar. | The marker for 118 sits between 90 and 120 on the bar; every other marker sits on its value. |
| FR-014/015 | Normal | Look at the top of Home. | "Hola, Ana", "Día N · Luz n/14"; "Ahora" with Chequeo diario, its time, 1 min, progress and "Empezar"; "Después" with at most 2 items and the pending count. |
| FR-018 | Normal | Tap Salud, Agenda, Guía. | Nothing opens; each says "Próximamente". |
| Colors | Normal | Compare dots and badges. | No sensor dot has the color of any status badge; "Bien" is slate gray. |

## Before the demo
- `frontend/data/SOURCES.md` lists WESAD, Sleep-EDF, MakeHuman and the Vosk model with verified licenses.
- `libs/health-rules/src/thresholds.ts`: every sourced threshold is `cited` (verified in the Foundational phase).
- A local Spanish TTS voice exists on the demo tablet (else captions only).
