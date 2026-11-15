# Implementation Plan: Base Vital — Chequeo diario por voz con cuerpo 3D v0

**Branch**: `001-chequeo-diario-voz-cuerpo` | **Date**: 2026-11-15 (repo split + Home UI) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-chequeo-diario-voz-cuerpo/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A one-tap daily check-in: Vita asks sleep hours, mood and symptoms by voice (Spanish, offline),
reads every number back for confirmation, pulls four vitals from simulated station devices, and
shows a rotatable 3D body with one colored dot per sensor, a metric row per value (range + "tu
normal") and a single-action verdict, then saves the record locally. The Home screen follows
`docs/base-vital-ui-build-spec.md` (corrections §3, components §4) fed by one `HomeView` object as
defined in `docs/base-vital-home-data-mapping.md`.

Built as npm workspaces: `libs/contracts` (Zod, defined once), `libs/health-rules` (pure rules and
thresholds) and `frontend/` (offline PWA: Vite + React 18, Vosk in a Web Worker, `speechSynthesis`,
React Three Fiber). `backend/` exists only as an empty hexagonal skeleton (folders + one-line README,
not a workspace); its code arrives with `004-resumen-cirujano`
(constitution 1.2.0 allows a server only off the astronaut's critical path). Voice/3D design detail
lives in `base-vital-voice-blender-integration-spec.md`; where it conflicts with the clarified spec,
the spec wins (see [research.md §A](./research.md)).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20+ for tooling; Python 3.11+ for one-off
data scripts; Blender 4.x Python for the model script.

**Workspaces**: root `package.json` with `"workspaces": ["libs/*", "frontend"]` (004 adds
`"backend"`). Packages: `@base-vital/contracts`, `@base-vital/health-rules`, `@base-vital/frontend`.

**Primary Dependencies**: React 18, React Router v5.3.4, Vite 5, Zod 3, `vite-plugin-pwa`,
`vosk-browser` + `vosk-model-small-es-0.42`, `@react-three/fiber` 8, `@react-three/drei` 9, `three`,
`idb`; UI: Tailwind CSS 3 (compiled at build, config generated from `design-tokens.ts`),
`@fontsource/inter` (self-hosted), `lucide-react` (SVG icons, tree-shaken, no icon font).

**Lint**: ESLint 8 + `eslint-plugin-boundaries` (layer rules of ui-build §1.1), `max-lines`,
`no-magic-numbers`, `react/jsx-no-literals` for `frontend/src/ui/**`.

**Storage**: IndexedDB (store `checks`), seeded with 14 simulated days.

**Testing**: Vitest per workspace + React Testing Library; manual acceptance via
[quickstart.md](./quickstart.md).

**Target Platform**: Chromium-based browser (desktop and Android tablet), secure context (localhost or
HTTPS) for the microphone.

**Project Type**: offline single-page web application in a workspaces monorepo; no backend in 001.

**Performance Goals**: final transcript ≤ 800 ms; voice start ≤ 300 ms after the prompt; 3D ≥ 30 fps;
full check-in ≤ 60 s (CA1).

**Constraints**: offline after first load; no runtime request to any CDN or font/icon/image host; no
accounts, no per-user cost; works with any future backend down; `.glb` ≤ 3 MB and ≤ 30k triangles;
Vosk model ~40 MB precached; smallest text 13 px; touch targets ≥ 48 px.

**Scale/Scope**: one astronaut profile, one check-in per day, 3 screens (Home, Check-in, History).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan complies |
|---|---|---|
| I. Simplicity First | Pass, justified | Workspaces add structure, justified in Complexity Tracking (contracts shared with 004). No backend in 001. Fake adapters exist only so the demo runs without mic/model. |
| II. Language Split | Pass | UI/voice text only in `frontend/src/config/messages.es.ts` (enforced by `react/jsx-no-literals`); code, comments and these docs in English. |
| III. No Phantom Scope | Pass | Home components come from spec FR-014–FR-019. Excluded: camera/`face_fatigue`, exit check, gestures, auto-start, WESAD evaluation script, Salud/Agenda/Guía screens, backend/sync (004). |
| IV. Verifiable by non-technical person | Pass | CA1–CA8, SC-009–SC-013 and edge cases as hand scenarios in quickstart.md, run from the visible "Escenario de demo" selector (FR-013), with no URLs or flags. |
| V. Respectful Data | Pass, with check | Only derived series from WESAD and Sleep-EDF; simulated values labelled; sources in `frontend/data/SOURCES.md`; avatar is a generic placeholder. |
| VI. Never Diagnose | Pass | Verdict/action texts restricted to readings + one everyday action. The 13:00 demo agenda item is "Experimento de biología · laboratorio" (no medication). |
| VII. Offline by Default | Pass | PWA precache of app, fonts, icons (SVG in bundle), images, model, Vosk, data; local TTS voice or captions; Draco decoder bundled. |
| VIII. Every Threshold Has a Source (v1.1.0) | Pass, with gate | Thresholds only in `libs/health-rules/src/thresholds.ts`, each with a verified source or declared team criterion; sources verified before that file is written. |
| IX. Confirm Before Recording | Pass | Reducer requires `confirm` before a voice value becomes `confirmed`; repositories reject unconfirmed voice observations. |
| Prototype Constraints (v1.2.0) | Pass | No server in 001; nothing on the astronaut path calls a network service. |

**Post-design re-check**: same result.

## Project Structure

### Documentation (this feature)

```text
specs/001-chequeo-diario-voz-cuerpo/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ports.md
│   ├── body-glb.md
│   └── checkin-script.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json                      # npm workspaces: libs/*, frontend (004 adds backend)
backend/                          # empty skeleton: src/{domain,application/ports,application/use-cases,
                                  #   adapters,config}/.gitkeep + README.md (feature 004)
tsconfig.base.json
.eslintrc.cjs                     # boundaries + max-lines + no-magic-numbers + jsx-no-literals

libs/
├── contracts/                    # @base-vital/contracts — Zod schemas + inferred types
│   ├── src/{enums,entities,index}.ts
│   └── tests/
└── health-rules/                 # @base-vital/health-rules — pure, framework-free
    ├── src/{thresholds,levels,verdict,evaluateCheck,baseline,constants,index}.ts
    └── tests/

frontend/                         # @base-vital/frontend — astronaut app (offline PWA)
├── index.html · vite.config.ts · tailwind.config.ts · postcss.config.cjs
├── public/models/{body.glb,body-fallback.png,vosk/,draco/} · public/logo.svg · public/avatars/
├── data/{SOURCES.md,wesad-hr.json,sleep-history.json}
├── scripts/{blender/,data/,check-model.ts}
├── src/
│   ├── domain/                   # checkin/ (reducer), parsing/, mission/ — imports only libs/*
│   ├── application/
│   │   ├── ports/                # SpeechRecognizer, SpeechSynthesizer, Device, CheckRepository,
│   │   │                         # Agenda, Clock, Connectivity
│   │   └── use-cases/            # runCheckin, buildHomeView, seedHistory, selectDemoScenario
│   ├── adapters/                 # vosk/, web-speech-tts/, simulated-devices/, indexeddb/,
│   │                             # static-agenda/, navigator-connectivity/, clock/, fakes/
│   ├── ui/
│   │   ├── components/           # Card, SectionHeader, Badge, Button, NowCard, NextList, MetricRows,
│   │   │                         # HomeHeader, BottomNav, StatusHeader, MetricRow, RangeBar, Legend,
│   │   │                         # DemoScenarioSelect, BigButtons, VerdictPanel
│   │   ├── screens/              # Home, CheckIn, History
│   │   └── body3d/               # BodyViewer, SensorDot, BodyFallback
│   ├── config/                   # design-tokens.ts, constants.ts, messages.es.ts, demoScenarios.ts,
│   │                             # agenda.ts, mission.ts, checkinScripts.ts
│   ├── composition-root.ts       # the ONLY place adapters are instantiated
│   ├── App.tsx · main.tsx
└── tests/{unit,ui}
```

**Structure Decision**: workspaces per `docs/base-vital-ui-build-spec.md` §1; `backend/` is an empty
skeleton until 004.
Code from Phases 1–2 currently at the repo root is moved by the restructure phase in tasks.md before
any story work. Layer rules are enforced by `eslint-plugin-boundaries`: `frontend/src/domain` imports
only `libs/*`; `application` imports `domain` and its own `ports`; `adapters` and `ui` depend inward
only; `ui` never imports an adapter; `new` of an adapter only in `composition-root.ts`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| npm workspaces (3 packages) instead of one app | Contracts and health rules must be shared, unchanged, with the 004 backend (single source of truth, ui-build D1) | A single `src/` would force 004 to copy or import app code across the frontend boundary |
| Tailwind + generated config | One token source for all colors/sizes; no hex in components (RN6, ui-build §2) | Hand-written CSS repeats hex values and drifts from the tokens |
