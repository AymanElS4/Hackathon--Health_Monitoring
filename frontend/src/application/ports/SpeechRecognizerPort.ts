/** Speech-to-text port. Real adapter: Vosk in a Web Worker. */
export interface SpeechRecognizerPort {
  /** Loads the recognition model once; idempotent. Called when Home opens. */
  preload(): Promise<void>;
  /** Starts listening with a step grammar; resolves the final transcript or null on timeout. */
  listen(grammar: readonly string[], opts: { timeoutMs: number }): Promise<string | null>;
  stop(): void;
}
