import { DEFAULT_SCENARIO_ID, DEMO_SCENARIOS } from './config/demoScenarios';
import { DEMO_AGENDA } from './config/agenda';
import { DemoScenario, DemoScenarioId } from '@base-vital/contracts';
import { SimulatedDevices } from './adapters/simulated-devices/SimulatedDevices';
import { IdbCheckRepository } from './adapters/indexeddb/IdbCheckRepository';
import { StaticAgenda } from './adapters/static-agenda/StaticAgenda';
import { SystemClock } from './adapters/clock/SystemClock';
import type { AgendaPort, CheckRepositoryPort, ClockPort, DevicePort } from './application/ports';
import {
  getStoredScenarioId,
  type StorageLike,
} from './application/use-cases/selectDemoScenario';

// Composition root (plain module, no React context yet). Picks the active demo scenario,
// reads it from the injected storage, and wires the adapters.

/** Which voice adapter family the container uses. */
export type VoiceAdapterMode = 'real' | 'fake';

// Optional WESAD pulse series (T020). Missing file => empty glob => no replay series.
const WESAD_MODULES = import.meta.glob('../data/wesad-hr.json', {
  eager: true,
  import: 'default',
});

function loadBpmSeries(): number[] | undefined {
  const data = Object.values(WESAD_MODULES)[0] as { bpm?: unknown } | undefined;
  if (!data || typeof data !== 'object' || !Array.isArray(data.bpm)) {
    return undefined;
  }
  return data.bpm.filter((value): value is number => typeof value === 'number');
}

const BPM_SERIES = loadBpmSeries();

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
  voiceMode: VoiceAdapterMode;
}

export function createContainer(options: ContainerOptions = {}): AppContainer {
  const requested = DemoScenarioId.safeParse(
    options.scenarioId ?? getStoredScenarioId(options.storage ?? defaultStorage()),
  );
  const scenarioId = requested.success ? requested.data : DEFAULT_SCENARIO_ID;
  const scenario = DEMO_SCENARIOS[scenarioId];
  const search =
    options.search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const clock = new SystemClock();

  return {
    scenario,
    devices: new SimulatedDevices(scenario, {
      bpmSeries: BPM_SERIES,
      clock: () => clock.now(),
    }),
    repository: new IdbCheckRepository(),
    agenda: new StaticAgenda(DEMO_AGENDA),
    clock,
    voiceMode: selectVoiceMode(scenario, search),
    // T037: wire SpeechRecognizerPort / SpeechSynthesizerPort here
  };
}
