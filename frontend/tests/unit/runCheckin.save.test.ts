/**
 * Save effect of the check-in runner (T093, US6, Principle IX). Written before the
 * implementation: the `save` effect must build the full CheckRecord and persist it through
 * CheckRepositoryPort before the runner reaches `saved`.
 */
import { describe, it, expect, vi } from 'vitest';
import { CheckRecord, type CheckRecord as CheckRecordType } from '@base-vital/contracts';
import { createCheckinRunner } from '../../src/application/use-cases/runCheckin';
import { evaluateFromState } from '../../src/application/use-cases/evaluateFromState';
import type { CheckRepositoryPort } from '../../src/application/ports';
import { checkinScripts } from '../../src/config/checkinScripts';
import { SAVE_TIMEOUT_MS } from '../../src/config/constants';
import { DEMO_AGENDA } from '../../src/config/agenda';
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

/** CA4 values: 118/76 mmHg, 72 bpm, 98 %, 36.8 °C. */
const CA4_DEVICES = {
  resting_heart_rate: 72,
  blood_pressure: { systolic: 118, diastolic: 76 },
  body_temperature: 36.8,
  oxygen_saturation: 98,
};

/** Repository whose `save` waits for the test to settle it. */
class DeferredRepository implements CheckRepositoryPort {
  readonly saves: CheckRecordType[] = [];
  private settle: ((error: Error | null) => void) | null = null;

  save(record: CheckRecordType): Promise<void> {
    this.saves.push(record);
    return new Promise<void>((resolve, reject) => {
      this.settle = (error) => (error === null ? resolve() : reject(error));
    });
  }

  resolveSave(): void {
    this.settle?.(null);
  }

  rejectSave(error: Error): void {
    this.settle?.(error);
  }

  async list(): Promise<CheckRecordType[]> {
    return [];
  }

  async seedIfEmpty(): Promise<void> {}

  async clear(): Promise<void> {}
}

function setup(repository: CheckRepositoryPort) {
  const voice = new FakeVoice({ mode: 'manual' });
  const clock = new FixedClock(new Date(2026, 10, 15, 9, 20));
  const runner = createCheckinRunner({
    recognizer: voice,
    synthesizer: voice,
    devices: new FakeDevices(CA4_DEVICES, clock.now().toISOString()),
    agenda: new StaticAgenda(DEMO_AGENDA),
    clock,
    evaluate: (state) => evaluateFromState(state, { at: clock.now().toISOString() }),
    script: checkinScripts.daily,
    repository,
  });
  return { voice, runner, clock };
}

/** Sends each answer once the voice is listening again. */
async function answerEach(voice: FakeVoice, answers: string[]): Promise<void> {
  for (const answer of answers) {
    await until(() => voice.isListening());
    voice.answer(answer);
    await tick();
  }
}

/** The CA4 answers: sleep 5 h, mood 4, no symptoms, and "sí" to close the next-activity question. */
const CA4_ANSWERS = ['cinco horas', 'sí', 'cuatro', 'sí', 'no'];

