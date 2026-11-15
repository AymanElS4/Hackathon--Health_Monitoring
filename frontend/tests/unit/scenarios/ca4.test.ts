/**
 * CA4 / SC-011 end-to-end check (T064). Written before T068; must FAIL until `evaluateCheck`
 * exists and `evaluateFromState` (frontend/src/application/use-cases/evaluateFromState.ts) maps
 * the reducer state onto it.
 *
 * Scenario `ca4`: 118/76 mmHg, 72 bpm, 98 %, 36.8 °C, prior nights [7.1, 7.4] h. The person
 * says "cinco horas" (sleep 5 h, confirmed), "cuatro" (mood 4, confirmed), no symptoms.
 * Expected: verdict `attention`, action `action.slept_little`, sleep reading `amber` set by
 * `sleep_hours` (not a team criterion).
 *
 * Expected helper (implemented with T068, moved into a use case or the composition root):
 *
 *   evaluateFromState(state: CheckinState, opts: { at: string }): {
 *     readings: Record<SensorKey, SensorReading>;
 *     verdict: Verdict;
 *     actionKey: string;
 *   }
 *
 * It maps `state.confirmedVoice` to confirmed voice Observations, `state.confirmed` to the
 * device Observations, `state.symptoms` to symptoms, and passes the `history` it is given to `evaluateCheck`.
 * The runner's `evaluate` hook receives the reducer state and returns the full result; the
 * reducer only reads `verdict` and `actionKey` from it.
 *
 * The 14 days before today are the seeded simulated history (T088, prior nights 7.1 and 7.4 h): the
 * repository holds them, the runner passes them to `evaluate` (newest first) and the baseline is active.
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
import { seedIfEmpty } from '../../../src/application/use-cases/seedHistory';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function until(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !cond(); i += 1) await tick();
  expect(cond()).toBe(true);
}

describe('CA4 / SC-011: sleep 5 h with the rest green gives attention', () => {
  it('runs the daily check-in on scenario ca4 and reports attention with the slept-little action', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    const clock = new FixedClock(new Date(2026, 10, 15, 9, 30));
    const devices = new SimulatedDevices(DEMO_SCENARIOS.ca4, { clock: () => clock.now() });

    // The 14 seeded days before today (T088) are the history of the check-in.
    const repository = new MemoryCheckRepository();
    await seedIfEmpty(repository, DEMO_SCENARIOS.ca4, { now: clock.now() });

    let evaluated: ReturnType<typeof evaluateFromState> | null = null;
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
        evaluated = evaluateFromState(state, { at: clock.now().toISOString(), history });
        return evaluated;
      },
      script: checkinScripts.daily,
    });

    await runner.start();

    // Sleep: "cinco horas" → confirm "sí"; mood: "cuatro" → confirm "sí"; no symptoms.
    for (const answer of ['cinco horas', 'sí', 'cuatro', 'sí', 'no', 'sí']) {
      await until(() => voice.isListening());
      voice.answer(answer);
      await tick();
    }

    await until(() => runner.getSnapshot().step === 'saved');

    expect(evaluated).not.toBeNull();
    const result = evaluated!;
    // The runner passed the 14 seeded days (baseline active: "tu normal" needs 14).
    expect(historyDays).toBe(14);

    // Verdict and action (RN5 / SC-011).
    expect(result.verdict).toBe('attention');
    expect(result.actionKey).toBe('action.slept_little');
    expect(runner.getSnapshot().outcome).toMatchObject({
      verdict: 'attention',
      actionKey: 'action.slept_little',
    });

    // Sleep sensor: amber because of the sleep hours, not a team criterion (RN6, Principle VIII).
    expect(result.readings.sleep).toMatchObject({
      level: 'amber',
      reason: 'sleep_hours',
      value: '5 h',
      teamCriterion: false,
    });

    // Captions: the verdict headline, then the single action, in this order.
    const headlineAt = voice.spoken.indexOf(t('verdict.attention'));
    expect(headlineAt).toBeGreaterThanOrEqual(0);
    expect(voice.spoken[headlineAt + 1]).toBe('Dormiste poco: tómalo con calma');
    expect(voice.spoken[headlineAt + 1]).toBe(t('action.slept_little'));
  });
});
