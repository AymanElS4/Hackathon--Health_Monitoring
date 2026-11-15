/** Speech-to-text port. Real adapter: Vosk in a Web Worker. */
export interface SpeechRecognizerPort {
  /** Loads the recognition model once; idempotent. Called when Home opens. */
  preload(): Promise<void>;
  /** Starts listening with a step grammar; resolves the final transcript or null on timeout. */
  listen(grammar: readonly string[], opts: { timeoutMs: number }): Promise<string | null>;
  /**
   * Opens the microphone and audio graph ahead of the first `listen` (called when a check-in starts,
   * while Vita speaks). Never rejects; a failure surfaces later as a `listen` that resolves null.
   */
  prepare(): Promise<void>;
  stop(): void;
  /** Frees the microphone and audio resources kept between listens; a later `listen` reopens them. */
  release(): void;
}
