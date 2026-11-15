import type { Observation, CheckRecord, AgendaItem } from '../contracts';

/** Speech-to-text port. Real adapter: Vosk in a Web Worker. */
export interface SpeechRecognizerPort {
  /** Loads the recognition model once; idempotent. Called when Home opens. */
  preload(): Promise<void>;
  /** Starts listening with a step grammar; resolves the final transcript or null on timeout. */
  listen(grammar: readonly string[], opts: { timeoutMs: number }): Promise<string | null>;
  stop(): void;
}

/** Text-to-speech port. Real adapter: speechSynthesis with a local `es` voice. */
export interface SpeechSynthesizerPort {
  /** Speaks a Spanish line; resolves when finished (or immediately if no local voice). */
  speak(text: string): Promise<void>;
  cancel(): void;
}

/** Device port. Reads one vital; null when the device sends nothing (CL2). */
export interface DevicePort {
  read(
    indicator: 'resting_heart_rate' | 'blood_pressure' | 'body_temperature' | 'oxygen_saturation',
  ): Promise<Observation | null>;
}

/** Persistence port for check-in records. Real adapter: IndexedDB; fake: memory. */
export interface CheckRepositoryPort {
  save(record: CheckRecord): Promise<void>;
  /** Newest first. */
  list(): Promise<CheckRecord[]>;
  seedIfEmpty(records: CheckRecord[]): Promise<void>;
  /** Removes all records; used when the demo scenario changes. */
  clear(): Promise<void>;
}

export interface AgendaPort {
  next(now: Date): AgendaItem | null;
}

export interface ClockPort {
  now(): Date;
}
