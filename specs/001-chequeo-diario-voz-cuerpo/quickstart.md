# Quickstart: validate the daily voice check-in (001)

How to run the app and check CA1–CA8 by hand (Principle IV). Shapes and names: see
[data-model.md](./data-model.md) and [contracts/](./contracts/).

## Prerequisites
- Node.js 20+, npm.
- Chromium-based browser (Chrome/Edge) on a laptop or Android tablet, with a microphone.
- Blender 4.x only if you rebuild the model.
- Assets in place under `frontend/`: `public/models/body.glb`, `public/models/body-fallback.png`,
  `public/models/vosk/parts/` (manifest + parts of the Vosk model; original in `models-src/vosk/`), `public/logo.svg`, `public/avatars/`,
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
| CA1 | Normal | Tap **Vita**, answer: "cinco horas" → "sí" → "cuatro" → "sí" → "no" → "sí" (the last "sí" answers "Di «sí» para terminar", D28). Time it. | Check-in finishes in ≤ 60 s. |
| CA2 | Normal | At the sleep question say "cinco horas". | The chat shows "5 horas" as Ana's bubble (dashed while it waits, solid after "sí"), and Vita says and shows "Escuché que dormiste 5 horas. ¿Es correcto?" with the hint "Di «sí» o «no»" and the chips 👍 Sí · 👎 No, before anything is saved. |
| CA3 | Normal | Watch the body while Vita asks about sleep. | The forehead dot is highlighted. |
| CA4 | CA4 | Answer sleep "cinco horas", mood "cuatro", symptoms "no". | Forehead dot shows "Sueño · atención"; verdict "atención" with "Dormiste poco: tómalo con calma". Same result every run. |
| CA5 | Normal | Drag to rotate the body left and right. | Every dot stays on its spot (forehead, chest, arm, abdomen, fingertip). |
| CA6 | Normal | Turn wifi off, reload, repeat CA1. | Works the same. |
| CA7 | Normal | Look at each metric row. | Value, bar with the allowed range ("Permitido …"), today's mark and the "tu normal" band; the mood chip "Ánimo n/5 *" and the legend line "* criterio del equipo, no clínico" (D44). |
| CA8 | Normal | Open **Historial**. | Today's check-in is listed with each value's source (voz / equipo); the 14 earlier days show "simulado". |

## Edge cases

| # | Scenario in selector | Do this | Expect |
|---|---|---|---|
| CL1 | Voz no entendida | Start the check-in. | After two failed tries, big buttons with the options appear (sleep 0–16 h). |
| CL2 | Sensor sin dato | Complete the check-in with normal answers. | Pressure dot grey "sin dato"; verdict "atención", action "Falta el dato de la presión: repite la medida". |
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
| SC-010 | CA4 | Finish the CA4 check-in, go back to Home. | Header "Estado de Ana · Hoy: Atención · Ánimo 4/5*"; "Atención" appears once in the header; legend and "* criterio del equipo, no clínico" at the bottom. |
| SC-011 | CA4 | Look at the Sueño row. | "Sueño 5 h · Atención"; the number "5" is in neutral text color, only the badge, ring and zone are amber. |
| SC-012 | Normal | Tap each body dot. | Its metric row is highlighted. |
| SC-013 | CA4 | Look at the Presión bar. | The marker for 118 sits between 90 and 120 on the bar; every other marker sits on its value. |
| FR-014/015 | Normal | Look at the top of Home. | "Hola, Ana", "Día N · Luz n/14"; "Ahora" with Chequeo diario, its time, 1 min, progress and "Empezar"; "Después" with at most 2 items and the pending count. |
| FR-018 | Normal | Tap Salud, Agenda, Guía; hover one. | Nothing opens; each shows only a gray icon and name; the tooltip says "Próximamente". |
| Colors | Normal | Compare dots and badges. | No sensor dot has the color of any status badge; "Bien" is slate gray. |

