import type { SpeechSynthesizerPort } from '../../application/ports/SpeechSynthesizerPort';

/**
 * Check-in languages this adapter knows voices for. Same union as `VoiceLanguage` in
 * domain/parsing/parseUtterance; declared here because adapters may not import the domain
 * (eslint-plugin-boundaries). The composition root's domain `VoiceLanguage` is assignable to it.
 */
export type VoiceLanguage = 'es' | 'en';

interface VoiceRule {
  /** Language prefix of the voices we accept (matched case-insensitively). */
  prefix: string;
  /** Preferred locales, most preferred first. Other local voices with the prefix rank last. */
  preferred: readonly string[];
}

/** Voice selection rules per check-in language. Only local voices are ever used. */
export const VOICE_RULES: Readonly<Record<VoiceLanguage, VoiceRule>> = {
  es: { prefix: 'es', preferred: ['es-es', 'es-mx', 'es-us'] },
  en: { prefix: 'en', preferred: ['en-us', 'en-gb'] },
};
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
  /** Check-in language, read at each speak call. Defaults to Spanish. */
  language?: () => VoiceLanguage;
}

/** Index in the rule's preferred list, or the list length when the locale is not preferred. */
function preferenceRank(rule: VoiceRule, lang: string): number {
  const index = rule.preferred.indexOf(lang.toLowerCase());
  return index === -1 ? rule.preferred.length : index;
}

/** Best local voice of `language`, or `undefined` when the device has none. Network voices are never used. */
export function pickLocalVoice(
  voices: readonly SpeechSynthesisVoice[],
  language: VoiceLanguage,
): SpeechSynthesisVoice | undefined {
  const rule = VOICE_RULES[language];
  let best: SpeechSynthesisVoice | undefined;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const voice of voices) {
    if (voice.localService !== true) continue;
    if (!voice.lang.toLowerCase().startsWith(rule.prefix)) continue;
    const rank = preferenceRank(rule, voice.lang);
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
 * Text-to-speech through `window.speechSynthesis`, using only a local voice of the check-in
 * language (see VOICE_RULES). The picked voice is cached per language and the cache is
 * dropped whenever the voice list changes. When no such voice (or no speechSynthesis API)
 * exists, `speak` resolves immediately: the on-screen captions carry the dialogue.
 */
export class SpeechSynth implements SpeechSynthesizerPort {
  private readonly synth: SpeechSynthLike | undefined;
  private readonly UtteranceCtor: typeof SpeechSynthesisUtterance | undefined;
  private readonly currentLanguage: () => VoiceLanguage;
  private voices: readonly SpeechSynthesisVoice[] = [];
  /** Voice picked per language from `voices`; emptied whenever the voice list is read again. */
  private readonly voiceCache = new Map<VoiceLanguage, SpeechSynthesisVoice | undefined>();
  /** Resolves once the voice list is known (loaded, `voiceschanged` fired, or timed out). */
  private readonly voicesReady: Promise<void>;
  /** Finish callbacks of speak calls that have not settled yet; `cancel` settles them all. */
  private readonly pending = new Set<() => void>();

  constructor(options: SpeechSynthOptions = {}) {
    this.synth = options.synth ?? defaultSynth();
    this.UtteranceCtor = options.UtteranceCtor ?? defaultUtteranceCtor();
    this.currentLanguage = options.language ?? (() => 'es');
    this.voicesReady = this.loadVoices();
  }

  /** True when a local voice of the current check-in language was found. Only meaningful after the voice list has loaded. */
  isAvailable(): boolean {
    return this.voiceFor(this.currentLanguage()) !== undefined;
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
        const voice = this.voiceFor(this.currentLanguage());
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

  /** Local voice of `language` from the loaded list, cached until the list is read again. */
  private voiceFor(language: VoiceLanguage): SpeechSynthesisVoice | undefined {
    if (!this.voiceCache.has(language)) {
      this.voiceCache.set(language, pickLocalVoice(this.voices, language));
    }
    return this.voiceCache.get(language);
  }

  /** Reads the voice list from the browser and drops the per-language cache. */
  private readVoices(synth: SpeechSynthLike): void {
    this.voices = synth.getVoices();
    this.voiceCache.clear();
  }

  private loadVoices(): Promise<void> {
    const synth = this.synth;
    if (!synth) return Promise.resolve();
    // Voice lists can change later (e.g. network voices arriving); keep the cache in sync.
    synth.addEventListener(VOICES_CHANGED_EVENT, this.handleVoicesChanged);
    if (synth.getVoices().length > 0) {
      this.readVoices(synth);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        synth.removeEventListener(VOICES_CHANGED_EVENT, done);
        this.readVoices(synth);
        resolve();
      };
      const timer = setTimeout(done, VOICES_CHANGED_TIMEOUT_MS);
      synth.addEventListener(VOICES_CHANGED_EVENT, done);
    });
  }

  private readonly handleVoicesChanged = (): void => {
    if (this.synth) this.readVoices(this.synth);
  };
}
