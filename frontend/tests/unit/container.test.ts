import { describe, it, expect } from 'vitest';
import { createContainer, selectVoiceMode } from '../../src/composition-root';
import {
  getStoredScenarioId,
  setStoredScenarioId,
  SCENARIO_STORAGE_KEY,
  type StorageLike,
} from '../../src/application/use-cases/selectDemoScenario';
import { DEFAULT_SCENARIO_ID, DEMO_SCENARIOS } from '../../src/config/demoScenarios';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error('storage denied');
  },
  setItem: () => {
    throw new Error('storage denied');
  },
};

describe('selectVoiceMode', () => {
  const normal = DEMO_SCENARIOS.normal;
  const neverUnderstands = DEMO_SCENARIOS.voice_not_understood;

  it('uses the real voice by default', () => {
    expect(selectVoiceMode(normal, '')).toBe('real');
    expect(selectVoiceMode(normal, '?other=voice')).toBe('real');
  });

  it('uses the fake voice when fake=voice is in the URL', () => {
    expect(selectVoiceMode(normal, '?fake=voice')).toBe('fake');
  });

  it('accepts comma-separated fake values', () => {
    expect(selectVoiceMode(normal, '?fake=devices,voice')).toBe('fake');
    expect(selectVoiceMode(normal, '?fake=devices')).toBe('real');
    expect(selectVoiceMode(normal, '?fake=voicex')).toBe('real');
  });

  it('uses the fake voice when the scenario voice is never_understands', () => {
    expect(selectVoiceMode(neverUnderstands, '')).toBe('fake');
  });
});

describe('stored scenario helpers', () => {
  it('uses the storage key base-vital.scenario', () => {
    expect(SCENARIO_STORAGE_KEY).toBe('base-vital.scenario');
  });

  it('defaults to DEFAULT_SCENARIO_ID when nothing is stored', () => {
    expect(getStoredScenarioId(fakeStorage())).toBe(DEFAULT_SCENARIO_ID);
  });

  it('returns a stored valid scenario id', () => {
    expect(getStoredScenarioId(fakeStorage({ 'base-vital.scenario': 'ca4' }))).toBe('ca4');
  });

  it('ignores an invalid stored id and returns the default', () => {
    expect(getStoredScenarioId(fakeStorage({ 'base-vital.scenario': 'bogus' }))).toBe(
      DEFAULT_SCENARIO_ID,
    );
  });

  it('returns the default when storage throws on read', () => {
    expect(getStoredScenarioId(throwingStorage)).toBe(DEFAULT_SCENARIO_ID);
  });

  it('writes the id under the storage key', () => {
    const storage = fakeStorage();
    setStoredScenarioId('low_temp', storage);
    expect(storage.data.get('base-vital.scenario')).toBe('low_temp');
    expect(getStoredScenarioId(storage)).toBe('low_temp');
  });

  it('ignores an invalid id on write', () => {
    const storage = fakeStorage();
    setStoredScenarioId('bogus' as never, storage);
    expect(storage.data.has('base-vital.scenario')).toBe(false);
  });

  it('does not throw when storage throws on write', () => {
    expect(() => setStoredScenarioId('ca4', throwingStorage)).not.toThrow();
  });
});

describe('createContainer', () => {
  it('builds the scenario from the given id and selects the voice mode from the search', () => {
    const container = createContainer({
      scenarioId: 'low_temp',
      search: '?fake=voice',
      storage: fakeStorage(),
    });
    expect(container.scenario).toEqual(DEMO_SCENARIOS.low_temp);
    expect(container.voiceMode).toBe('fake');
  });

  it('falls back to the stored scenario when no id is given', () => {
    const container = createContainer({
      search: '',
      storage: fakeStorage({ 'base-vital.scenario': 'missing_sensor' }),
    });
    expect(container.scenario.id).toBe('missing_sensor');
    expect(container.voiceMode).toBe('real');
  });

  it('falls back to the default scenario when the stored id is invalid', () => {
    const container = createContainer({
      search: '',
      storage: fakeStorage({ 'base-vital.scenario': 'bogus' }),
    });
    expect(container.scenario.id).toBe(DEFAULT_SCENARIO_ID);
  });
});
