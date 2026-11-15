# Base Vital — Home UI build spec + repo split (frontend / backend)

Inputs: Stitch export `code.html`, design system `DESIGN.md` ("Serene Clinical Telemetry"), screenshot of the
Home screen. This document says **what to keep, what to correct, and where each piece lives**.
Feature: `001-chequeo-diario-voz-cuerpo` (UI) + new feature `004-resumen-cirujano` (backend).
The Stitch HTML is a **visual reference only**: it is rebuilt as React components, never copied.

---

## 0. Decisions that change the current plan (apply through Spec Kit, not by hand)

| # | Change | Why | Spec Kit step |
|---|---|---|---|
| D1 | Repo split into `frontend/`, `backend/` and `libs/` (shared contracts + rules) | Clean boundaries; contracts defined once (rule "single source of truth") | `/speckit-plan` update for 001 |
| D2 | Constitution 1.2.0: a server is allowed **only off the astronaut's critical path** (sync + flight-surgeon view). The astronaut app MUST work with the backend down | Today's constitution says "no server" | `/speckit-constitution` |
| D3 | Backend work belongs to feature `004-resumen-cirujano`, not to 001 | No phantom scope in 001 | `/speckit-specify` for 004 |

---

## 1. Repository structure

```text
base-vital/
├── libs/                         # shared, framework-free, imported by both apps
│   ├── contracts/                # Zod schemas + inferred types (SensorKey, Observation, CheckRecord, Alert…)
│   └── health-rules/             # pure functions: evaluateCheck, computeBaseline, verdict, thresholds
├── frontend/                     # astronaut app (offline PWA)
│   └── src/
│       ├── domain/               # check-in reducer, utterance parser — imports only libs/*
│       ├── application/
│       │   ├── ports/            # SpeechToText, TextToSpeech, DeviceSource, CheckRepository,
│       │   │                     # AgendaSource, Connectivity, Clock, SyncGateway
│       │   └── use-cases/        # runCheckin, loadHome, buildHomeView, selectDemoScenario
│       ├── adapters/             # vosk/, web-speech-tts/, simulated-devices/, indexeddb/,
│       │                         # static-agenda/, navigator-connectivity/, http-sync/ (optional), fakes/
│       ├── ui/
│       │   ├── components/       # Button, Card, Badge, StatCard, SectionHeader (existing set) + new below
│       │   ├── screens/          # Home, CheckIn, History
│       │   └── body3d/           # BodyViewer (R3F), SensorDot, BodyFallback
│       ├── config/               # design-tokens.ts, constants.ts, messages.es.ts, env.ts (Zod, fail-fast)
│       └── composition-root.ts   # the ONLY place where adapters are instantiated
├── backend/                      # flight-surgeon sync service (feature 004)
│   └── src/
│       ├── domain/               # Alert, urgency policy — imports only libs/*
│       ├── application/
│       │   ├── ports/            # CheckRepository, AlertRepository, TokenService, Clock, PiiGate
│       │   └── use-cases/        # ingest-check, get-crew-summary, list-alerts, decide-alert
│       ├── adapters/             # http/ (Nest controllers + Zod pipe), persistence/sqlite|in-memory,
│       │                         # auth/jwt, pii/sentinel
│       ├── config/               # env.ts (Zod, fail-fast), constants.ts
│       └── main.ts               # composition root; binds 127.0.0.1
└── package.json                  # npm workspaces: libs/*, frontend, backend
```

### 1.1 Architecture rules (enforced by lint, not by convention)

| Rule | Enforcement |
|---|---|
| `domain` imports only `libs/*` | `eslint-plugin-boundaries` — violation fails CI |
| `application` imports `domain` + its own `ports` | same |
| `adapters` and `ui` depend inward only; `ui` never imports an adapter | same |
| `frontend` and `backend` never import each other; they share only `libs/*` | same |
| No `new Adapter()` outside `composition-root.ts` / `main.ts`; the Clock is injected | review + lint rule |
| No `if (provider === …)` in use cases — new capability = new adapter behind an existing port | review |
| One use case = one file, ≤ ~200 lines | lint `max-lines` |
| No magic numbers; thresholds only in `libs/health-rules/thresholds.ts`, UI numbers in `config/constants.ts` | `no-magic-numbers` |
| UI text only in `frontend/src/config/messages.es.ts` | lint rule on JSX string literals |

SOLID mapping: **S** one use case per file · **O** new adapters, not edits to use cases · **L** every fake adapter
passes the same contract tests as the real one · **I** small ports (one capability each) · **D** use cases depend on
ports, the composition root wires adapters.

---

## 2. Design tokens (from DESIGN.md, single source)

`frontend/src/config/design-tokens.ts` exports every color, font size, radius, spacing and shadow; the Tailwind
config is **generated from it** (no hex values inside components).

Kept from DESIGN.md: Inter, canvas `#F5F8FC`, cards `#FFFFFF`, primary `#2F6FED` / hover `#2559C7`, track
`#E8F1FE`, text `#1E2B3C` / secondary `#6B7A8F`, card radius 16–24 px, ambient shadow
`0 4px 20px -2px rgba(30,43,60,0.06)`, min touch target 48 px (56 px in nav).

