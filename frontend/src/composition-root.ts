import { DEFAULT_SCENARIO_ID, DEMO_SCENARIOS } from './config/demoScenarios';
import { DEMO_AGENDA } from './config/agenda';
import { DemoScenario, DemoScenarioId } from '@base-vital/contracts';
import { reseedScenario, seedIfEmpty } from './application/use-cases/seedHistory';
import { withTimeout } from './application/use-cases/withTimeout';
import { SEED_TIMEOUT_MS } from './config/constants';
import { SimulatedDevices } from './adapters/simulated-devices/SimulatedDevices';
import { IdbCheckRepository } from './adapters/indexeddb/IdbCheckRepository';
import { StaticAgenda } from './adapters/static-agenda/StaticAgenda';
import { SystemClock } from './adapters/clock/SystemClock';
import { VoskRecognizer } from './adapters/vosk/VoskRecognizer';
import { SpeechSynth } from './adapters/web-speech-tts/SpeechSynth';
import { FakeVoice } from './adapters/fakes/FakeVoice';
import { checkinScripts } from './config/checkinScripts';
import { evaluateFromState } from './application/use-cases/evaluateFromState';
import { createCheckinRunner, type CheckinRunner } from './application/use-cases/runCheckin';
import { getLocale, subscribeLocale } from './config/i18n';
import type { VoiceLanguage } from './domain/parsing/parseUtterance';
import { createDevMetricsRecorder, type DevMetricsRecorder, type DevMetricsTap } from './application/devMetrics';
import { NavigatorConnectivity } from './adapters/navigator-connectivity/NavigatorConnectivity';
import type {
  AgendaPort,
  CheckRepositoryPort,
  ClockPort,
  ConnectivityPort,
  DevicePort,
  SpeechRecognizerPort,
  SpeechSynthesizerPort,
} from './application/ports';
import {
  getStoredScenarioId,
  type StorageLike,
} from './application/use-cases/selectDemoScenario';

// Composition root (plain module, no React context yet). Picks the active demo scenario,
// reads it from the injected storage, and wires the adapters.

/** Which voice adapter family the container uses. */
export type VoiceAdapterMode = 'real' | 'fake';

// Optional WESAD pulse series (T020). Missing file => empty glob => no series.
// Exposed on the container for history seeding (T088); not used for today's reading.
const WESAD_MODULES = import.meta.glob('../data/wesad-hr.json', {
  eager: true,
  import: 'default',
});

function loadWesadSeries(): number[] | undefined {
  const data = Object.values(WESAD_MODULES)[0] as { bpm?: unknown } | undefined;
  if (!data || typeof data !== 'object' || !Array.isArray(data.bpm)) {
    return undefined;
  }
  return data.bpm.filter((value): value is number => typeof value === 'number');
}

const WESAD_SERIES = loadWesadSeries();

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    // Accessing localStorage can throw when storage is disabled by the browser.
    return undefined;
  }
}

/**
 * Chooses the voice adapter family. Fake when the URL contains `fake=voice` among
 * comma-separated `fake=` values, or when the scenario voice is `never_understands`.
 */
export function selectVoiceMode(scenario: DemoScenario, search: string): VoiceAdapterMode {
  if (scenario.voice === 'never_understands') {
    return 'fake';
  }
  const requested = new URLSearchParams(search)
    .getAll('fake')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim());
  return requested.includes('voice') ? 'fake' : 'real';
}

export interface ContainerOptions {
  /** Explicit scenario; when absent the stored id is used. */
  scenarioId?: DemoScenarioId;
  /** URL query string used for the voice choice; defaults to window.location.search. */
  search?: string;
  /** Storage used for the persisted scenario id; defaults to localStorage. */
  storage?: StorageLike;
}

export interface AppContainer {
  scenario: DemoScenario;
  devices: DevicePort;
  repository: CheckRepositoryPort;
  agenda: AgendaPort;
  clock: ClockPort;
  connectivity: ConnectivityPort;
  voiceMode: VoiceAdapterMode;
  recognizer: SpeechRecognizerPort;
  synthesizer: SpeechSynthesizerPort;
  /** Builds a fresh check-in runner wired to this container's ports. */
  createCheckinRunner: () => CheckinRunner;
  /** WESAD resting pulse series (bpm) when `data/wesad-hr.json` is present; used for seeding. */
  wesadSeries?: number[];
  /** Startup: writes the simulated history of the active scenario when the store is empty. */
  seedHistoryIfEmpty: () => Promise<void>;
  /** Scenario change: clears the store and writes the simulated history of scenario `id`. */
  reseedHistory: (id: DemoScenarioId) => Promise<void>;
  /** Storage that keeps the demo scenario id (localStorage in the browser). */
  storage: StorageLike | undefined;
  /** Dev-only timing of the check-in (T095); the overlay reads it. */
  devMetrics: DevMetricsRecorder;
}

