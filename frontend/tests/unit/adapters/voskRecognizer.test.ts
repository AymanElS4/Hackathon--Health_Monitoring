import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  VoskRecognizer,
  type AudioContextHandle,
  type VoiceLanguage,
  type VoskModelHandle,
  type VoskRecognizerHandle,
} from '../../../src/adapters/vosk/VoskRecognizer';
import { VOSK_FAKE_SAMPLE_RATE, createVoskWithFakes, flush } from './voskFakes';

interface FakeHandle extends VoskRecognizerHandle {
  listeners: Record<string, (m: { result?: { text?: string } }) => void>;
}
/** A recognizer handle that records its event listeners so a test can emit results. */
function fakeHandle(): FakeHandle {
  const listeners: FakeHandle['listeners'] = {};
  return {
    listeners,
    on: vi.fn((e: string, l: (m: { result?: { text?: string } }) => void) => { listeners[e] = l; }),
    acceptWaveform: vi.fn(),
    remove: vi.fn(),
  } as unknown as FakeHandle;
}

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
    // The microphone and the recognizer stay open between listens; release() closes them.
    expect(s.track.stop).not.toHaveBeenCalled();
    s.rec.release();
    await flush();
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
      expect(s.recognizer.remove).toHaveBeenCalled();
      s.rec.release();
      await vi.advanceTimersByTimeAsync(0);
      expect(s.track.stop).toHaveBeenCalled();
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
    expect(s.recognizer.remove).toHaveBeenCalled();
    s.rec.release();
    await flush();
    expect(s.track.stop).toHaveBeenCalled();
    expect(s.ctx.close).toHaveBeenCalled();
  });

  it('opens the microphone once across several listens and creates a recognizer per listen', async () => {
    const s = setup();
    for (const text of ['si', 'no', 'si']) {
      const p = s.rec.listen(['si', 'no'], { timeoutMs: TIMEOUT_MS });
      await flush();
      s.listeners.result({ result: { text } });
      await expect(p).resolves.toBe(text);
    }
    expect(s.getUserMedia).toHaveBeenCalledTimes(1);
    expect(s.ctor).toHaveBeenCalledTimes(3);
    const p = s.rec.listen(['otro'], { timeoutMs: TIMEOUT_MS });
    await flush();
    expect(s.ctor).toHaveBeenCalledTimes(4);
    expect(s.getUserMedia).toHaveBeenCalledTimes(1);
    s.rec.stop();
    await p;
  });

  it('a listen after release reopens the microphone', async () => {
    const s = setup();
    const p = s.rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
    await flush();
    s.listeners.result({ result: { text: 'si' } });
    await p;
    s.rec.release();
    await flush();
    expect(s.track.stop).toHaveBeenCalledTimes(1);
    const p2 = s.rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
    await flush();
    expect(s.getUserMedia).toHaveBeenCalledTimes(2);
    expect(s.ctor).toHaveBeenCalledTimes(2);
    s.listeners.result({ result: { text: 'si' } });
    await expect(p2).resolves.toBe('si');
  });

  it('prepare opens the microphone once before the first listen; release cancels a pending prepare', async () => {
    const s = setup();
    await s.rec.prepare();
    expect(s.getUserMedia).toHaveBeenCalledTimes(1);
    const p = s.rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
    await flush();
    expect(s.getUserMedia).toHaveBeenCalledTimes(1);
    s.listeners.result({ result: { text: 'si' } });
    await p;
    s.rec.release();
    const s2 = setup();
    const pending = s2.rec.prepare();
    s2.rec.release();
    await pending;
    expect(s2.getUserMedia).not.toHaveBeenCalled();
  });

  it('a release while the model loads means a stale listen never opens the microphone', async () => {
    const s = setup();
    let resolveModel!: (m: never) => void;
    s.createModel.mockImplementationOnce(() => new Promise((r) => { resolveModel = r as never; }));
    const p = s.rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
    await flush();
    s.rec.release();
    resolveModel({ KaldiRecognizer: s.ctor, terminate: vi.fn() } as never);
    await flush();
    expect(s.getUserMedia).not.toHaveBeenCalled();
    await expect(p).resolves.toBeNull();
  });

  it('a release while getUserMedia is pending closes the stream once it resolves', async () => {
    const s = setup();
    await s.rec.preload();
    let resolveMedia!: (m: MediaStream) => void;
    const stream = { getTracks: () => [s.track] } as unknown as MediaStream;
    s.getUserMedia.mockImplementationOnce(() => new Promise<MediaStream>((r) => { resolveMedia = r; }));
    const p = s.rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
    await flush();
    expect(s.getUserMedia).toHaveBeenCalledTimes(1);
    s.rec.release();
    resolveMedia(stream);
    await flush();
    expect(s.track.stop).toHaveBeenCalled();
    expect(s.ctx.close).toHaveBeenCalled();
    await expect(p).resolves.toBeNull();
    // No cached session: the next listen reopens the microphone.
    const p2 = s.rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
    await flush();
    expect(s.getUserMedia).toHaveBeenCalledTimes(2);
    s.rec.stop();
    await p2;
  });

  it('uses a new recognizer per listen: a late result of the previous one cannot resolve the next', async () => {
    const s = setup();
    const p1 = s.rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
    await flush();
    s.listeners.result({ result: { text: 'si' } });
    await p1;
    expect(s.recognizer.remove).toHaveBeenCalledTimes(1);
    const staleResult = s.listeners.result;
    const p2 = s.rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
    await flush();
    expect(s.ctor).toHaveBeenCalledTimes(2);
    let out: string | null | undefined;
    void p2.then((v) => (out = v));
    staleResult({ result: { text: 'stale' } }); // the old handle replies after the second listen started
    await flush();
    expect(out).toBeUndefined();
    s.rec.stop();
    await p2;
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

describe('VoskRecognizer language (es / en)', () => {
  const ES_URL = 'http://localhost:4173/models/vosk/parts/manifest.json';
  const EN_URL = 'http://localhost:4173/models/vosk/en/manifest.json';

  beforeEach(() => {
    vi.stubGlobal('location', { href: 'http://localhost:4173/' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Two fake models (one per manifest URL), with in-memory audio and a per-model handle. */
  function bilingualSetup(opts: { failFirstEnglishLoad?: boolean; language?: boolean } = {}) {
    const state: { language: VoiceLanguage } = { language: 'es' };
    const handles = new Map<string, FakeHandle>();
    let englishLoads = 0;
    const loadModelUrl = vi.fn(async (u: string) => {
      if (u === EN_URL) {
        englishLoads += 1;
        if (opts.failFirstEnglishLoad && englishLoads === 1) throw new Error('missing part');
      }
      return `blob:${u}`;
    });
    const createModel = vi.fn(async (blobUrl: string) => {
      const ctor = vi.fn(function () {
        const handle = fakeHandle();
        handles.set(blobUrl, handle);
        return handle;
      });
      return { KaldiRecognizer: ctor, terminate: vi.fn() } as unknown as VoskModelHandle;
    });
    const revokeObjectURL = vi.fn();
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn(async () => stream);
    const node = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() };
    const ctx = {
      sampleRate: VOSK_FAKE_SAMPLE_RATE,
      destination: {},
      createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
      createScriptProcessor: () => node,
      close: vi.fn(async () => undefined),
    } as unknown as AudioContextHandle;
    const rec = new VoskRecognizer({
      ...(opts.language === false ? {} : { language: () => state.language }),
      loadModelUrl,
      createModel,
      revokeObjectURL,
      getUserMedia,
      audioContextFactory: () => ctx,
    });
    /** The handle of the recognizer built by the last listen on the given model blob. */
    const handleOf = (manifestUrl: string) => handles.get(`blob:${manifestUrl}`)!;
    return { state, rec, loadModelUrl, createModel, revokeObjectURL, handleOf };
  }

  it('language en loads the English manifest, resolved against location', async () => {
    const s = bilingualSetup();
    s.state.language = 'en';
    await s.rec.preload();
    expect(s.loadModelUrl).toHaveBeenCalledWith(EN_URL);
    expect(s.loadModelUrl).not.toHaveBeenCalledWith(ES_URL);
  });

  it('defaults to the Spanish manifest when no language option is given', async () => {
    const s = bilingualSetup({ language: false });
    await s.rec.preload();
    expect(s.loadModelUrl).toHaveBeenCalledTimes(1);
    expect(s.loadModelUrl).toHaveBeenCalledWith(ES_URL);
  });

  it('an explicit manifestUrl wins over the language', async () => {
    const loadModelUrl = vi.fn(async () => 'blob:x');
    const rec = new VoskRecognizer({
      manifestUrl: 'http://x/custom.json',
      language: () => 'en',
      loadModelUrl,
      createModel: vi.fn(async () => ({}) as never),
      revokeObjectURL: vi.fn(),
    });
    await rec.preload();
    expect(loadModelUrl).toHaveBeenCalledWith('http://x/custom.json');
  });

  it('switching es to en loads the second model once and reuses each model afterwards', async () => {
    const s = bilingualSetup();
    const grammar = ['si', 'no'];
    const spanish = s.rec.listen(grammar, { timeoutMs: TIMEOUT_MS });
    await flush();
    s.handleOf(ES_URL).listeners.result!({ result: { text: 'si' } });
    await expect(spanish).resolves.toBe('si');
    expect(s.createModel).toHaveBeenCalledTimes(1);

    s.state.language = 'en';
    const english = s.rec.listen(grammar, { timeoutMs: TIMEOUT_MS });
    await flush();
    s.handleOf(EN_URL).listeners.result!({ result: { text: 'yes' } });
    await expect(english).resolves.toBe('yes');
    expect(s.loadModelUrl).toHaveBeenCalledTimes(2);
    expect(s.createModel).toHaveBeenCalledTimes(2);
    expect(s.loadModelUrl).toHaveBeenNthCalledWith(2, EN_URL);
    // The English recognizer comes from the English model, never from the Spanish one.
    const enCtor = (s.createModel.mock.results[1]!.value as Promise<{ KaldiRecognizer: Mock }>);
    expect((await enCtor).KaldiRecognizer).toHaveBeenCalledWith(VOSK_FAKE_SAMPLE_RATE, JSON.stringify(grammar));

    s.state.language = 'es';
    const again = s.rec.listen(grammar, { timeoutMs: TIMEOUT_MS });
    await flush();
    s.handleOf(ES_URL).listeners.result!({ result: { text: 'no' } });
    await expect(again).resolves.toBe('no');
    s.state.language = 'en';
    const enAgain = s.rec.listen(grammar, { timeoutMs: TIMEOUT_MS });
    await flush();
    s.handleOf(EN_URL).listeners.result!({ result: { text: 'no' } });
    await expect(enAgain).resolves.toBe('no');

    // Each model is loaded once: no reload when switching back and forth.
    expect(s.loadModelUrl).toHaveBeenCalledTimes(2);
    expect(s.createModel).toHaveBeenCalledTimes(2);
    s.rec.release();
  });

  it('a failed English load is retried on the next listen', async () => {
    const s = bilingualSetup({ failFirstEnglishLoad: true });
    s.state.language = 'en';
    await expect(s.rec.listen(['si'], { timeoutMs: 5 })).resolves.toBeNull();
    expect(s.loadModelUrl).toHaveBeenCalledTimes(1);

    const retry = s.rec.listen(['si'], { timeoutMs: TIMEOUT_MS });
    await flush();
    expect(s.loadModelUrl).toHaveBeenCalledTimes(2);
    expect(s.loadModelUrl).toHaveBeenLastCalledWith(EN_URL);
    s.handleOf(EN_URL).listeners.result!({ result: { text: 'yes' } });
    await expect(retry).resolves.toBe('yes');
    s.rec.release();
  });
});