Overridden by spec 001 (spec wins):

| Token | DESIGN.md / Stitch | Use (spec RN6) |
|---|---|---|
| Status · Bien | `#4A90E2` | No ring; badge text "Bien", slate `#64748B` on `#EEF2F6` |
| Status · Atención | `#F2A93B` | `#F2A93B` (same) |
| Status · Alerta | `#E5675A` (DESIGN) / `#E5484D` (code) | `#E5484D` |
| Sensor · Sueño | `#F2A93B` (collides with Atención) | indigo `#5B5FD6` |
| Sensor · Pulso | `#E5675A` (collides with Alerta) | magenta `#D946A8` |
| Sensor · Presión | `#8B6FE8` | violet `#9D5CE6` |
| Sensor · Temperatura | `#2BB3A3` | turquoise `#14A3A0` |
| Sensor · Oxígeno | `#4A90E2` (collides with Bien) | sky `#38A3E8` |
| Range bar · allowed zone | `#4A90E2` | `#4A90E2` (zone color, not a status badge) |
| Smallest text | 12 px in legend/cuts | 13 px minimum (DESIGN.md metadata floor) |

Two separate tables in code: `SENSOR_COLORS` and `LEVEL_COLORS`. A test fails if any value appears in both.

---

## 3. Corrections to the Stitch export

| # | Problem in `code.html` | Correction |
|---|---|---|
| 1 | Tailwind from CDN, Google Fonts, Material Symbols, images from `googleusercontent.com` → **breaks offline** (the screenshot already shows broken "Base Vital Logo" and "Anatomía 3D") | Tailwind compiled at build time; Inter and icons self-hosted (subset); all images in `frontend/public/`; PWA precache |
| 2 | Body is a remote `<img>` with dots placed by `top/left %` | `BodyViewer` (React Three Fiber) with dots anchored to `.glb` empties `sensor_*`; `BodyFallback` = local PNG with dot coordinates from `constants.ts` |
| 3 | Inline `onclick` with `classList` and `setTimeout` | `SensorDot` dispatches `sensor_tapped`; the row highlight is state, not DOM manipulation |
| 4 | Zone widths, marker `left: 40%`, "tu normal" band hard-coded | `RangeBar` computes every position from thresholds + value + baseline (pure function, unit-tested) |
| 5 | Legend in the header next to the verdict → "Atención" appears twice; "Ánimo" chip pushed out | Header: "Estado de Ana" + chip **"Hoy: Atención"** + chip **"Ánimo 4/5*"**. Legend moves to the **bottom** of the metrics card with the note "* Ánimo: criterio del equipo, no clínico" |
| 6 | "Chequeo antes de salir" | "Chequeo diario" (the exit check is feature 002) |
| 7 | Badge "Bien" styled with primary blue | Status style from `LEVEL_COLORS` (Bien = slate, no color alarm) |
| 8 | Sueño value painted amber | Value text always `#1E2B3C`; only badge, ring and zone carry status color |
| 9 | Salud / Agenda / Guía tabs link to `#` | Visible but disabled with "Próximamente" (out of scope in 001) |
| 10 | "Sin internet ✓" always shown | Driven by the `Connectivity` port: offline → "Sin internet · todo funciona", online → "Conectado" |
| 11 | No demo scenario selector | `DemoScenarioSelect` in a discreet corner (FR-013), with the "reinicia el historial" warning |
| 12 | Static values in markup | Everything comes from `HomeView` (see `base-vital-home-data-mapping.md`) |

---

## 4. Components (reuse first)

| Component | Status | Props (from `HomeView`) |
|---|---|---|
| `Card`, `SectionHeader`, `Badge`, `Button`, `StatCard` | Existing set — reuse | — |
| `NowCard` | New (composes Card + Button) | `now` |
| `NextList` | New (composes Card) | `next[]`, `pendingToday` |
| `StatusHeader` | New | `verdict`, `mood` |
| `MetricRow` | New (composes StatCard) | one `readings[i]` |
| `RangeBar` | New | `sensor`, `value`, `marker`, `baseline` — zones from thresholds |
| `Legend` | New | none (static, from messages) |
| `BodyViewer` / `SensorDot` / `BodyFallback` | New | `readings`, `focus`, `onSensorTap` |
| `DemoScenarioSelect` | New | `scenarios`, `onSelect` |

---

## 5. Acceptance (visual, checkable by a non-technical person)

- With the network cable unplugged, the Home screen loads with the logo, the body and the icons (no broken images).
- "Atención" appears only once in the card header; the legend is at the bottom.
- No sensor dot has the same color as any status badge.
- Changing the demo scenario to "CA4" shows Sueño 5 h · Atención and the verdict "Hoy: Atención".
- Tapping a body dot highlights its metric row; rotating the body keeps the dots on their spots.
- Every range bar marker sits on its value (118 between 90 and 120, etc.).
