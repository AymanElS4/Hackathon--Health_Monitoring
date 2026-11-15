import type { SpeechRecognizerPort, SpeechSynthesizerPort } from '../../application/ports';

/**
 * `manual`: `listen` waits for `answer(text)` (or times out / `stop()` -> null).
 * `never_understands`: `listen` always resolves null, without showing an input.
 */
export type FakeVoiceMode = 'manual' | 'never_understands';

export interface FakeVoiceOptions {
  mode: FakeVoiceMode;
}

interface PendingListen {
  resolve: (value: string | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * In-memory voice for tests and the demo: a synthesizer that records what it says and a
 * recognizer answered from the on-screen input. Implements both voice ports.
 */
export class FakeVoice implements SpeechRecognizerPort, SpeechSynthesizerPort {
  /** Every line passed to `speak`, in order. */
  readonly spoken: string[] = [];

  private readonly mode: FakeVoiceMode;
  private readonly speakSubscribers = new Set<(text: string) => void>();
  private readonly listenSubscribers = new Set<(listening: boolean) => void>();
  private pending: PendingListen | null = null;

  constructor(opts: FakeVoiceOptions) {
    this.mode = opts.mode;
  }

  // --- SpeechSynthesizerPort ---

  speak(text: string): Promise<void> {
    this.spoken.push(text);
    for (const cb of [...this.speakSubscribers]) cb(text);
    return Promise.resolve();
  }

  cancel(): void {
    // No audio to cancel in the fake.
  }

  /** Calls `cb` with each spoken line. Returns the unsubscribe function. */
  onSpeak(cb: (text: string) => void): () => void {
    this.speakSubscribers.add(cb);
    return () => {
      this.speakSubscribers.delete(cb);
    };
  }

  // --- SpeechRecognizerPort ---

  preload(): Promise<void> {
    return Promise.resolve();
  }

  async listen(_grammar: readonly string[], opts: { timeoutMs: number }): Promise<string | null> {
    this.stop();
    if (this.mode === 'never_understands') {
      // Waits out the timeout on a macrotask: a microtask-only loop would starve the tab.
      return new Promise<string | null>((resolve) => {
        setTimeout(() => resolve(null), opts.timeoutMs);
      });
    }
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => this.settle(null), opts.timeoutMs);
      this.pending = { resolve, timer };
      this.notifyListen(true);
    });
  }

  prepare(): Promise<void> {
    return Promise.resolve();
  }

  release(): void {
    this.stop();
  }

  /** Ends a pending `listen` with null. No-op when not listening. */
  stop(): void {
    this.settle(null);
  }

  // --- Test/demo controls ---

  /** Resolves the pending `listen` with `text`. No-op when not listening. */
  answer(text: string): void {
    this.settle(text);
  }

  isListening(): boolean {
    return this.pending !== null;
  }

  /** Calls `cb` with `true` when a listen starts and `false` when it ends. Returns the unsubscribe function. */
  onListen(cb: (listening: boolean) => void): () => void {
    this.listenSubscribers.add(cb);
    return () => {
      this.listenSubscribers.delete(cb);
    };
  }

  private settle(value: string | null): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    clearTimeout(pending.timer);
    this.notifyListen(false);
    pending.resolve(value);
  }

  private notifyListen(listening: boolean): void {
    for (const cb of [...this.listenSubscribers]) cb(listening);
  }
}
