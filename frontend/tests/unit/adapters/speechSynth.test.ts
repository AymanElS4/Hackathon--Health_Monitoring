import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MS_PER_CHARACTER,
  SAFETY_BASE_MS,
  SpeechSynth,
  VOICES_CHANGED_TIMEOUT_MS,
  type SpeechSynthLike,
} from '../../../src/adapters/web-speech-tts/SpeechSynth';

const LINE = 'Buenos días';

function voice(lang: string, localService: boolean): SpeechSynthesisVoice {
  return { name: `${lang}-${localService}`, lang, localService, voiceURI: lang, default: false } as SpeechSynthesisVoice;
}

const localEs = voice('es-MX', true);
const networkEs = voice('es-ES', false);
const localEn = voice('en-US', true);

class FakeUtterance {
  voice: SpeechSynthesisVoice | null = null;
  lang = '';
  private readonly listeners: Record<string, Array<() => void>> = {};
  constructor(public text: string) {}
  addEventListener(type: string, listener: () => void): void {
    (this.listeners[type] ??= []).push(listener);
  }
  fire(type: string): void {
    for (const listener of this.listeners[type] ?? []) listener();
  }
}

function setup(voices: SpeechSynthesisVoice[]) {
  const spoken: FakeUtterance[] = [];
  const voiceListeners: Array<() => void> = [];
  const synth = {
    speak: vi.fn((u: FakeUtterance) => { spoken.push(u); }),
    cancel: vi.fn(),
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn((_type: string, l: () => void) => { voiceListeners.push(l); }),
    removeEventListener: vi.fn((_type: string, l: () => void) => {
      voiceListeners.splice(voiceListeners.indexOf(l), 1);
    }),
  };
  const tts = new SpeechSynth({
    synth: synth as unknown as SpeechSynthLike,
    UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
  });
  const fireVoicesChanged = () => { for (const l of [...voiceListeners]) l(); };
  return { tts, synth, spoken, fireVoicesChanged };
}

const safetyMs = (text: string) => text.length * MS_PER_CHARACTER + SAFETY_BASE_MS;

describe('SpeechSynth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('picks the local es voice, ignoring a network es voice and a local en voice', async () => {
    const { tts, spoken } = setup([networkEs, localEn, localEs]);
    const done = tts.speak(LINE);
    await vi.advanceTimersByTimeAsync(0);
    expect(tts.isAvailable()).toBe(true);
    expect(spoken[0]?.voice).toBe(localEs);
    spoken[0]?.fire('end');
    await done;
  });

  it('prefers es-ES over es-MX when both are local', async () => {
    const localEsEs = voice('es-ES', true);
    const { tts, spoken } = setup([localEs, localEsEs]);
    const done = tts.speak(LINE);
    await vi.advanceTimersByTimeAsync(0);
    expect(spoken[0]?.voice).toBe(localEsEs);
    spoken[0]?.fire('end');
    await done;
  });

  it('resolves when the utterance ends', async () => {
    const { tts, spoken } = setup([localEs]);
    let resolved = false;
    const done = tts.speak(LINE).then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(false);
    spoken[0]?.fire('end');
    await done;
    expect(resolved).toBe(true);
  });

  it('resolves immediately when there is no local es voice', async () => {
    const { tts, synth } = setup([networkEs, localEn]);
    await tts.speak(LINE);
    expect(tts.isAvailable()).toBe(false);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('cancel calls the synth and resolves a pending speak', async () => {
    const { tts, synth } = setup([localEs]);
    const done = tts.speak(LINE);
    await vi.advanceTimersByTimeAsync(0);
    tts.cancel();
    await done;
    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });

  it('resolves through the safety timeout when the utterance never ends', async () => {
    const { tts } = setup([localEs]);
    let resolved = false;
    const done = tts.speak(LINE).then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(safetyMs(LINE) - 1);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(resolved).toBe(true);
  });

  it('waits once for voiceschanged when the voice list starts empty', async () => {
    const { tts, synth, fireVoicesChanged } = setup([]);
    synth.getVoices.mockReturnValue([localEs]);
    fireVoicesChanged();
    expect(tts.isAvailable()).toBe(true);
    expect(synth.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for voices after the timeout', async () => {
    const { tts, synth } = setup([]);
    await vi.advanceTimersByTimeAsync(VOICES_CHANGED_TIMEOUT_MS);
    expect(tts.isAvailable()).toBe(false);
    expect(synth.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
