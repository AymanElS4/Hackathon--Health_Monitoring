/**
 * Scenario `normal` with the seeded history (T088): the 14 simulated days must not make today's
 * verdict worse. Sleep 7 h, mood 4, no symptoms, all devices green: the verdict is `ok`.
 */
import { describe, it, expect } from 'vitest';
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

describe('normal scenario with the seeded history: the verdict stays ok', () => {
  it('reports ok and no action when the check-in is green', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    const clock = new FixedClock(new Date(2026, 10, 15, 9, 30));
    const devices = new SimulatedDevices(DEMO_SCENARIOS.normal, { clock: () => clock.now() });
    const repository = new MemoryCheckRepository();
    await seedIfEmpty(repository, DEMO_SCENARIOS.normal, { now: clock.now() });

    let evaluated: ReturnType<typeof evaluateFromState> | null = null;
    const runner = createCheckinRunner({
      recognizer: voice,
      synthesizer: voice,
      devices,
      agenda: new StaticAgenda(DEMO_AGENDA),
      clock,
      repository,
      evaluate: (state, history) => {
        evaluated = evaluateFromState(state, { at: clock.now().toISOString(), history });
        return evaluated;
      },
      script: checkinScripts.daily,
    });

    await runner.start();

    // Sleep: "siete horas" → confirm "sí"; mood: "cuatro" → confirm "sí"; no symptoms.
    for (const answer of ['siete horas', 'sí', 'cuatro', 'sí', 'no', 'sí']) {
      await until(() => voice.isListening());
      voice.answer(answer);
      await tick();
    }

    await until(() => runner.getSnapshot().step === 'saved');

    expect(evaluated).not.toBeNull();
    const result = evaluated!;
    expect(result.verdict).toBe('ok');
    expect(result.actionKey).toBe('');
    for (const sensor of ['sleep', 'pulse', 'pressure', 'temperature', 'oxygen'] as const) {
      expect(result.readings[sensor].level).toBe('green');
      expect(result.readings[sensor].outsideNormal).toBe(false);
    }
  });
});