## Before the demo
- `frontend/data/SOURCES.md` lists WESAD, Sleep-EDF, MakeHuman and the Vosk model with verified licenses.
- `libs/health-rules/src/thresholds.ts`: every sourced threshold is `cited` (verified in the Foundational phase).
- A local Spanish TTS voice exists on the demo tablet (else captions only).

## Results — 2026-11-15 (headless Chromium 1280×800, SwiftShader; not the demo tablet)

Run with playwright-core against the local production build (`vite preview`, port 4173) and, for CA6 / SC-009 /
offline, the real link https://base-vital.pages.dev (first load online, then `setOffline(true)` and reload).
Scenarios were chosen with the in-app "Escenario de demo" selector (reset warning accepted). Typed answers use
`?fake=voice`; real Vosk used Chrome's fake microphone fed with `cinco.wav` ("cinco horas"). Screenshots and
scripts: session scratchpad `t097/` (not in the repo).

Important findings of the run:
- The deployed link (`index-Bd4xm1F7.js`) is an older build than the local one: it has no dev-metrics overlay, so
  the timing numbers come from the local build (same real Vosk path, model served by the preview).
- The looping fake microphone also "answers" the later questions (the mood was heard as "cinco"), so after the sleep
  answer the check-in was finished with the on-screen chips; only the sleep answer is real voice in those runs.

