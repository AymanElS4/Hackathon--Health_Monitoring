/**
 * Scenario `missing_sensor`: the blood pressure sensor sends nothing (CL2). The check-in never
 * reads as ok; the one action names the missing sensor, with no placeholder left in the text.
 *
 * Sleep "siete" (7 h, confirmed), mood "cuatro" (4, confirmed), no symptoms. The other sensors
 * are green, so the verdict is `attention` with `action.missing_data` and the sensor `pressure`.
 */
import { describe, it, expect } from 'vitest';
import { createCheckinRunner } from '../../../src/application/use-cases/runCheckin';
import { evaluateFromState } from '../../../src/application/use-cases/evaluateFromState';
import { checkinScripts } from '../../../src/config/checkinScripts';
import { DEMO_SCENARIOS } from '../../../src/config/demoScenarios';
import { DEMO_AGENDA } from '../../../src/config/agenda';
import { t } from '../../../src/config/messages.es';
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

describe('scenario missing_sensor: the action names the sensor with no data (CL2)', () => {
  it('speaks "Falta el dato de la presión" and carries the sensor as an action param', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    const clock = new FixedClock(new Date(2026, 10, 15, 9, 20));
    const devices = new SimulatedDevices(DEMO_SCENARIOS.missing_sensor, { clock: () => clock.now() });

    let evaluated: ReturnType<typeof evaluateFromState> | null = null;
    const runner = createCheckinRunner({
      recognizer: voice,
      synthesizer: voice,
      devices,
      agenda: new StaticAgenda(DEMO_AGENDA),
      clock,
      repository: new MemoryCheckRepository(),
      evaluate: (state) => {
        evaluated = evaluateFromState(state, { at: clock.now().toISOString() });
        return evaluated;
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

    expect(evaluated).not.toBeNull();
    expect(evaluated!.verdict).toBe('attention');
    expect(evaluated!.actionKey).toBe('action.missing_data');
    expect(evaluated!.missingSensor).toBe('pressure');

    const expected = t('action.missing_data', { sensor: t('sensor.lower.pressure') });
    expect(expected).toBe('Falta el dato de la presión: repite la medida');
    expect(runner.getSnapshot().outcome).toMatchObject({
      verdict: 'attention',
      actionKey: 'action.missing_data',
      actionParams: { sensor: 'la presión' },
      teamCriterion: false,
    });
    expect(voice.spoken).toContain(expected);
    expect(voice.spoken.some((line) => line.includes('{'))).toBe(false);
  });
});
