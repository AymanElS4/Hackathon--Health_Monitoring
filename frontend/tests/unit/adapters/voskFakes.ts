import { vi } from 'vitest';
import {
  VoskRecognizer,
  type AudioContextHandle,
  type VoskModelHandle,
} from '../../../src/adapters/vosk/VoskRecognizer';

export const VOSK_FAKE_SAMPLE_RATE = 16000;

/** Builds a VoskRecognizer wired to in-memory fakes (no browser, no real Vosk). */
export function createVoskWithFakes() {
  const listeners: Record<string, (m: unknown) => void> = {};
  const recognizer = {
    on: vi.fn((e: string, l: (m: unknown) => void) => { listeners[e] = l; }),
    acceptWaveform: vi.fn(),
    remove: vi.fn(),
  };
  const ctor = vi.fn(function () { return recognizer; });
  const model = { KaldiRecognizer: ctor, terminate: vi.fn() } as unknown as VoskModelHandle;
  const createModel = vi.fn(async () => model);
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = vi.fn(async () => stream);
  const node = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() };
  const ctx: AudioContextHandle = {
    sampleRate: VOSK_FAKE_SAMPLE_RATE,
    destination: {},
    createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
    createScriptProcessor: () => node,
    close: vi.fn(async () => undefined),
  };
  const rec = new VoskRecognizer({
    createModel,
    loadModelUrl: async () => 'blob:fake',
    revokeObjectURL: vi.fn(),
    getUserMedia, audioContextFactory: () => ctx });
  return { rec, listeners, recognizer, ctor, createModel, track, ctx, getUserMedia };
}

/** Lets pending promise callbacks and one real macrotask run. */
export const flush = () => new Promise((r) => setTimeout(r, 0));
