import { createContext, useContext, type ReactNode } from 'react';
import type { DemoScenario, DemoScenarioId } from '@base-vital/contracts';
import type {
  AgendaPort,
  CheckRepositoryPort,
  ClockPort,
  ConnectivityPort,
  DevicePort,
  SpeechRecognizerPort,
  SpeechSynthesizerPort,
} from '../application/ports';
import type { CheckinRunner } from '../application/use-cases/runCheckin';
import type { DevMetricsRecorder } from '../application/devMetrics';
import type { StorageLike } from '../application/use-cases/selectDemoScenario';

/** What the UI may use from the container (structural; ui must not import the composition root). */
export interface AppContainer {
  scenario: DemoScenario;
  devices: DevicePort;
  repository: CheckRepositoryPort;
  agenda: AgendaPort;
  clock: ClockPort;
  connectivity: ConnectivityPort;
  voiceMode: 'real' | 'fake';
  recognizer: SpeechRecognizerPort;
  synthesizer: SpeechSynthesizerPort;
  createCheckinRunner: () => CheckinRunner;
  /** Keeps the demo scenario id; undefined when the browser has no storage. */
  storage: StorageLike | undefined;
  /** Scenario change: clears the store and writes the simulated history of scenario `id`. */
  reseedHistory?: (id: DemoScenarioId) => Promise<void>;
  /** Dev-only check-in timing (T095); absent in test containers that do not show the overlay. */
  devMetrics?: DevMetricsRecorder;
}

const AppServicesContext = createContext<AppContainer | null>(null);

/** Carries the composition-root container to the UI. The container is created in App. */
export function AppServicesProvider({
  services,
  children,
}: {
  services: AppContainer;
  children: ReactNode;
}) {
  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>;
}

export function useAppServices(): AppContainer {
  const services = useContext(AppServicesContext);
  if (services === null) {
    throw new Error('useAppServices must be used inside AppServicesProvider');
  }
  return services;
}
