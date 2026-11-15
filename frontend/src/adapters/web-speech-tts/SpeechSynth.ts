import type { SpeechSynthesizerPort } from '../../application/ports/SpeechSynthesizerPort';

/** Language prefix of the voices we accept (matched case-insensitively). */
export const SPANISH_LANG_PREFIX = 'es';
/** Preferred Spanish locales, most preferred first. Other local `es*` voices rank last. */
export const PREFERRED_SPANISH_LANGS: readonly string[] = ['es-es', 'es-mx', 'es-us'];
/** How long to wait for `voiceschanged` when the browser starts with an empty voice list. */
export const VOICES_CHANGED_TIMEOUT_MS = 1500;
/** Safety net: an utterance is considered finished after `text.length * MS_PER_CHARACTER + SAFETY_BASE_MS`. */
export const MS_PER_CHARACTER = 120;
export const SAFETY_BASE_MS = 2000;

const UTTERANCE_END_EVENT = 'end';
const UTTERANCE_ERROR_EVENT = 'error';
const VOICES_CHANGED_EVENT = 'voiceschanged';

/** The subset of `SpeechSynthesis` this adapter uses; injectable for tests. */
export type SpeechSynthLike = Pick<
  SpeechSynthesis,
  'speak' | 'cancel' | 'getVoices' | 'addEventListener' | 'removeEventListener'
>;

export interface SpeechSynthOptions {
  synth?: SpeechSynthLike;
  UtteranceCtor?: typeof SpeechSynthesisUtterance;
}

/** Index in PREFERRED_SPANISH_LANGS, or the list length when the locale is not preferred. */
function preferenceRank(lang: string): number {
  const index = PREFERRED_SPANISH_LANGS.indexOf(lang.toLowerCase());
  return index === -1 ? PREFERRED_SPANISH_LANGS.length : index;
}

/** Best local Spanish voice, or `undefined` when the device has none. Network voices are never used. */
export function pickLocalSpanishVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  let best: SpeechSynthesisVoice | undefined;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const voice of voices) {
    if (voice.localService !== true) continue;
    if (!voice.lang.toLowerCase().startsWith(SPANISH_LANG_PREFIX)) continue;
    const rank = preferenceRank(voice.lang);
    if (rank < bestRank) {
      best = voice;
      bestRank = rank;
    }
  }
  return best;
}

function defaultSynth(): SpeechSynthLike | undefined {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;
}

function defaultUtteranceCtor(): typeof SpeechSynthesisUtterance | undefined {
  return typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : undefined;
}

/**
 * Text-to-speech through `window.speechSynthesis`, using only a local Spanish voice.
 * When no such voice (or no speechSynthesis API) exists, `speak` resolves immediately:
 * the on-screen captions carry the dialogue.
 */
export class SpeechSynth implements SpeechSynthesizerPort {
  private readonly synth: SpeechSynthLike | undefined;
  private readonly UtteranceCtor: typeof SpeechSynthesisUtterance | undefined;
  private voice: SpeechSynthesisVoice | undefined;
  /** Resolves once the voice list is known (loaded, `voiceschanged` fired, or timed out). */
  private readonly voicesReady: Promise<void>;
  /** Finish callbacks of speak calls that have not settled yet; `cancel` settles them all. */
  private readonly pending = new Set<() => void>();

  constructor(options: SpeechSynthOptions = {}) {
    this.synth = options.synth ?? defaultSynth();
    this.UtteranceCtor = options.UtteranceCtor ?? defaultUtteranceCtor();
    this.voicesReady = this.loadVoice();
  }

  /** True when a local Spanish voice was found. Only meaningful after the voice list has loaded. */
  isAvailable(): boolean {
    return this.voice !== undefined;
  }

  speak(text: string): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      let safetyTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (safetyTimer !== undefined) clearTimeout(safetyTimer);
        this.pending.delete(finish);
        resolve();
      };
      this.pending.add(finish);

      void this.voicesReady.then(() => {
        if (settled) return;
        const voice = this.voice;
        if (!this.synth || !this.UtteranceCtor || !voice) {
          finish();
          return;
        }
        const utterance = new this.UtteranceCtor(text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.addEventListener(UTTERANCE_END_EVENT, finish);
        utterance.addEventListener(UTTERANCE_ERROR_EVENT, finish);
        safetyTimer = setTimeout(finish, text.length * MS_PER_CHARACTER + SAFETY_BASE_MS);
        this.synth.speak(utterance);
      });
    });
  }

  cancel(): void {
    this.synth?.cancel();
    for (const finish of [...this.pending]) finish();
  }

  private loadVoice(): Promise<void> {
    const synth = this.synth;
    if (!synth) return Promise.resolve();
    if (synth.getVoices().length > 0) {
      this.voice = pickLocalSpanishVoice(synth.getVoices());
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        synth.removeEventListener(VOICES_CHANGED_EVENT, done);
        this.voice = pickLocalSpanishVoice(synth.getVoices());
        resolve();
      };
      const timer = setTimeout(done, VOICES_CHANGED_TIMEOUT_MS);
      synth.addEventListener(VOICES_CHANGED_EVENT, done);
    });
  }
}
