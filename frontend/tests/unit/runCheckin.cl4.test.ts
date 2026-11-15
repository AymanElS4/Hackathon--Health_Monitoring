/**
 * Runner-level wiring of the CL4 mood re-ask (T086, D33). The pulse read is compared with the
 * saved history (`pulseOutsideNormal`, RN3); the reducer then asks the mood once more when it is
 * outside "tu normal" and the mood is ≥ 4.
 */
import { describe, it, expect } from 'vitest';
import type { CheckRecord, SensorKey, SensorReading } from '@base-vital/contracts';
import { createCheckinRunner } from '../../src/application/use-cases/runCheckin';
import { evaluateFromState } from '../../src/application/use-cases/evaluateFromState';
import { checkinScripts } from '../../src/config/checkinScripts';
import { DEMO_AGENDA } from '../../src/config/agenda';
import { t } from '../../src/config/messages.es';
import { FakeVoice } from '../../src/adapters/fakes/FakeVoice';
import { FakeDevices } from '../../src/adapters/fakes/FakeDevices';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function until(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !cond(); i += 1) await tick();
  expect(cond()).toBe(true);
}

const reading = (sensor: SensorKey, value: string): SensorReading => ({
  sensor,
  level: 'green',
  phase: 'confirmed',
  value,
  outsideNormal: false,
  teamCriterion: false,
  reason: null,
});

const readings: Record<SensorKey, SensorReading> = {
  sleep: reading('sleep', '7 h'),
  pulse: reading('pulse', '62 bpm'),
  pressure: reading('pressure', '118/76 mmHg'),
  temperature: reading('temperature', '36,6 °C'),
  oxygen: reading('oxygen', '98 %'),
};

/** One saved day with a resting pulse; `day` counts back from the check-in day (1 = the day before). */
function pastDay(day: number, pulse: number): CheckRecord {
  const at = new Date(Date.UTC(2026, 10, 15 - day, 8, 0)).toISOString();
  return {
    id: at,
    observations: [
      {
        indicator: 'resting_heart_rate',
        value: pulse,
        source: 'device',
        confirmed: true,
        simulated: true,
        at,
      },
    ],
    symptoms: [],
    readings,
    verdict: 'ok',
    actionKey: '',
    simulated: true,
  };
}

/**
 * History newest first: the last two days at 72 bpm, then 14 days alternating 59 and 65 bpm
 * (mean 62, SD 3). The baseline is the first 14 days, so 72 is 10 bpm away, more than 2 SD (6).
 */
function historyWithPulse72Recent(): CheckRecord[] {
  const older = Array.from({ length: 14 }, (_, index) =>
    pastDay(index + 3, index % 2 === 0 ? 65 : 59),
  );
  return [pastDay(1, 72), pastDay(2, 72), ...older];
}

/** Runner with the given history and today's resting pulse; the other devices read normal values. */
async function setup(history: CheckRecord[], todayPulse: number) {
  const voice = new FakeVoice({ mode: 'manual' });
  const clock = new FixedClock(new Date(2026, 10, 15, 9, 30));
  const repository = new MemoryCheckRepository();
  await repository.seedIfEmpty(history);
  const runner = createCheckinRunner({
    recognizer: voice,
    synthesizer: voice,
    devices: new FakeDevices({
      resting_heart_rate: todayPulse,
      blood_pressure: { systolic: 118, diastolic: 76 },
      body_temperature: 36.6,
      oxygen_saturation: 98,
    }),
    agenda: new StaticAgenda(DEMO_AGENDA),
    clock,
    repository,
    evaluate: (state) => evaluateFromState(state, { at: clock.now().toISOString() }),
    script: checkinScripts.daily,
  });
  return { voice, runner };
}

/** Sleep "siete" and mood "cuatro", each confirmed with "sí"; no symptoms. */
async function answerUntilMeasuring(voice: FakeVoice): Promise<void> {
  for (const answer of ['siete', 'sí', 'cuatro', 'sí', 'no']) {
    await until(() => voice.isListening());
    voice.answer(answer);
    await tick();
  }
}

describe('CL4 wiring: the runner asks the mood again when the pulse is outside "tu normal"', () => {
  it('14 days at 62 ± 3 bpm, then 72 bpm today, mood 4: Vita asks the mood once more', async () => {
    const { voice, runner } = await setup(historyWithPulse72Recent(), 72);
    const done = runner.start();
    await answerUntilMeasuring(voice);

    await until(() => voice.isListening());
    expect(voice.spoken.at(-1)).toBe(t('ask.mood.again'));
    expect(runner.getSnapshot().step).toBe('ask_mood');

    // The re-asked mood is confirmed like any answer. The same value puts the mood in doubt.
    for (const answer of ['cuatro', 'sí', 'sí']) {
      await until(() => voice.isListening());
      voice.answer(answer);
      await tick();
    }
    await until(() => runner.getSnapshot().step === 'saved');
    await done;

    const snapshot = runner.getSnapshot();
    expect(snapshot.readings.find((reading) => reading.sensor === 'sleep')?.level).toBe('in_doubt');
    expect(voice.spoken.filter((line) => line === t('ask.mood.again'))).toHaveLength(1);
  });

  it('today\'s pulse within "tu normal": no re-ask, the check goes on to the next question', async () => {
    const { voice, runner } = await setup(historyWithPulse72Recent(), 62);
    const done = runner.start();
    await answerUntilMeasuring(voice);

    await until(() => voice.isListening());
    expect(voice.spoken).not.toContain(t('ask.mood.again'));
    voice.answer('sí');
    await until(() => runner.getSnapshot().step === 'saved');
    await done;
  });
});
