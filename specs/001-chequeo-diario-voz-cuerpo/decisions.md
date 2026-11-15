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
