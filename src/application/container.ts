import { DEFAULT_SCENARIO_ID, DEMO_SCENARIOS } from '../config/demoScenarios';
import { DEMO_AGENDA } from '../config/agenda';
import { DemoScenario, DemoScenarioId } from '../contracts';
import { SimulatedDevices } from '../adapters/devices/simulated/SimulatedDevices';
import { IdbCheckRepository } from '../adapters/storage/indexeddb/IdbCheckRepository';
import { StaticAgenda } from '../adapters/agenda/StaticAgenda';
import { SystemClock } from '../adapters/clock/SystemClock';
import type { AgendaPort, CheckRepositoryPort, ClockPort, DevicePort } from './ports';

// Composition root (plain module, no React context yet). Picks the active demo scenario,
// persists it per device, and wires the adapters.

/** localStorage key holding the active demo scenario id. */
export const SCENARIO_STORAGE_KEY = 'base-vital.scenario';

/** Which voice adapter family the container uses. */
export type VoiceAdapterMode = 'real' | 'fake';

/** The subset of the Web Storage API this module needs (injectable for tests). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

// Optional WESAD pulse series (T020). Missing file => empty glob => no replay series.
const WESAD_MODULES = import.meta.glob('../../data/wesad-hr.json', {
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

/** Reads the persisted scenario id; falls back to the default on any problem. */
export function getStoredScenarioId(storage: StorageLike | undefined = defaultStorage()): DemoScenarioId {
  try {
    const parsed = DemoScenarioId.safeParse(storage?.getItem(SCENARIO_STORAGE_KEY));
    return parsed.success ? parsed.data : DEFAULT_SCENARIO_ID;
  } catch {
    return DEFAULT_SCENARIO_ID;
  }
}

/** Persists the scenario id. Invalid ids are ignored; storage errors are swallowed. */
export function setStoredScenarioId(
  id: DemoScenarioId,
  storage: StorageLike | undefined = defaultStorage(),
): void {
  if (!DemoScenarioId.safeParse(id).success) {
    return;
  }
  try {
    storage?.setItem(SCENARIO_STORAGE_KEY, id);
  } catch {
    // Storage may be full or disabled; the scenario then lasts for this session only.
  }
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
    options.scenarioId ?? getStoredScenarioId(options.storage),
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
