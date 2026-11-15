/** Text-to-speech port. Real adapter: speechSynthesis with a local `es` voice. */
export interface SpeechSynthesizerPort {
  /** Speaks a Spanish line; resolves when finished (or immediately if no local voice). */
  speak(text: string): Promise<void>;
  cancel(): void;
}