describe('check-in save (T093)', () => {
  it('a full CA4 check-in persists exactly one parseable record with the evaluated facts', async () => {
    const repository = new MemoryCheckRepository();
    const { voice, runner, clock } = setup(repository);

    void runner.start();
    await answerEach(voice, [...CA4_ANSWERS, 'sí']);
    await until(() => runner.getSnapshot().step === 'saved');

    const records = await repository.list();
    expect(records).toHaveLength(1);
    const [record] = records;
    expect(() => CheckRecord.parse(record)).not.toThrow();

    // The id is the ISO timestamp of the injected clock, so Home's `new Date(record.id)` matches.
    expect(record.id).toBe(clock.now().toISOString());
    expect(new Date(record.id).getTime()).toBe(clock.now().getTime());

    // Voice values keep source 'voice'; device values keep source 'device'.
    const sleep = record.observations.find((o) => o.indicator === 'sleep_hours');
    const mood = record.observations.find((o) => o.indicator === 'mood');
    expect(sleep).toMatchObject({ source: 'voice', confirmed: true, value: 5 });
    expect(mood).toMatchObject({ source: 'voice', confirmed: true, value: 4 });
    const devices = record.observations.filter((o) => o.source === 'device');
    expect(devices.map((o) => o.indicator).sort()).toEqual(
      ['blood_pressure', 'body_temperature', 'oxygen_saturation', 'resting_heart_rate'].sort(),
    );

    // Verdict, action and readings are the evaluated ones (RN5, RF9).
    expect(record.verdict).toBe('attention');
    expect(record.actionKey).toBe('action.slept_little');
    expect(record.readings.sleep).toMatchObject({ level: 'amber', reason: 'sleep_hours', value: '5 h' });
    expect(record.symptoms).toEqual(['none']);
    expect(record.simulated).toBe(false);
  });

  it('a saved check-in keeps the readings snapshot that the runner evaluated', async () => {
    const repository = new MemoryCheckRepository();
    const evaluated: Array<ReturnType<typeof evaluateFromState>> = [];
    const voice = new FakeVoice({ mode: 'manual' });
    const clock = new FixedClock(new Date(2026, 10, 15, 9, 20));
    const runner = createCheckinRunner({
      recognizer: voice,
      synthesizer: voice,
      devices: new FakeDevices(CA4_DEVICES, clock.now().toISOString()),
      agenda: new StaticAgenda(DEMO_AGENDA),
      clock,
      evaluate: (state) => {
        const result = evaluateFromState(state, { at: clock.now().toISOString() });
        evaluated.push(result);
        return result;
      },
      script: checkinScripts.daily,
      repository,
    });

    void runner.start();
    await answerEach(voice, [...CA4_ANSWERS, 'sí']);
    await until(() => runner.getSnapshot().step === 'saved');

    const [record] = await repository.list();
    expect(record.readings).toEqual(evaluated[0].readings);
  });

  it('reaches saved only after the repository write resolves', async () => {
    const repository = new DeferredRepository();
    const { voice, runner } = setup(repository);

    void runner.start();
    await answerEach(voice, [...CA4_ANSWERS, 'sí']);
    await until(() => repository.saves.length === 1);

    // The write is still pending: the flow has not reached `saved`.
    expect(runner.getSnapshot().step).toBe('next_activity');

    repository.resolveSave();
    await until(() => runner.getSnapshot().step === 'saved');
    expect(runner.getSnapshot().saveFailed).toBe(false);
  });

  it('a rejected save still ends the runner and exposes saveFailed', async () => {
    const repository = new DeferredRepository();
    const { voice, runner } = setup(repository);

    void runner.start();
    await answerEach(voice, [...CA4_ANSWERS, 'sí']);
    await until(() => repository.saves.length === 1);

    repository.rejectSave(new Error('quota exceeded'));
    await until(() => runner.getSnapshot().step === 'saved');
    expect(runner.getSnapshot().saveFailed).toBe(true);
  });

  it('a save that never settles times out: saveFailed is set and the runner still reaches saved', async () => {
    const repository = new DeferredRepository();
    const { voice, runner } = setup(repository);

    void runner.start();
    await answerEach(voice, CA4_ANSWERS);
    await until(() => voice.isListening());

    // Fake timers only around the final answer: the save's timeout is the one under test.
    vi.useFakeTimers();
    try {
      voice.answer('sí');
      for (let i = 0; i < 100 && runner.getSnapshot().step !== 'saved'; i += 1) {
        await vi.advanceTimersByTimeAsync(SAVE_TIMEOUT_MS / 10);
      }
      expect(repository.saves).toHaveLength(1);
      expect(runner.getSnapshot().step).toBe('saved');
      expect(runner.getSnapshot().saveFailed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('unconfirmed voice values are never persisted: a denied value is replaced by the confirmed one', async () => {
    const repository = new MemoryCheckRepository();
    const { voice, runner } = setup(repository);

    void runner.start();
    // "siete" is read back and denied; only "cinco", confirmed with "sí", may be saved.
    await answerEach(voice, ['siete', 'no', 'cinco horas', 'sí', 'cuatro', 'sí', 'no', 'sí']);
    await until(() => runner.getSnapshot().step === 'saved');

    const [record] = await repository.list();
    const voiceValues = record.observations.filter((o) => o.source === 'voice');
    expect(voiceValues.every((o) => o.confirmed)).toBe(true);
    expect(voiceValues.map((o) => [o.indicator, o.value]).sort()).toEqual([
      ['mood', 4],
      ['sleep_hours', 5],
    ]);
    expect(record.observations.some((o) => o.value === 7)).toBe(false);
  });
});
