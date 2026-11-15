import { DemoScenarioId } from '@base-vital/contracts';
import { DEFAULT_SCENARIO_ID } from '../../config/demoScenarios';

// Use case: remember which demo scenario the device shows. The storage is injected
// (localStorage in the browser, a fake in tests); this module reads no globals.

/** localStorage key holding the active demo scenario id. */
export const SCENARIO_STORAGE_KEY = 'base-vital.scenario';

/** The subset of the Web Storage API this use case needs (injectable for tests). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Reads the persisted scenario id; falls back to the default on any problem. */
export function getStoredScenarioId(storage: StorageLike | undefined): DemoScenarioId {
  try {
    const parsed = DemoScenarioId.safeParse(storage?.getItem(SCENARIO_STORAGE_KEY));
    return parsed.success ? parsed.data : DEFAULT_SCENARIO_ID;
  } catch {
    return DEFAULT_SCENARIO_ID;
  }
}

/** Persists the scenario id. Invalid ids are ignored; storage errors are swallowed. */
export function setStoredScenarioId(id: DemoScenarioId, storage: StorageLike | undefined): void {
  if (!DemoScenarioId.safeParse(id).success) {
    return;
  }
  try {
    storage?.setItem(SCENARIO_STORAGE_KEY, id);
  } catch {
    // Storage may be full or disabled; the scenario then lasts for this session only.
  }
}
