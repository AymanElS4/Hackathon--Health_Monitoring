import { CheckRecord } from '../../../contracts';
import type { CheckRepositoryPort } from '../../../application/ports';

/**
 * In-memory check-in repository. Used by tests and as the fake for IndexedDB.
 * Every record passes through the `CheckRecord` schema before it is stored.
 */
export class MemoryCheckRepository implements CheckRepositoryPort {
  private records = new Map<string, CheckRecord>();

  async save(record: CheckRecord): Promise<void> {
    const valid = CheckRecord.parse(record);
    this.records.set(valid.id, valid);
  }

  /** Newest first, ordered by `id` (ISO date-time). */
  async list(): Promise<CheckRecord[]> {
    return [...this.records.values()].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  }

  /** Writes the records only when the repository is empty. */
  async seedIfEmpty(records: CheckRecord[]): Promise<void> {
    const valid = records.map((record) => CheckRecord.parse(record));
    if (this.records.size > 0) return;
    for (const record of valid) {
      this.records.set(record.id, record);
    }
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}
