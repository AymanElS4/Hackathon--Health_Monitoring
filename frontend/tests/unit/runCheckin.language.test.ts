/**
 * Check-in language end to end (006 T008): the runner reads the language once, speaks that
 * language, and the reducer listens with that language's grammar. Spanish stays the default.
 */
import { describe, it, expect, vi } from 'vitest';
import { createCheckinRunner } from '../../src/application/use-cases/runCheckin';
import { checkinScripts, SLEEP_GRAMMAR } from '../../src/config/checkinScripts';
import { tVoice } from '../../src/config/messages.es';
import type { VoiceLanguage } from '../../src/domain/parsing/parseUtterance';
import { FakeVoice } from '../../src/adapters/fakes/FakeVoice';
import { FakeDevices } from '../../src/adapters/fakes/FakeDevices';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { evaluateFromState } from '../../src/application/use-cases/evaluateFromState';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import { DEMO_AGENDA } from '../../src/config/agenda';
import type { DevicePort } from '../../src/application/ports';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function until(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !cond(); i += 1) await tick();
  expect(cond()).toBe(true);
}

function setup(language?: () => VoiceLanguage) {
  const voice = new FakeVoice({ mode: 'manual' });
  const inner = new FakeDevices({
    resting_heart_rate: 70,
    blood_pressure: { systolic: 118, diastolic: 76 },
    body_temperature: 36.6,
    oxygen_saturation: 98,
  });
  const devices: DevicePort = { read: (indicator) => inner.read(indicator) };
  const clock = new FixedClock(new Date(2026, 0, 1, 9, 0));
  const runner = createCheckinRunner({
    recognizer: voice,
    synthesizer: voice,
    devices,
    agenda: new StaticAgenda(DEMO_AGENDA),
    clock,
    repository: new MemoryCheckRepository(),
    evaluate: (state) => ({
      verdict: 'ok',
      actionKey: '',
      readings: evaluateFromState(state, { at: clock.now().toISOString() }).readings,
    }),
    script: checkinScripts.daily,
    ...(language === undefined ? {} : { language }),
  });
  return { voice, runner };
}

/** Answers the daily script in English: sleep 7 (confirmed), mood 4 (confirmed), no symptoms, next yes. */
async function answerAllEnglish(voice: FakeVoice): Promise<void> {
  for (const answer of ['seven', 'yes', 'four', 'yes', 'no', 'yes']) {
    await until(() => voice.isListening());
    voice.answer(answer);
    await tick();
  }
}

describe('check-in language (T008)', () => {
  it('en: speaks English lines, e.g. ask.sleep', async () => {
    const { voice, runner } = setup(() => 'en');
    const done = runner.start();
    await until(() => voice.spoken.includes('How many hours did you sleep?'));
    expect(voice.spoken).not.toContain(tVoice('ask.sleep'));
    await answerAllEnglish(voice);
    await done;
    expect(runner.getSnapshot().step).toBe('saved');
  });

  it('en: the reducer listens with the English sleep grammar and "seven" then "yes" proceeds', async () => {
    const { voice, runner } = setup(() => 'en');
    const grammars: (readonly string[])[] = [];
    const listen = voice.listen.bind(voice);
    voice.listen = (grammar, opts) => {
      grammars.push(grammar);
      return listen(grammar, opts);
    };

    const done = runner.start();
    await until(() => voice.isListening());
    expect(grammars[0]).toEqual([...SLEEP_GRAMMAR.en]);

    voice.answer('seven');
    await until(() => runner.getSnapshot().step === 'confirm_sleep');
    expect(runner.getSnapshot().pending).toEqual({ indicator: 'sleep_hours', value: 7 });

    voice.answer('yes');
    await until(() => runner.getSnapshot().step === 'ask_mood');
    expect(runner.getSnapshot().confirmedVoice).toEqual([{ indicator: 'sleep_hours', value: 7 }]);

    voice.answer('four');
    for (const answer of ['yes', 'no', 'yes']) {
      await until(() => voice.isListening());
      voice.answer(answer);
      await tick();
    }
    await done;
    expect(runner.getSnapshot().step).toBe('saved');
  });

  it('language is read once: changing the returned value mid-check-in keeps the spoken language', async () => {
    let current: VoiceLanguage = 'en';
    const language = vi.fn(() => current);
    const { voice, runner } = setup(language);

    const done = runner.start();
    await until(() => voice.spoken.includes('How many hours did you sleep?'));
    current = 'es';
    voice.answer('seven');
    await until(() => runner.getSnapshot().step === 'confirm_sleep');
    voice.answer('yes');
    await until(() => runner.getSnapshot().step === 'ask_mood');

    expect(language).toHaveBeenCalledTimes(1);
    expect(voice.spoken).not.toContain(tVoice('ask.mood'));
    expect(voice.spoken).toContain('From one to five, how do you feel?');
    voice.answer('four');
    for (const answer of ['yes', 'no', 'yes']) {
      await until(() => voice.isListening());
      voice.answer(answer);
      await tick();
    }
    await done;
    expect(runner.getSnapshot().step).toBe('saved');
  });

  it('default (no language dep): Spanish lines and the Spanish sleep grammar, unchanged', async () => {
    const { voice, runner } = setup();
    const done = runner.start();
    await until(() => voice.spoken.includes(tVoice('ask.sleep')));
    expect(voice.spoken).toContain(tVoice('ask.sleep'));
    voice.answer('siete');
    await until(() => runner.getSnapshot().step === 'confirm_sleep');
    expect(runner.getSnapshot().pending).toEqual({ indicator: 'sleep_hours', value: 7 });
    voice.answer('sí');
    await until(() => runner.getSnapshot().step === 'ask_mood');
    voice.answer('cuatro');
    // Finish the rest of the Spanish script.
    for (const answer of ['sí', 'no', 'sí']) {
      await until(() => voice.isListening());
      voice.answer(answer);
      await tick();
    }
    await done;
    expect(runner.getSnapshot().step).toBe('saved');
  });
});
