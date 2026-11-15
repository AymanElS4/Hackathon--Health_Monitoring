import { describe, expect, it, vi } from 'vitest';
import { VoskRecognizer } from '../../../src/adapters/vosk/VoskRecognizer';
import { VOSK_FAKE_SAMPLE_RATE, createVoskWithFakes, flush } from './voskFakes';

const TIMEOUT_MS = 1000;

const setup = createVoskWithFakes;

describe('VoskRecognizer', () => {
  it('preload is idempotent', async () => {
    const s = setup();
    await Promise.all([s.rec.preload(), s.rec.preload()]);
    await s.rec.preload();
    expect(s.createModel).toHaveBeenCalledTimes(1);
  });

  it('retries preload after a failure', async () => {
    const createModel = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue({});
    const rec = new VoskRecognizer({ createModel, loadModelUrl: async () => 'blob:fake', revokeObjectURL: vi.fn() });
    await expect(rec.preload()).rejects.toThrow();
    await flush();
    await rec.preload();
    expect(createModel).toHaveBeenCalledTimes(2);
  });

  it('passes the grammar JSON and resolves the final text', async () => {
    const s = setup();
    const p = s.rec.listen(['si', 'no'], { timeoutMs: TIMEOUT_MS });
    await flush();
    expect(s.ctor).toHaveBeenCalledWith(VOSK_FAKE_SAMPLE_RATE, JSON.stringify(['si', 'no']));
    s.listeners.result({ result: { text: 'si' } });
    await expect(p).resolves.toBe('si');
    expect(s.track.stop).toHaveBeenCalled();
    expect(s.ctx.close).toHaveBeenCalled();
    expect(s.recognizer.remove).toHaveBeenCalled();
  });

  it('times out with null and cleans up', async () => {
    vi.useFakeTimers();
    try {
      const s = setup();
      const p = s.rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1);
      await expect(p).resolves.toBeNull();
      expect(s.track.stop).toHaveBeenCalled();
      expect(s.recognizer.remove).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stop() resolves null and cleans up', async () => {
    const s = setup();
    const p = s.rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
    await flush();
    s.rec.stop();
    await expect(p).resolves.toBeNull();
    expect(s.track.stop).toHaveBeenCalled();
    expect(s.ctx.close).toHaveBeenCalled();
    expect(s.recognizer.remove).toHaveBeenCalled();
  });

  it('[unk] resolves null', async () => {
    const s = setup();
    const p = s.rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
    await flush();
    s.listeners.result({ result: { text: '[unk]' } });
    await expect(p).resolves.toBeNull();
  });

  it('resolves null after timeoutMs when the model fails to load, then retries', async () => {
    vi.useFakeTimers();
    try {
      const createModel = vi.fn().mockRejectedValue(new Error('x'));
      const rec = new VoskRecognizer({ createModel, loadModelUrl: async () => 'blob:fake', revokeObjectURL: vi.fn() });
      let out: string | null | undefined;
      void rec.listen(['si'], { timeoutMs: TIMEOUT_MS }).then((v) => (out = v));
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
      expect(out).toBeUndefined();
      await vi.advanceTimersByTimeAsync(2);
      expect(out).toBeNull();
      void rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
      await vi.advanceTimersByTimeAsync(0);
      expect(createModel).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves the manifest URL against location.href', async () => {
    vi.stubGlobal('location', { href: 'http://localhost:4173/' });
    try {
      const createModel = vi.fn(async () => ({}) as never);
      const loadModelUrl = vi.fn(async () => 'blob:fake');
      await new VoskRecognizer({ createModel, loadModelUrl, revokeObjectURL: vi.fn() }).preload();
      expect(loadModelUrl).toHaveBeenCalledWith('http://localhost:4173/models/vosk/parts/manifest.json');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('VoskRecognizer model loading', () => {
  it('passes the blob URL to createModel and revokes it afterwards', async () => {
    const createModel = vi.fn().mockResolvedValue({});
    const revokeObjectURL = vi.fn();
    const rec = new VoskRecognizer({ createModel, loadModelUrl: async () => 'blob:x', revokeObjectURL });
    await rec.preload();
    expect(createModel).toHaveBeenCalledWith('blob:x');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it('revokes the blob URL when createModel fails', async () => {
    const revokeObjectURL = vi.fn();
    const rec = new VoskRecognizer({
      createModel: vi.fn().mockRejectedValue(new Error('x')),
      loadModelUrl: async () => 'blob:y',
      revokeObjectURL,
    });
    await expect(rec.preload()).rejects.toThrow();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:y');
  });

  it('listen resolves null (model unavailable) when the parts cannot be loaded', async () => {
    const createModel = vi.fn();
    const rec = new VoskRecognizer({
      createModel,
      loadModelUrl: async () => { throw new Error('missing part'); },
    });
    await expect(rec.listen(['si'], { timeoutMs: 5 })).resolves.toBeNull();
    expect(createModel).not.toHaveBeenCalled();
  });
});
