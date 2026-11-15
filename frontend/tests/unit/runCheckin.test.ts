import { describe, it, expect, vi } from 'vitest';
import { createCheckinRunner } from '../../src/application/use-cases/runCheckin';
import type { CheckinOutcome } from '../../src/domain/checkin/checkinReducer';
import { checkinScripts } from '../../src/config/checkinScripts';
import { t, tVoice } from '../../src/config/messages.es';
import { setLocale } from '../../src/config/i18n';
import { FakeVoice } from '../../src/adapters/fakes/FakeVoice';
import { FakeDevices } from '../../src/adapters/fakes/FakeDevices';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { evaluateFromState } from '../../src/application/use-cases/evaluateFromState';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import { DEMO_AGENDA } from '../../src/config/agenda';
import type { CheckRepositoryPort, DevicePort, SpeechRecognizerPort } from '../../src/application/ports';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function until(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !cond(); i += 1) await tick();
  expect(cond()).toBe(true);
}

/** Demo day at 09:00 local, with an "ok" outcome and no action, unless told otherwise. */
function setup(options: { at?: Date; outcome?: CheckinOutcome; recognizer?: SpeechRecognizerPort; repository?: CheckRepositoryPort } = {}) {
  const voice = new FakeVoice({ mode: 'manual' });
  const reads: string[] = [];
  const inner = new FakeDevices({
    resting_heart_rate: 70,
    blood_pressure: { systolic: 118, diastolic: 76 },
    body_temperature: 36.6,
    oxygen_saturation: 98,
  });
  const devices: DevicePort = {
    read: (indicator) => {
      reads.push(indicator);
      return inner.read(indicator);
    },
  };
  const clock = new FixedClock(options.at ?? new Date(2026, 0, 1, 9, 0));
  const agenda = new StaticAgenda(DEMO_AGENDA);
  const outcome = options.outcome ?? { verdict: 'ok', actionKey: '' };
  const runner = createCheckinRunner({
    recognizer: options.recognizer ?? voice,
    synthesizer: voice,
    devices,
    agenda,
    clock,
    repository: options.repository ?? new MemoryCheckRepository(),
    evaluate: (state) => ({
      ...outcome,
      readings: evaluateFromState(state, { at: clock.now().toISOString() }).readings,
    }),
    script: checkinScripts.daily,
  });
  return { voice, runner, reads, agenda, clock };
}

/**
 * Answers the daily script: each value is confirmed with 'sí' (confirm steps), the symptoms
 * question is answered 'no', and 'sí' closes the "next activity" question.
 */
async function answerAll(voice: FakeVoice): Promise<void> {
  for (const answer of ['siete', 'sí', 'cuatro', 'sí', 'no', 'sí']) {
    await until(() => voice.isListening());
    voice.answer(answer);
    await tick();
  }
}

