import type { CheckRecord } from '@base-vital/contracts';

/** Persistence port for check-in records. Real adapter: IndexedDB; fake: memory. */
export interface CheckRepositoryPort {
  save(record: CheckRecord): Promise<void>;
  /** Newest first. */
  list(): Promise<CheckRecord[]>;
  seedIfEmpty(records: CheckRecord[]): Promise<void>;
  /** Removes all records; used when the demo scenario changes. */
  clear(): Promise<void>;
}
