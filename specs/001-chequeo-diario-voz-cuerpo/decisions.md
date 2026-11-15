# Decisions — 001-chequeo-diario-voz-cuerpo

Decisions taken while implementing, in order. Precedence used: constitution > spec.md >
docs/design/README.md > docs/base-vital-ui-build-spec.md. Each entry: what, why, rejected alternative.

## Before autonomous mode (confirmed by the user in conversation)

| # | Date | Decision | Why | Rejected |
|---|---|---|---|---|
| D1 | 2026-11-15 | Body mesh = MakeHuman hm08 neutral base mesh (CC0), only the `body` group | CC0 verified in the repo's LICENSE.md and the file header; no likeness | Adult-female morph (needs MakeHuman app + targets, not installed) |
| D2 | 2026-11-15 | Before a check, body dots are plain sensor-colored dots without labels; "sin dato" only for a sensor missing in a finished check (CL2) | Mockup + data mapping §2 (dot = sensor identity); CL2 defines "sin dato" inside a check | 5 grey "sin dato" pills on an empty Home |
| D3 | 2026-11-15 | Status pill text neutral (ink) + 8 px level marker + ring | Amber/red text on white is 1.9:1 / 3.8:1 (unreadable at 13 px); no new colors that could clash with SENSOR_COLORS | Darker amber/red text colors added to LEVEL_COLORS |
| D4 | 2026-11-15 | New contract rule: every sensor visible from the front, enforced by check:model, which runs in `npm run build` | The pressure dot was hidden behind the arm and no test caught it (CA5) | Manual visual check only |
| D5 | 2026-11-15 | Vosk model (38 MiB) published as two parts < 25 MiB + manifest with SHA-256, joined in the browser (005 FR-015) | Cloudflare Pages limit is 25 MiB per file; same origin keeps the offline precache simple | Cloudflare R2 bucket (extra service, CORS, cross-origin caching) |
| D6 | 2026-11-15 | Pages project `base-vital` is classic Pages (created with `--force` once); the auto-created Worker was deleted | 005 puts Workers out of scope | Keep the Worker static-assets deploy |
| D7 | 2026-11-15 | Oxygen sensor placed from the MakeHuman skeleton joint `joint-r-finger-2-4` (index tip) | Exact anatomical landmark instead of guessing from the hand silhouette | Lowest / most medial hand vertex heuristics |
| D8 | 2026-11-15 | Symptom chips show the 5 options at once; "Otro" is not used | User decision: one tap, within the 5-chip limit | "Otro" revealing more chips |

## Autonomous mode

| # | Date | Decision | Why | Rejected |
|---|---|---|---|---|
| D9 | 2026-11-15 | Use the existing GitHub repo `AymanElS4/Hackathon--Health_Monitoring` (public, write access) instead of creating `base-vital` | The instruction was to create a repo only if the project was not on GitHub; it already is, with the team's history | A second repo that would split the team's history |
| D10 | 2026-11-15 | Commit each approved block on branch `001-chequeo-diario-voz-cuerpo` and push that branch; do not push straight to `main` | `main` already has a teammate's parallel redesign (002-frontend, PRs #2–#3) touching Home, BodyViewer, CheckIn, History; merging it means choosing whose UI wins, which could discard a teammate's work (not reversible for them) — that is the one case where the user asked to be consulted | Force-merging 001 into `main` |
| D11 | 2026-11-15 | Until `main` contains 001, publish to Pages from the 001 build with `wrangler pages deploy` | User: "mientras tanto, con wrangler pages deploy"; only Pages, never Workers | Publishing `main`'s current build (does not contain 001) |
| D12 | 2026-11-15 | Automatic publish from `main` = GitHub Actions workflow running `wrangler pages deploy` with a Cloudflare API token stored as a GitHub secret | A Direct Upload Pages project cannot be switched to Cloudflare's Git integration; the workflow gives the same result (each push to main publishes) and the token never enters the repo | Recreating the Pages project with Git integration (needs dashboard OAuth and would change the deploy history) |
| D13 | 2026-11-15 | Agenda: an item is done only when really completed (in 001 only the daily check-in); past not-done items still count as pending but are not listed in Ahora/Después; the item in Ahora counts as pending | User correction + FR-015; listing past items in "Después" contradicts "what comes next" | Counting items as done when their time has passed |
| D14 | 2026-11-15 | "Empezar" only appears when the Ahora item is the daily check-in | FR-015 defines Empezar as starting the check; other activities have no action in 001 | Empezar on every Ahora item (it started a voice check-in for "Experimento de biología") |
| D15 | 2026-11-15 | Status badges and chips use ink text + 8 px level marker (same as D3) | #F2A93B / #E5484D text is 1.9:1 / 3.8:1; Principle IV needs it readable | Colored badge text |
| D16 | 2026-11-15 | Team-criterion line in lowercase "* criterio del equipo, no clínico", once per screen in the legend | spec.md RN6 writes it lowercase and outranks docs/design/README.md | Capitalized "Criterio" from the README |
| D17 | 2026-11-15 | Status pills placed by a per-sensor table (sleep/pulse/temperature right, pressure above-left, oxygen below-left) on a full-size body (≥ 300 px tall) | Side gutters shrank the body to ~100 px; at full size, left pills beside the arm leave the column; the table avoids overlaps | Side gutters around the canvas |

## Merge of `origin/main` (feature 002) into 001

