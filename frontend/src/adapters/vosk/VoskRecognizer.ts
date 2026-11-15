import type { SpeechRecognizerPort } from '../../application/ports/SpeechRecognizerPort';
import { VOSK_MANIFEST_URLS, loadModelBlobUrl } from './loadModelBlobUrl';

/** Preferred capture sample rate; the recognizer uses the context's actual rate. */
export const PREFERRED_SAMPLE_RATE = 16000;
/** ScriptProcessorNode buffer size (frames), as in the vosk-browser README. */
export const SCRIPT_PROCESSOR_BUFFER_SIZE = 4096;
const CHANNEL_COUNT = 1;
const UNKNOWN_TOKEN = '[unk]';

/**
 * Check-in languages this adapter knows a Vosk model for. Same union as `VoiceLanguage` in
 * domain/parsing/parseUtterance; declared here because adapters may not import the domain
 * (eslint-plugin-boundaries).
 */
export type VoiceLanguage = 'es' | 'en';

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
  resume?(): Promise<void>;
}
interface AudioSession {
  stream: MediaStream;
  ctx: AudioContextHandle;
  source: SourceNodeHandle;
  node: ProcessorNodeHandle;
}
interface ActiveRecognizer {
  handle: VoskRecognizerHandle;
  onResult: ((text: string) => void) | null;
  lastPartialAt: number | null;
}

/**
 * Dev timing hooks (T095), on the adapter's `now` clock. `onListening` fires when the microphone is
 * open; `onFinal` fires with the last partial result and the final one, when a transcript exists.
 */
export interface VoskTiming {
  onListening(at: number): void;
  onFinal(times: { lastPartialAt: number; finalAt: number }): void;
}

export interface VoskRecognizerOptions {
  /**
   * Absolute URL of the split-model manifest. When set it wins over `language` (every listen uses
   * this model). vosk-browser fetches inside a blob worker, so it must not be root-relative.
   */
  manifestUrl?: string;
  /** Check-in language, read at each `listen`/`preload` to pick the model. Defaults to 'es'. */
  language?: () => VoiceLanguage;
  /** Builds the blob: URL from the manifest; injectable for tests. */
  loadModelUrl?: (manifestUrl: string) => Promise<string>;
  revokeObjectURL?: (url: string) => void;
  createModel?: (url: string) => Promise<VoskModelHandle>;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  audioContextFactory?: () => AudioContextHandle;
  now?: () => number;
  timing?: VoskTiming;
}

export class VoskRecognizer implements SpeechRecognizerPort {
  private readonly explicitManifestUrl: string | undefined;
  private readonly language: () => VoiceLanguage;
  private readonly loadModelUrl: (manifestUrl: string) => Promise<string>;
  private readonly revokeObjectURL: (url: string) => void;
  private readonly createModel: (url: string) => Promise<VoskModelHandle>;
  private readonly getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>;
  private readonly audioContextFactory: () => AudioContextHandle;
  private readonly now: () => number;
  private readonly timing: VoskTiming | undefined;
  /** One model load per manifest URL; a failed load is dropped so the next call retries it. */
  private readonly modelPromises = new Map<string, Promise<VoskModelHandle>>();
  private abort: (() => void) | null = null;
  private generation = 0;
  private session: Promise<AudioSession> | null = null;
  private feed: VoskRecognizerHandle | null = null;
  private readonly recognizers = new Set<ActiveRecognizer>();

  constructor(opts: VoskRecognizerOptions = {}) {
    this.explicitManifestUrl = opts.manifestUrl;
    this.language = opts.language ?? (() => 'es');
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
    this.timing = opts.timing;
  }

  /** Manifest URL for the current language, absolute: a root-relative URL would break in the worker. */
  private currentManifestUrl(): string {
    if (this.explicitManifestUrl !== undefined) return this.explicitManifestUrl;
    const path = VOSK_MANIFEST_URLS[this.language()];
    return typeof location !== 'undefined' ? new URL(path, location.href).href : path;
  }

  /** Joins the model parts into a blob: URL, loads the model, then revokes the URL (also on failure). */
  private async loadModel(manifestUrl: string): Promise<VoskModelHandle> {
    const url = await this.loadModelUrl(manifestUrl);
    try {
      return await this.createModel(url);
    } finally {
      this.revokeObjectURL(url);
    }
  }

  /** The model for a manifest URL, loaded at most once while it succeeds. */
  private modelFor(manifestUrl: string): Promise<VoskModelHandle> {
    const cached = this.modelPromises.get(manifestUrl);
    if (cached) return cached;
    const p = this.loadModel(manifestUrl);
    this.modelPromises.set(manifestUrl, p);
    p.catch(() => {
      if (this.modelPromises.get(manifestUrl) === p) this.modelPromises.delete(manifestUrl);
    });
    return p;
  }

  preload(): Promise<void> {
    return this.modelFor(this.currentManifestUrl()).then(() => undefined);
  }

  async prepare(): Promise<void> {
    try {
      const generation = this.generation;
      await this.preload();
      // A release while the model loads cancels the warm-up (the microphone must stay closed).
      if (generation === this.generation) await this.openSession();
    } catch {
      // A failed warm-up is not an error: `listen` retries and resolves null if it still fails.
    }
  }

