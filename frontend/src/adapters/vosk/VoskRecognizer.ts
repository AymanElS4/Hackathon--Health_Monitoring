import type { SpeechRecognizerPort } from '../../application/ports/SpeechRecognizerPort';
import { VOSK_MANIFEST_URL, loadModelBlobUrl } from './loadModelBlobUrl';

/** Preferred capture sample rate; the recognizer uses the context's actual rate. */
export const PREFERRED_SAMPLE_RATE = 16000;
/** ScriptProcessorNode buffer size (frames), as in the vosk-browser README. */
export const SCRIPT_PROCESSOR_BUFFER_SIZE = 4096;
const CHANNEL_COUNT = 1;
const UNKNOWN_TOKEN = '[unk]';

/** Minimal structural types so the adapter can be tested without a browser or Vosk. */
export interface VoskRecognizerHandle {
  on(event: 'result' | 'partialresult', listener: (message: { result?: { text?: string } }) => void): void;
  acceptWaveform(buffer: AudioBuffer): void;
  remove(): void;
}
export interface VoskModelHandle {
  KaldiRecognizer: new (sampleRate: number, grammar?: string) => VoskRecognizerHandle;
  terminate(): void;
}
export interface ProcessorNodeHandle {
  onaudioprocess: ((event: { inputBuffer: AudioBuffer }) => void) | null;
  connect(destination: unknown): unknown;
  disconnect(): void;
}
export interface SourceNodeHandle {
  connect(destination: unknown): unknown;
  disconnect(): void;
}
export interface AudioContextHandle {
  sampleRate: number;
  destination: unknown;
  createMediaStreamSource(stream: MediaStream): SourceNodeHandle;
  createScriptProcessor(bufferSize: number, inputs: number, outputs: number): ProcessorNodeHandle;
  close(): Promise<void>;
}

export interface VoskRecognizerOptions {
  /** Absolute URL of the split-model manifest (vosk-browser fetches inside a blob worker). */
  manifestUrl?: string;
  /** Builds the blob: URL from the manifest; injectable for tests. */
  loadModelUrl?: (manifestUrl: string) => Promise<string>;
  revokeObjectURL?: (url: string) => void;
  createModel?: (url: string) => Promise<VoskModelHandle>;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  audioContextFactory?: () => AudioContextHandle;
  now?: () => number;
}

export class VoskRecognizer implements SpeechRecognizerPort {
  private readonly manifestUrl: string;
  private readonly loadModelUrl: (manifestUrl: string) => Promise<string>;
  private readonly revokeObjectURL: (url: string) => void;
  private readonly createModel: (url: string) => Promise<VoskModelHandle>;
  private readonly getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>;
  private readonly audioContextFactory: () => AudioContextHandle;
  private readonly now: () => number;
  private modelPromise: Promise<VoskModelHandle> | null = null;
  private abort: (() => void) | null = null;

  constructor(opts: VoskRecognizerOptions = {}) {
    // A root-relative URL would resolve against blob: inside vosk-browser's worker.
    this.manifestUrl =
      opts.manifestUrl ??
      (typeof location !== 'undefined'
        ? new URL(VOSK_MANIFEST_URL, location.href).href
        : VOSK_MANIFEST_URL);
    this.loadModelUrl = opts.loadModelUrl ?? ((u) => loadModelBlobUrl(u));
    this.revokeObjectURL = opts.revokeObjectURL ?? ((u) => URL.revokeObjectURL(u));
    this.createModel =
      opts.createModel ??
      ((url) =>
        import('vosk-browser').then((m) => m.createModel(url) as unknown as Promise<VoskModelHandle>));
    this.getUserMedia =
      opts.getUserMedia ?? ((c) => navigator.mediaDevices.getUserMedia(c));
    this.audioContextFactory =
      opts.audioContextFactory ??
      (() =>
        new AudioContext({ sampleRate: PREFERRED_SAMPLE_RATE }) as unknown as AudioContextHandle);
    this.now = opts.now ?? (() => performance.now());
  }

  /** Joins the model parts into a blob: URL, loads the model, then revokes the URL (also on failure). */
  private async loadModel(): Promise<VoskModelHandle> {
    const url = await this.loadModelUrl(this.manifestUrl);
    try {
      return await this.createModel(url);
    } finally {
      this.revokeObjectURL(url);
    }
  }

  preload(): Promise<void> {
    if (!this.modelPromise) {
      const p = this.loadModel();
      this.modelPromise = p;
      p.catch(() => {
        if (this.modelPromise === p) this.modelPromise = null;
      });
    }
    return this.modelPromise.then(() => undefined);
  }

  async listen(grammar: readonly string[], opts: { timeoutMs: number }): Promise<string | null> {
    this.stop();
    let model: VoskModelHandle;
    try {
      await this.preload();
      model = await this.modelPromise!;
    } catch {
      // Port contract: resolve null, never reject. Wait so runner retries cannot spin.
      await new Promise<void>((r) => setTimeout(r, opts.timeoutMs));
      return null;
    }

    let finished = false;
    let resolveOut!: (v: string | null) => void;
    const result = new Promise<string | null>((r) => (resolveOut = r));
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stream: MediaStream | null = null;
    let ctx: AudioContextHandle | null = null;
    let source: SourceNodeHandle | null = null;
    let node: ProcessorNodeHandle | null = null;
    let recognizer: VoskRecognizerHandle | null = null;

    const cleanup = (): void => {
      if (timer !== null) clearTimeout(timer);
      if (node) node.onaudioprocess = null;
      try { source?.disconnect(); } catch { /* already disconnected */ }
      try { node?.disconnect(); } catch { /* already disconnected */ }
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => undefined);
      try { recognizer?.remove(); } catch { /* already removed */ }
      if (this.abort === abort) this.abort = null;
    };
    const finish = (value: string | null): void => {
      if (finished) return;
      finished = true;
      cleanup();
      resolveOut(value);
    };
    const abort = (): void => finish(null);
    this.abort = abort;
    timer = setTimeout(abort, opts.timeoutMs);

    try {
      stream = await this.getUserMedia({
        audio: { channelCount: CHANNEL_COUNT, echoCancellation: true, noiseSuppression: true },
      });
      if (finished) { cleanup(); return result; }
      ctx = this.audioContextFactory();
      recognizer = new model.KaldiRecognizer(ctx.sampleRate, JSON.stringify(grammar));
      let lastPartialAt: number | null = null;
      recognizer.on('partialresult', () => { lastPartialAt = this.now(); });
      recognizer.on('result', (message) => {
        const text: string = (message?.result?.text ?? '').trim();
        if (import.meta.env.DEV && lastPartialAt !== null) {
          console.debug(`[vosk] last partial -> final: ${Math.round(this.now() - lastPartialAt)} ms`);
        }
        if (text === '' || text === UNKNOWN_TOKEN) finish(null);
        else finish(text);
      });
      node = ctx.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER_SIZE, CHANNEL_COUNT, CHANNEL_COUNT);
      const rec = recognizer;
      node.onaudioprocess = (e) => {
        try { rec.acceptWaveform(e.inputBuffer); } catch { /* drop bad chunk */ }
      };
      source = ctx.createMediaStreamSource(stream);
      source.connect(node);
      node.connect(ctx.destination);
    } catch {
      finish(null);
    }
    return result;
  }

  stop(): void {
    this.abort?.();
  }
}