| # | File(s) | Kept | Why | Set aside / where |
|---|---|---|---|---|
| D18 | `frontend/src/{App,main}.tsx`, `ui/screens/{Home,CheckIn,History}.tsx`, `ui/body3d/BodyViewer.tsx` | 001 version (commit a2af8e5). `pl-bodyLabelGutter pr-bodyLabelRoom` removed from Home and CheckIn (tokens removed in T072b; canvas spans the full body column). Routes stay Home, CheckIn, History; no `/agenda` route | 001 spec, tests and reviewed work define these screens; FR-018 keeps Agenda disabled and Principle III forbids routing 002 screens | 002 versions of App, main, Home, CheckIn, History, BodyViewer: verbatim under `frontend/src/features-002/` (`App.tsx`, `main.002.tsx`, `ui/screens/*`, `ui/BodyViewer.theirs.tsx`) and in `origin/main` |
| D19 | `config/messages.es.ts` | Union by rule: all 001 keys and values, plus `scenario.changeError` (used by the kept DemoScenarioSelect error path and its test) | Only keys used by kept files are added; no conflict markers | 002 keys (`home.crewName`, `agenda.daily_check`, ...): verbatim in `features-002/config/messages.es.002.ts`, not imported |
| D20 | `config/agenda.ts`, `config/demoScenarios.ts`, `tests/unit/{agenda,demoScenarios}.test.ts`, `tests/unit/devices/simulatedDevices.test.ts` | 001 versions unchanged | Demo scenario values are fixed by docs/base-vital-home-data-mapping.md section 4; the 002 versions change 001 values/keys | 002 versions: `features-002/config/{agenda,demoScenarios}.002.ts` |
| D21 | `frontend/src/index.css`, `ui/screens/agenda-002.css` | `index.css` = 001 Tailwind entry. 002's 2 450-line stylesheet preserved verbatim as `ui/screens/agenda-002.css` | Both added the same path; 001 is Tailwind with tokens; the 002 CSS defines global selectors that would restyle 001 | `agenda-002.css` is not imported by any 001 code |
| D22 | `Agenda.tsx`, `AppSidebar.tsx`, `Icon.tsx`, `bodyPreview.ts`, `homePreview.ts`, `Agenda.test.tsx`, `Home.test.tsx` | Moved under `frontend/src/features-002/` (config, ui/components, ui/screens, tests); not routed, not imported | FR-018: Agenda tab stays disabled; Principle III. Their Home test asserts 002 Home behavior and conflicts with 001's | Excluded from `tsc` (`frontend/tsconfig.json`), vitest (`vite.config.ts` `test.exclude`), eslint and prettier (`.eslintignore`, `.prettierignore`). Feature 002 re-enables them |
| D23 | `BottomNav.tsx`, `NextList.tsx`, `tests/ui/home.test.tsx`, `tests/ui/homeScreen.test.tsx`, `config/constants.ts` (`AGENDA_PATH`) | Restored to the 001 committed versions: Agenda tab and the Agenda link in Después stay disabled (SoonAction) | An earlier partial resolution had linked them to `/agenda`, contradicting FR-018 | Patch of that attempt: `merge-backup/unstaged.patch` in the session scratchpad |
| D24 | `tests/setup.ts`, `tests/unit/colors.test.ts`, `tests/ui/DemoScenarioSelect.test.tsx`, `vite.config.ts`, `ui/components/DemoScenarioSelect.tsx` | Merged: 001 settings kept (25 MiB precache limit, part globs, TZ); added 002's in-memory `localStorage` in setup, jsdom `url`, a green-level color assertion, and the change-error path of DemoScenarioSelect with its test | Harmless to 001 and covered by tests | Nothing set aside |

## T080a — chat check-in

| # | Date | Decision | Why | Rejected |
|---|---|---|---|---|
| D25 | 2026-11-15 | The runner snapshot gets read-only fields (speaking, spoken log, pending, confirmedVoice, symptoms); the reducer is unchanged | The chat needs speech state and history the old snapshot did not expose; the task forbids reducer changes | Deriving the chat from captions only (loses order and denials) |
| D26 | 2026-11-15 | The dashed live bubble shows the parsed value ("5 horas…") rather than raw partial speech | `SpeechRecognizerPort` has no partial results; adding them changes the voice port (out of UI scope) | Extending the port with partial transcripts |
| D27 | 2026-11-15 | Chips dispatch the existing `buttonAnswer` event (handled by the reducer exactly like a transcript) and close the open listen | Same outcome as voice without touching the reducer; an open listen made the mic say "Te escucho…" while Vita spoke | A new event type |
| D28 | 2026-11-15 | Quick replies at confirm_sleep, ask_mood, confirm_mood, ask_symptoms and next_activity ("👍 Sí"); no sleep chips | 0–16 h in half hours is 33 options (over the 5-chip limit); next_activity waits for "sí" and showed no prompt, delaying the save ~16 s (CA1) | Sleep chips; no prompt at next_activity |
| D29 | 2026-11-15 | Progress "Pregunta n de 3" only during the three questions (kept invisible afterwards, no layout shift); summary and "Lo próximo" folded into the verdict message; no dock on the check-in | The verdict must be Vita's last message; a dock would cover the conversation | Progress "3 de 3" during measuring; separate end card |
| D30 | 2026-11-15 | Ana's confirmations ("Sí" / "No") appear as her bubbles | The task asks for all messages of the check-in in order | Showing only the confirmed values |
| D31 | 2026-11-15 | Home "Ahora" footer (divider + estimate + Empezar) renders only when there is an estimate or the action | Review of the T072b block (L2): an empty divider row otherwise | Always rendering the footer |
