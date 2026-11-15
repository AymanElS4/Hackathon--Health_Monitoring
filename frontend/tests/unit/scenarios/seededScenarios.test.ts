/**
 * Regression of the seeded history (T088) for the scenarios other than CA4: the daily check-in runs
 * with the 14 seeded days as history and must still give the expected verdict and action.
 *
 * - `missing_sensor`: blood pressure sends nothing (CL2) → attention with `action.missing_data`.
 * - `low_temp`: temperature 35.6 °C is in doubt (RN1, RN4) → attention with `action.in_doubt`.
 *
 * Answers: sleep "siete" (7 h), mood "cuatro" (4), no symptoms, then "sí" to the next activity.
 */
import { describe, it, expect } from 'vitest';
import type { DemoScenarioId } from '@base-vital/contracts';
import { createCheckinRunner } from '../../../src/application/use-cases/runCheckin';
import { evaluateFromState } from '../../../src/application/use-cases/evaluateFromState';
import { seedIfEmpty } from '../../../src/application/use-cases/seedHistory';
import { checkinScripts } from '../../../src/config/checkinScripts';
import { DEMO_SCENARIOS } from '../../../src/config/demoScenarios';
import { DEMO_AGENDA } from '../../../src/config/agenda';
import { FakeVoice } from '../../../src/adapters/fakes/FakeVoice';
import { FixedClock } from '../../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../../src/adapters/fakes/MemoryCheckRepository';
import { SimulatedDevices } from '../../../src/adapters/simulated-devices/SimulatedDevices';
import { StaticAgenda } from '../../../src/adapters/static-agenda/StaticAgenda';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function until(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !cond(); i += 1) await tick();
  expect(cond()).toBe(true);
}

/** Runs the daily check-in of `scenario` on a repository seeded with its history. */
async function runSeeded(scenario: DemoScenarioId) {
  const voice = new FakeVoice({ mode: 'manual' });
  const clock = new FixedClock(new Date(2026, 10, 15, 9, 30));
  const devices = new SimulatedDevices(DEMO_SCENARIOS[scenario], { clock: () => clock.now() });
  const repository = new MemoryCheckRepository();
  await seedIfEmpty(repository, DEMO_SCENARIOS[scenario], { now: clock.now() });

  const captured: { result: ReturnType<typeof evaluateFromState> | null } = { result: null };
  let historyDays = -1;
  const runner = createCheckinRunner({
    recognizer: voice,
    synthesizer: voice,
    devices,
    agenda: new StaticAgenda(DEMO_AGENDA),
    clock,
    repository,
    evaluate: (state, history) => {
      historyDays = history.length;
      captured.result = evaluateFromState(state, { at: clock.now().toISOString(), history });
      return captured.result;
    },
    script: checkinScripts.daily,
  });

  await runner.start();
  for (const answer of ['siete', 'sí', 'cuatro', 'sí', 'no', 'sí']) {
    await until(() => voice.isListening());
    voice.answer(answer);
    await tick();
  }
  await until(() => runner.getSnapshot().step === 'saved');
  if (captured.result === null) throw new Error('the check-in was not evaluated');
  return { result: captured.result, historyDays };
}

describe('seeded history for the other demo scenarios (T088 regression)', () => {
  it('missing_sensor: attention with action.missing_data, the baseline history is active', async () => {
    const { result, historyDays } = await runSeeded('missing_sensor');

    expect(historyDays).toBe(14);
    expect(result.verdict).toBe('attention');
    expect(result.actionKey).toBe('action.missing_data');
    expect(result.missingSensor).toBe('pressure');
  });

  it('low_temp: attention with action.in_doubt, the baseline history is active', async () => {
    const { result, historyDays } = await runSeeded('low_temp');

    expect(historyDays).toBe(14);
    expect(result.verdict).toBe('attention');
    expect(result.actionKey).toBe('action.in_doubt');
  });
});
