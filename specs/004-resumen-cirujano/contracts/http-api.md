# HTTP API — `/api/v1`

All bodies are JSON. Unknown fields are rejected (`.strict()` on the envelope; the contract objects are
used as defined in `libs/contracts`). Errors: `{ "error": "<code>" }` with codes below.

## GET /api/v1/health  (no code)
- `200 {"status":"ok","database":"up"}`
- `503 {"status":"ok","database":"down"}`

## POST /api/v1/checks  (header `X-Sync-Code`)
Body `SyncCheck`:
```json
{
  "clientCheckId": "uuid v4 from the tablet",
  "crewId": "crew-a1b2c3",
  "kind": "daily",
  "missionDay": 23,
  "check": { "...": "CheckRecord from libs/contracts, unchanged" }
}
```
- `201 {"status":"created","id":"<server uuid>"}`
- `200 {"status":"duplicate","id":"<server uuid>"}` — same `clientCheckId` already stored (FR-007)
- `400 {"error":"invalid_check","issues":[...]}` — contract or envelope violation (FR-008),
  including duplicate indicators and `kind` ≠ `daily`
- `400 {"error":"invalid_check","issues":[]}` — data rejected by the database (SQLSTATE class 22/23)
- `400 {"error":"invalid_check","issues":[]}` — malformed JSON, checked before the code: the body parser
  runs before the guard, so malformed JSON without a code gets 400, not 401
- `401 {"error":"invalid_code"}` · `429 {"error":"too_many_attempts"}`
- `503 {"error":"database_unavailable"}` — retry later; nothing stored

## Surgeon API (header `X-Access-Code`; 401/429 as above)

### GET /api/v1/surgeon/crew
`200 [{ crewId, missionDay, completedAt, verdict, actionKey|null, simulated, openAlert: {id, urgency}|null }]`
ordered `alert`, `attention`, `ok`, then most recent first.

### GET /api/v1/surgeon/crew/:crewId
`200 { crewId, missionStartDate, latest: CheckView, history: CheckView[] }` — `history` = checks in the
14 calendar days ending on the latest check's day, newest first. `404 {"error":"not_found"}`.

`CheckView = { id, missionDay, completedAt, verdict, actionKey|null, symptoms, simulated, readings,
observations: [{indicator, value: number | {systolic, diastolic}, unit, source, confirmed, simulated}],
alert: {id, urgency, status, decision|null, decidedAt|null} | null }`

### GET /api/v1/surgeon/alerts
`200 [{ id, crewId, checkId, missionDay, verdict, urgency, createdAt }]` — open only; `now` first, then
oldest first.

### POST /api/v1/surgeon/alerts/:id/decision
Body `{ "decision": "manage_on_base" | "consult_surgeon" | "prepare_return" }`
- `200 { id, status: "decided", decision, decidedAt }`
- `404 not_found` · `409 {"error":"already_decided"}` · `400 invalid_decision`

## Page
`GET /cirujano` → HTML (Spanish strings injected from `messages.es.ts`), assets under `/cirujano/assets/`.
