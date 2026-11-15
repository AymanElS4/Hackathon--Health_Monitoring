# Contract: Application ports

Defined one file per port in `frontend/src/application/ports/` (barrel `index.ts`). `domain` never imports adapters; adapters implement these.
Every port has a real adapter and a fake one. Device values and seeded history come from the active
demo scenario (`frontend/src/config/demoScenarios.ts`), chosen from the visible "Escenario de demo" selector
(FR-013). `?fake=voice` remains a developer-only switch to run without a microphone.

```ts
interface SpeechRecognizerPort {
  /** Starts listening with a step grammar; resolves the final transcript or null on timeout. */
  listen(grammar: readonly string[], opts: { timeoutMs: number }): Promise<string | null>;
  stop(): void;
  /** Loads the model once; idempotent. Called when Home opens. */
  preload(): Promise<void>;
}

interface SpeechSynthesizerPort {
  /** Speaks a Spanish line; resolves when finished (or immediately if no local voice). */
  speak(text: string): Promise<void>;
  cancel(): void;
}

interface DevicePort {
  /** Reads one vital; null when the device sends nothing (CL2). */
  read(indicator: 'resting_heart_rate' | 'blood_pressure' | 'body_temperature' | 'oxygen_saturation'):
    Promise<Observation | null>;
}

interface CheckRepositoryPort {
  save(record: CheckRecord): Promise<void>;
  list(): Promise<CheckRecord[]>;          // newest first
  seedIfEmpty(records: CheckRecord[]): Promise<void>;
  clear(): Promise<void>; // used when the demo scenario changes (FR-013)
}

interface AgendaPort { next(now: Date): AgendaItem | null; }
interface ConnectivityPort { isOnline(): boolean; subscribe(cb: (online: boolean) => void): () => void; }
interface ClockPort  { now(): Date; }
```

| Port | Real adapter (`frontend/src/adapters/…`) | Fake adapter (`frontend/src/adapters/fakes/…`) |
|---|---|---|
| SpeechRecognizer | `vosk/` (Web Worker; model preloaded when Home opens) | `FakeVoice` (on-screen input; or always `null` in scenario `voice_not_understood`) |
| SpeechSynthesizer | `web-speech-tts/` (`speechSynthesis`, local `es` voice) | `FakeVoice` (captions only) |
| Device | `simulated-devices/` (values from the active demo scenario) | `FakeDevices` (fixed values for unit tests) |
| CheckRepository | `indexeddb/` | `MemoryCheckRepository` |
| Agenda | `static-agenda/` | same |
| Clock | `clock/SystemClock` | `FixedClock` |
| Connectivity | `navigator-connectivity/` (`navigator.onLine` + events) | `FakeConnectivity` |

Every fake passes the same contract tests as its real adapter (Liskov). Adapters are instantiated
only in `frontend/src/composition-root.ts`.

## Domain functions (pure)

```ts
// frontend/src/domain
parseUtterance(step: StepKind, transcript: string): Observation | Intent | null
// libs/health-rules
evaluateCheck(input: { observations; symptoms; history: CheckRecord[] }):
  { readings: Record<SensorKey, SensorReading>; verdict: Verdict; actionKey: string }
// actionKey is '' when the verdict is ok (no action); non-empty for attention and alert.
computeBaseline(history: CheckRecord[]): Record<string, Baseline>
checkinReducer(state: CheckinState, event: CheckinEvent): { state: CheckinState; effects: Effect[] }
```

`Intent` = `confirm` | `deny` | `pause` | `resume` | `repeat`.
`Effect` = `speak(key, params)` | `listen(grammar)` | `setFocus(sensor | null)` | `readDevices()` |
`evaluate()` | `save()` | `showButtons(step)`.