/**
 * Voice language of the running check-in. The runner stores it when the check-in is created
 * (from the screen locale); the adapters read it at each speak/listen, so they follow it.
 */
export interface VoiceLanguageHolder {
  current: VoiceLanguage;
}

/**
 * Keeps the voice language on the UI locale while no check-in runs, so Home preloads the model
 * of the language in use after a toggle. An active check-in keeps the language it was created with.
 * Returns the function that stops following.
 */
export function followLocaleForVoice(
  holder: VoiceLanguageHolder,
  isCheckinActive: () => boolean,
): () => void {
  return subscribeLocale(() => {
    if (!isCheckinActive()) holder.current = getLocale();
  });
}

function createVoice(
  mode: VoiceAdapterMode,
  scenario: DemoScenario,
  devMetrics: DevMetricsRecorder,
  voiceLanguage: VoiceLanguageHolder,
): { recognizer: SpeechRecognizerPort; synthesizer: SpeechSynthesizerPort } {
  if (mode === 'real') {
    const timing = {
      onListening: (at: number) => devMetrics.markListening(at),
      onFinal: ({ lastPartialAt, finalAt }: { lastPartialAt: number; finalAt: number }) =>
        devMetrics.markFinal(finalAt, lastPartialAt),
    };
    const language = () => voiceLanguage.current;
    return {
      recognizer: new VoskRecognizer({ timing, language }),
      synthesizer: new SpeechSynth({ language }),
    };
  }
  const fake = new FakeVoice({
    mode: scenario.voice === 'never_understands' ? 'never_understands' : 'manual',
  });
  return { recognizer: fake, synthesizer: fake };
}

export function createContainer(options: ContainerOptions = {}): AppContainer {
  const storage = options.storage ?? defaultStorage();
  const requested = DemoScenarioId.safeParse(
    options.scenarioId ?? getStoredScenarioId(storage),
  );
  const scenarioId = requested.success ? requested.data : DEFAULT_SCENARIO_ID;
  const scenario = DEMO_SCENARIOS[scenarioId];
  const search =
    options.search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const clock = new SystemClock();

  const voiceMode = selectVoiceMode(scenario, search);
  const devMetrics = createDevMetricsRecorder();
  const metrics: DevMetricsTap = { recorder: devMetrics, now: () => performance.now() };
  // Starts at the screen locale so Home preloads the model of the language in use.
  const voiceLanguage: VoiceLanguageHolder = { current: getLocale() };
  /** True from the creation of a check-in runner until that runner is disposed. */
  let checkinActive = false;
  followLocaleForVoice(voiceLanguage, () => checkinActive);
  const voice = createVoice(voiceMode, scenario, devMetrics, voiceLanguage);
  const devices = new SimulatedDevices(scenario, { clock: () => clock.now() });
  const agenda = new StaticAgenda(DEMO_AGENDA);
  const repository = new IdbCheckRepository();

  return {
    scenario,
    devices,
    repository,
    agenda,
    clock,
    connectivity: new NavigatorConnectivity(),
    voiceMode,
    recognizer: voice.recognizer,
    synthesizer: voice.synthesizer,
    createCheckinRunner: () => {
      checkinActive = true;
      const runner = createCheckinRunner({
        recognizer: voice.recognizer,
        synthesizer: voice.synthesizer,
        devices,
        agenda,
        clock,
        repository,
        evaluate: (state, history) =>
          evaluateFromState(state, { at: clock.now().toISOString(), history }),
        script: checkinScripts.daily,
        metrics,
        // Read once when the check-in is created; the adapters then follow the stored value.
        language: () => {
          voiceLanguage.current = getLocale();
          return voiceLanguage.current;
        },
      });
      return {
        ...runner,
        dispose: () => {
          checkinActive = false;
          runner.dispose();
        },
      };
    },
    devMetrics,
    wesadSeries: WESAD_SERIES,
    // Bounded: a seed that fails or does not settle in SEED_TIMEOUT_MS rejects, and the app renders anyway.
    seedHistoryIfEmpty: () =>
      withTimeout(
        seedIfEmpty(repository, scenario, { now: clock.now(), wesadSeries: WESAD_SERIES }),
        SEED_TIMEOUT_MS,
      ),
    reseedHistory: (id) =>
      reseedScenario(repository, DEMO_SCENARIOS[id], { now: clock.now(), wesadSeries: WESAD_SERIES }),
    storage,
  };
}
