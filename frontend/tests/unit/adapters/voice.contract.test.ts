import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpeechRecognizerPort } from '../../../src/application/ports';
import { FakeVoice } from '../../../src/adapters/fakes/FakeVoice';
import { createVoskWithFakes, flush } from './voskFakes';

const TIMEOUT_MS = 1000;
const GRAMMAR = ['alpha', 'beta'] as const;
const PHRASE = 'alpha';
const LINE_ONE = 'first line';
const LINE_TWO = 'second line';

interface RecognizerUnderTest {
  name: string;
  create(): { recognizer: SpeechRecognizerPort; hear(text: string): void };
}

/** Each implementation under the same recognizer contract. `hear` makes the engine transcribe `text`. */
const implementations: RecognizerUnderTest[] = [
  {
    name: 'FakeVoice (manual)',
    create() {
      const voice = new FakeVoice({ mode: 'manual' });
      return { recognizer: voice, hear: (text) => voice.answer(text) };
    },
  },
  {
    name: 'VoskRecognizer (fakes)',
    create() {
      const vosk = createVoskWithFakes();
      return {
        recognizer: vosk.rec,
        hear: (text) => vosk.listeners.result({ result: { text } }),
      };
    },
  },
];

describe.each(implementations)('SpeechRecognizerPort contract: $name', ({ create }) => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preload resolves and is idempotent', async () => {
    const { recognizer } = create();
    await expect(Promise.all([recognizer.preload(), recognizer.preload()])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    await expect(recognizer.preload()).resolves.toBeUndefined();
  });

  it('listen resolves the heard text as a string', async () => {
    const { recognizer, hear } = create();
    const pending = recognizer.listen(GRAMMAR, { timeoutMs: TIMEOUT_MS });
    await flush();
    hear(PHRASE);
    await expect(pending).resolves.toBe(PHRASE);
  });

  it('listen resolves null when nothing is heard before the timeout', async () => {
    vi.useFakeTimers();
    const { recognizer } = create();
    const pending = recognizer.listen(GRAMMAR, { timeoutMs: TIMEOUT_MS });
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1);
    await expect(pending).resolves.toBeNull();
  });

  it('stop() makes a pending listen resolve null', async () => {
    const { recognizer } = create();
    const pending = recognizer.listen(GRAMMAR, { timeoutMs: TIMEOUT_MS });
    await flush();
    recognizer.stop();
    await expect(pending).resolves.toBeNull();
  });
});

describe('FakeVoice', () => {
  describe('recognizer in manual mode', () => {
    it('answer() resolves a pending listen with the text', async () => {
      const voice = new FakeVoice({ mode: 'manual' });
      const pending = voice.listen(GRAMMAR, { timeoutMs: TIMEOUT_MS });
      voice.answer(PHRASE);
      await expect(pending).resolves.toBe(PHRASE);
    });

    it('isListening() is true while listen is pending and false after it settles', async () => {
      const voice = new FakeVoice({ mode: 'manual' });
      expect(voice.isListening()).toBe(false);
      const pending = voice.listen(GRAMMAR, { timeoutMs: TIMEOUT_MS });
      expect(voice.isListening()).toBe(true);
      voice.answer(PHRASE);
      await pending;
      expect(voice.isListening()).toBe(false);
    });

    it('onListen notifies on start and end, and unsubscribe stops notifications', async () => {
      const voice = new FakeVoice({ mode: 'manual' });
      const events: boolean[] = [];
      const unsubscribe = voice.onListen((listening) => events.push(listening));
      const first = voice.listen(GRAMMAR, { timeoutMs: TIMEOUT_MS });
      voice.answer(PHRASE);
      await first;
      expect(events).toEqual([true, false]);

      unsubscribe();
      const second = voice.listen(GRAMMAR, { timeoutMs: TIMEOUT_MS });
      voice.answer(PHRASE);
      await second;
      expect(events).toEqual([true, false]);
    });

    it('times out with null when nothing answers', async () => {
      vi.useFakeTimers();
      try {
        const voice = new FakeVoice({ mode: 'manual' });
        const pending = voice.listen(GRAMMAR, { timeoutMs: TIMEOUT_MS });
        await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1);
        await expect(pending).resolves.toBeNull();
        expect(voice.isListening()).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('recognizer in never_understands mode', () => {
    it('listen always resolves null', async () => {
      const voice = new FakeVoice({ mode: 'never_understands' });
      await expect(voice.listen(GRAMMAR, { timeoutMs: TIMEOUT_MS })).resolves.toBeNull();
    });

    it('never reports listening and ignores answer()', async () => {
      const voice = new FakeVoice({ mode: 'never_understands' });
      const events: boolean[] = [];
      voice.onListen((listening) => events.push(listening));
      const pending = voice.listen(GRAMMAR, { timeoutMs: TIMEOUT_MS });
      expect(voice.isListening()).toBe(false);
      voice.answer(PHRASE);
      await expect(pending).resolves.toBeNull();
      expect(events).toEqual([]);
    });
  });

  describe('synthesizer', () => {
    it('speak() records lines in order and resolves', async () => {
      const voice = new FakeVoice({ mode: 'manual' });
      await expect(voice.speak(LINE_ONE)).resolves.toBeUndefined();
      await voice.speak(LINE_TWO);
      expect(voice.spoken).toEqual([LINE_ONE, LINE_TWO]);
    });

    it('onSpeak notifies subscribers with each line, and unsubscribe stops it', async () => {
      const voice = new FakeVoice({ mode: 'manual' });
      const heard: string[] = [];
      const unsubscribe = voice.onSpeak((text) => heard.push(text));
      await voice.speak(LINE_ONE);
      unsubscribe();
      await voice.speak(LINE_TWO);
      expect(heard).toEqual([LINE_ONE]);
    });

    it('cancel() is a no-op that keeps the recorded lines', async () => {
      const voice = new FakeVoice({ mode: 'manual' });
      await voice.speak(LINE_ONE);
      voice.cancel();
      expect(voice.spoken).toEqual([LINE_ONE]);
    });
  });
});
