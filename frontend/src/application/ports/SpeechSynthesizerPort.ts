/** Text-to-speech port. Real adapter: speechSynthesis with a local voice of the check-in language. */
export interface SpeechSynthesizerPort {
  /** Speaks a line in the check-in language; resolves when finished (or immediately if no local voice for it). */
  speak(text: string): Promise<void>;
  cancel(): void;
}