| Scenario | Result | Evidence |
|---|---|---|
| CA1 (typed answers, `?fake=voice`) | pass | Tap to "Chequeo guardado" in 3.1 s (overlay 3 s, target ≤ 60 s). Finishing needs a sixth reply "sí" at "Di «sí» para terminar" (D28), not in the 5-answer script above |
| CA1 (real Vosk, local build) | pass (partial voice) | Sleep by real voice, rest by chips: saved in 14.1 s (overlay), "Escuché que dormiste 5 horas" 6.4 s after the tap. Overlay: final transcript 268–277 ms (≤ 800 ms, met); mic open after prompt 1.7 s online run, 2.1 s offline run (slowest sample of 6; that run's first load had a failed Home preload, so the model loaded at the first listen). After D49 (mic, audio graph and recognizers reused per check-in), re-measured 2026-11-15 with a warm model, 3 runs, slowest sample: 87 / 62 / 59 ms (target ≤ 300 ms, met); same harness with per-listen setup: 198 / 87 / 107 ms |
| CA2 | pass | Real link and local: "5 horas…" dashed bubble, "Escuché que dormiste 5 horas. ¿Es correcto?", hint "Di «sí» o «no»", chips 👍 Sí · 👎 No, nothing saved yet; bubble solid after "sí" |
| CA3 | pass | Sleep question: forehead dot has the halo and the label "Sueño" under the body |
| CA4 | pass | Dot "Sueño · atención" (amber), verdict "Atención" + "Dormiste poco: tómalo con calma"; two runs gave identical texts and values (118/76, 72, 98 %, 36,8 °C) |
| CA5 | pass (note) | 3 drags (-120, +240, -120 px): all 5 dots follow the body in every view. Note: with the body turned to ±60°, the fingertip dot (oxygen) is drawn over the abdomen, but the fingertip is in front of the torso there, so it is correctly visible. Occlusion was checked with a probe build at ±100°: the dots hidden are the ones the geometry hides (see decisions D46) |
| CA6 (real link, offline) | pass | Online load, 2 Vosk parts in the SW cache, `setOffline(true)`, reload of `/checkin`: check-in with real Vosk heard "5 horas", saved in 14.3 s |
| CA7 | pass | Each row shows value, bar with allowed range, today's marker and the grey "tu normal" band, "Permitido …" text; "* criterio del equipo, no clínico" in the legend and "Ánimo 4/5 *" chip (there is no separate mood card) |
| CA8 | pass | Historial: today's check-in with "voz"/"equipo" per value; 14 earlier days marked "simulado" |
| CL1 | pass | "Voz no entendida": "No te entendí. Toca una opción." and sleep buttons 0 h … 16 h in half-hour steps |
| CL2 | pass | Pressure dot "Presión · sin dato", verdict "Atención", action "Falta el dato de la presión: repite la medida" |
| RN1 low temp | pass (note) | Dot "Temperatura · en duda", row "35,6 °C en duda", verdict "Atención · Un dato quedó en duda: repite la medida". The single re-measurement is not visible in the UI, not checked here. Fixed after the run by D48 / D47 (unit-tested, not re-run in the browser) |
| RN5 symptoms | pass | "mareo": verdict "Atención · Mencionaste un síntoma: avisa al cirujano de vuelo…" |
| RN5 two amber | pass | sleep 5 h + mood 3: verdict "Alerta · Dos valores están en atención…" |
| CL4 | pass (unit) | `reducer.cl4` and `runCheckin.cl4` tests: 15 passed (not driven in the UI) |
| CL5 | pass | Chromium with `--disable-gpu --disable-webgl`: `getContext('webgl')` fails, no `<canvas>`, `body-fallback.png` loaded and 5 sensor dots over it, on Home and on the check-in (forehead highlighted) |
| RN4 | pass | "veinte horas": "No te entendí bien, ¿me lo repites? Dime un número entre 0 y 16."; nothing saved |
| RF12 | pass | "para": "En pausa" and the button turns to "Seguir"; "sigue": resumes; "repite": question shown twice |
| RN6 | pass | Normal dots: sensor color only, no ring; altered: amber ring with label "Sueño atención" |
| VIII mood | pass (note) | "dos": dot "Ánimo · atención*", "* criterio del equipo, no clínico" once on the check-in, verdict "Atención". The Sueño row shows "7 h … Atención *" because the mood level lands on the sleep row. Fixed after the run by D48 / D47 (unit-tested, not re-run in the browser) |
| FR-013 reset | pass | Warning "Cambiar de escenario reinicia el historial" with confirm/cancel; after confirming, Historial shows only the 14 "simulado" days |
| SC-009 | pass | Real link and local preview offline after reload: header "Sin internet · todo funciona", logo/avatar SVG loaded (naturalWidth > 0), 3D body canvas present, icons shown |
| SC-010 | pass | "Estado de Ana", "Hoy: Atención", chip "Ánimo 4/5 *"; "Atención" once in the header; legend and "* criterio del equipo, no clínico" at the bottom |
| SC-011 | pass | "Sueño 5 h · Atención": the "5 h" text is dark neutral, only badge dot, ring and bar zone are amber |
| SC-012 | pass | Clicking each of the 5 dots highlights its own row (ring) — presión, pulso, oxígeno, temperatura, sueño |
| SC-013 | pass | Pressure marker for 118 sits inside the blue band, left of the 120 cut; other markers on their values |
| FR-014/015 | pass | "Hola, Ana", "Día 23 · Luz 9/14"; Ahora: Chequeo diario, "09:30 · 1 min", "Progreso diario: 0 de 5", "Empezar"; Después: 2 items + "5 actividades pendientes hoy" |
| FR-018 | pass | Salud, Agenda, Guía: URL unchanged, `aria-disabled`, tooltip and title "Próximamente" (tooltip shows on click/focus, not on plain hover; the `title` shows on hover) |
| Colors | pass | Sensor dots rgb(91,95,214) / (217,70,168) / (157,92,230) / (20,163,160) / (56,163,232); level markers amber #F2A93B, red #E5484D; none shared; "Bien" is slate gray |

Not run / needs the physical tablet (T097 stays partial):
- Real microphone with a person: recognition quality, noise, accents; the fake mic only plays "cinco horas".
- Local Spanish TTS voice: speechSynthesis is not audible/verified in headless; captions only checked.
- 3D frame rate on the tablet GPU (SwiftShader reported 60 fps, not representative) and touch (tap, drag, tap on dots).
- Mic-open latency ≤ 300 ms: 60–91 ms after D49 (slowest of 5 samples, 3 runs) (headless, warm model, fake mic); confirm on the tablet.
- Network cable unplugged on the tablet (SC-009 was checked with `setOffline`).
- Full real-voice check-in of the five answers (needs a person or more recorded wavs).