  /** Opens the microphone stream and the audio graph once; later listens reuse them until `release`. */
  private openSession(): Promise<AudioSession> {
    if (!this.session) {
      const p = this.createSession();
      this.session = p;
      p.catch(() => {
        if (this.session === p) this.session = null;
      });
    }
    return this.session;
  }

  private async createSession(): Promise<AudioSession> {
    const stream = await this.getUserMedia({
      audio: { channelCount: CHANNEL_COUNT, echoCancellation: true, noiseSuppression: true },
    });
    let ctx: AudioContextHandle | null = null;
    try {
      ctx = this.audioContextFactory();
      await ctx.resume?.();
      const node = ctx.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER_SIZE, CHANNEL_COUNT, CHANNEL_COUNT);
      const source = ctx.createMediaStreamSource(stream);
      // The graph stays connected; chunks only reach a recognizer while a listen is active.
      node.onaudioprocess = (e) => {
        const target = this.feed;
        if (!target) return;
        try { target.acceptWaveform(e.inputBuffer); } catch { /* drop bad chunk */ }
      };
      source.connect(node);
      node.connect(ctx.destination);
      return { stream, ctx, source, node };
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => undefined);
      throw err;
    }
  }

  /**
   * A new recognizer per listen. Reusing one would leak a half utterance, and flushing it replies
   * asynchronously with a result that would land on the next listen. `discard` unregisters it first.
   */
  private recognizerFor(model: VoskModelHandle, ctx: AudioContextHandle, grammar: readonly string[]): ActiveRecognizer {
    const key = JSON.stringify(grammar);
    const handle = new model.KaldiRecognizer(ctx.sampleRate, key);
    const entry: ActiveRecognizer = { handle, onResult: null, lastPartialAt: null };
    handle.on('partialresult', () => { entry.lastPartialAt = this.now(); });
    handle.on('result', (message) => {
      const finalAt = this.now();
      if (entry.lastPartialAt !== null) this.timing?.onFinal({ lastPartialAt: entry.lastPartialAt, finalAt });
      if (import.meta.env.DEV && entry.lastPartialAt !== null) {
        console.debug(`[vosk] last partial -> final: ${Math.round(finalAt - entry.lastPartialAt)} ms`);
      }
      entry.lastPartialAt = null;
      entry.onResult?.((message?.result?.text ?? '').trim());
    });
    this.recognizers.add(entry);
    return entry;
  }

  async listen(grammar: readonly string[], opts: { timeoutMs: number }): Promise<string | null> {
    this.stop();
    const generation = this.generation;
    let model: VoskModelHandle;
    try {
      model = await this.modelFor(this.currentManifestUrl());
    } catch {
      // Port contract: resolve null, never reject. Wait so runner retries cannot spin.
      await new Promise<void>((r) => setTimeout(r, opts.timeoutMs));
      return null;
    }
    // A release while the model loaded: never open the microphone for this stale listen.
    if (generation !== this.generation) return null;

    let finished = false;
    let resolveOut!: (v: string | null) => void;
    const result = new Promise<string | null>((r) => (resolveOut = r));
    let timer: ReturnType<typeof setTimeout> | null = null;
    let entry: ActiveRecognizer | null = null;

    const finish = (value: string | null): void => {
      if (finished) return;
      finished = true;
      if (timer !== null) clearTimeout(timer);
      if (entry) {
        entry.onResult = null;
        if (this.feed === entry.handle) this.feed = null;
        // Never reused: removing it unregisters its events, so no late result reaches a later listen.
        this.discard(entry);
      }
      if (this.abort === abort) this.abort = null;
      resolveOut(value);
    };
    const abort = (): void => finish(null);
    this.abort = abort;
    timer = setTimeout(abort, opts.timeoutMs);

    try {
      const session = await this.openSession();
      if (generation !== this.generation) {
        // Released while the microphone opened: release() already closed the session it saw, and a
        // newer listen may own the current one, so only end this listen.
        finish(null);
        return result;
      }
      if (finished) return result;
      entry = this.recognizerFor(model, session.ctx, grammar);
      const current = entry;
      current.lastPartialAt = null;
      current.onResult = (text) => {
        finish(text === '' || text === UNKNOWN_TOKEN ? null : text);
      };
      this.feed = current.handle;
      this.timing?.onListening(this.now());
    } catch {
      finish(null);
    }
    return result;
  }

  private discard(entry: ActiveRecognizer): void {
    this.recognizers.delete(entry);
    try { entry.handle.remove(); } catch { /* already removed */ }
  }

  /** Closes the microphone and the audio graph, and drops the cached recognizers. A later listen reopens. */
  release(): void {
    this.generation += 1;
    this.stop();
    const pending = this.session;
    this.session = null;
    this.feed = null;
    for (const entry of [...this.recognizers]) this.discard(entry);
    void pending?.then((s) => this.closeSession(s), () => undefined);
  }

  private closeSession(s: AudioSession): void {
    s.node.onaudioprocess = null;
    try { s.source.disconnect(); } catch { /* already disconnected */ }
    try { s.node.disconnect(); } catch { /* already disconnected */ }
    s.stream.getTracks().forEach((t) => t.stop());
    s.ctx.close().catch(() => undefined);
  }

  stop(): void {
    this.abort?.();
  }
}