describe('createCheckinRunner', () => {
  it('runs the full daily script to saved', async () => {
    const { voice, runner, reads } = setup();
    const done = runner.start();
    await answerAll(voice);
    await done;
    expect(runner.getSnapshot().step).toBe('saved');

    // 09:00 is before the check-in item at 09:30; the check-in item is skipped, so 10:00 is announced.
    const next = t('next', { title: t('agenda.eva'), time: '10:00' });
    expect(next).toBe('Lo próximo: Salida extravehicular a las 10:00.');
    expect(voice.spoken).toEqual([
      t('greet'),
      t('ask.sleep'),
      t('confirm.sleep', { hours: 7 }),
      t('ask.mood'),
      t('confirm.mood', { mood: 4 }),
      t('ask.symptoms'),
      t('measure'),
      t('verdict.ok'),
      next,
    ]);
    expect(reads).toEqual([
      'blood_pressure',
      'resting_heart_rate',
      'oxygen_saturation',
      'body_temperature',
    ]);
  });

  it('speaks the verdict and the action before the next-activity line', async () => {
    const outcome = { verdict: 'attention', actionKey: 'action.slept_little' } as const;
    const { voice, runner } = setup({ outcome });
    const done = runner.start();
    await answerAll(voice);
    await done;

    const verdict = voice.spoken.indexOf(t('verdict.attention'));
    const action = voice.spoken.indexOf(t('action.slept_little'));
    const next = voice.spoken.findIndex((line) => line.startsWith('Lo próximo'));
    expect(verdict).toBeGreaterThanOrEqual(0);
    expect(action).toBe(verdict + 1);
    expect(next).toBe(action + 1);
    expect(runner.getSnapshot().step).toBe('saved');
  });

  it('at 19:00 says there is no next activity, and the flow still finishes', async () => {
    const { voice, runner } = setup({ at: new Date(2026, 0, 1, 19, 0) });
    const done = runner.start();
    await answerAll(voice);
    await done;

    expect(voice.spoken.at(-1)).toBe(t('next.none'));
    expect(voice.spoken.at(-1)).toBe('No hay más actividades hoy.');
    expect(runner.getSnapshot().step).toBe('saved');
  });

  it('keeps listening for control words on pause, and "sigue" resumes by voice', async () => {
    const { voice, runner } = setup();
    void runner.start();
    await until(() => voice.isListening());
    // dispatch resolves when its listen settles, so the control-word listen is not awaited.
    void runner.dispatch({ type: 'pause' });
    await until(() => runner.getSnapshot().paused);
    await until(() => voice.isListening());
    expect(runner.getSnapshot().listening).toBe(true);
    expect(voice.isListening()).toBe(true);

    voice.answer('sigue');
    await until(() => !runner.getSnapshot().paused);
    await until(() => voice.isListening());
    expect(runner.getSnapshot().listening).toBe(true);
  });

  it('"para" pauses by voice, and a repeated pause keeps the mic open', async () => {
    const { voice, runner } = setup();
    void runner.start();
    await until(() => voice.isListening());
    voice.answer('para');
    await until(() => runner.getSnapshot().paused);
    await until(() => voice.isListening());
    expect(runner.getSnapshot().paused).toBe(true);
  });

  it('the repeat button stops the pending listen, speaks the prompt and listens again', async () => {
    const { voice, runner } = setup();
    const stop = vi.spyOn(voice, 'stop');
    void runner.start();
    await until(() => voice.isListening());
    const asked = voice.spoken.filter((line) => line === t('ask.sleep')).length;

    void runner.dispatch({ type: 'repeat' });

    expect(stop).toHaveBeenCalled();
    await until(() => voice.spoken.filter((line) => line === t('ask.sleep')).length === asked + 1);
    await until(() => voice.isListening());
    expect(runner.getSnapshot().listening).toBe(true);
  });

  it('dispose stops listening and speech, and later events do nothing', async () => {
    const { voice, runner } = setup();
    const stop = vi.spyOn(voice, 'stop');
    const cancel = vi.spyOn(voice, 'cancel');
    void runner.start();
    await until(() => voice.isListening());

    runner.dispose();
    expect(stop).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();

    const spokenBefore = voice.spoken.length;
    await runner.dispatch({ type: 'transcript', text: 'siete' });
    await runner.dispatch({ type: 'start' });
    for (let i = 0; i < 20; i += 1) await tick();
    expect(voice.spoken.length).toBe(spokenBefore);
    expect(voice.isListening()).toBe(false);
  });

  it('a listen that rejects leaves listening false and is not an unhandled rejection', async () => {
    const listen = vi.fn(() => Promise.reject(new Error('microphone unavailable')));
    const recognizer: SpeechRecognizerPort = {
      preload: () => Promise.resolve(),
      listen,
      stop: () => undefined,
      release: () => undefined,
      prepare: () => Promise.resolve(),
    };
    const { runner } = setup({ recognizer });

    await runner.start();
    await until(() => listen.mock.calls.length > 0);
    for (let i = 0; i < 20; i += 1) await tick();

    expect(runner.getSnapshot().listening).toBe(false);
  });

  describe('recognizer lifecycle', () => {
    it('start() prepares the recognizer once', async () => {
      const { voice, runner } = setup();
      const prepare = vi.spyOn(voice, 'prepare');
      void runner.start();
      await until(() => voice.isListening());
      expect(prepare).toHaveBeenCalledTimes(1);
    });

    it('start() on a disposed runner never prepares the mic (D50)', async () => {
      const { voice, runner } = setup();
      const prepare = vi.spyOn(voice, 'prepare');
      runner.dispose();
      await runner.start();
      expect(prepare).not.toHaveBeenCalled();
      expect(voice.isListening()).toBe(false);
    });

    it('releases the recognizer once after saved', async () => {
      const { voice, runner } = setup();
      const release = vi.spyOn(voice, 'release');
      const done = runner.start();
      await answerAll(voice);
      await done;
      expect(runner.getSnapshot().step).toBe('saved');
      expect(release).toHaveBeenCalledTimes(1);
    });

    it('dispose() releases the recognizer', async () => {
      const { voice, runner } = setup();
      const release = vi.spyOn(voice, 'release');
      void runner.start();
      await until(() => voice.isListening());
      runner.dispose();
      expect(release).toHaveBeenCalled();
    });

    it('a rejected save still dispatches saved and releases the recognizer', async () => {
      const repository = new MemoryCheckRepository();
      vi.spyOn(repository, 'save').mockRejectedValue(new Error('disk full'));
      const { voice, runner } = setup({ repository });
      const release = vi.spyOn(voice, 'release');
      const done = runner.start();
      await answerAll(voice);
      await done;
      expect(runner.getSnapshot().step).toBe('saved');
      expect(runner.getSnapshot().saveFailed).toBe(true);
      expect(release).toHaveBeenCalledTimes(1);
    });

    it('a repeat during the save does not reopen the microphone after saved', async () => {
      const inner = new MemoryCheckRepository();
      let resolveSave!: () => void;
      const repository: CheckRepositoryPort = Object.create(inner);
      repository.save = (record) =>
        new Promise<void>((resolve) => {
          resolveSave = () => void inner.save(record).then(() => resolve());
        });
      const { voice, runner } = setup({ repository });
      const events: string[] = [];
      const listen = vi.spyOn(voice, 'listen');
      vi.spyOn(voice, 'release').mockImplementation(() => void events.push('release'));
      const speak = voice.speak.bind(voice);
      let held: (() => void) | null = null;
      let hold = false;
      vi.spyOn(voice, 'speak').mockImplementation((text: string) =>
        hold ? new Promise<void>((resolve) => { held = resolve; }) : speak(text),
      );
      void runner.start();
      for (const answer of ['siete', 'sí', 'cuatro', 'sí', 'no', 'sí']) {
        await until(() => voice.isListening());
        voice.answer(answer);
        await tick();
      }
      await until(() => resolveSave !== undefined);
      hold = true;
      void runner.dispatch({ type: 'repeat' });
      await tick();
      resolveSave();
      await until(() => runner.getSnapshot().step === 'saved');
      const listensAtSaved = listen.mock.calls.length;
      held!();
      for (let i = 0; i < 10; i += 1) await tick();
      expect(events).toEqual(['release']);
      expect(listen.mock.calls.length).toBe(listensAtSaved);
      expect(runner.getSnapshot().listening).toBe(false);
    });
  });

  it('speaks Spanish while captions follow the UI locale', async () => {
    setLocale('en');
    const { voice, runner } = setup();
    const done = runner.start();
    await until(() => voice.spoken.length > 0);
    expect(voice.spoken[0]).toBe(tVoice('greet'));
    expect(voice.spoken[0]).toBe('Buenos días, Ana. Chequeo diario.');
    expect(runner.getSnapshot().caption).toBe(t('greet'));
    void done;
  });
});
