import { openDB, type IDBPDatabase } from 'idb';
import { CheckRecord } from '../../../contracts';
import type { CheckRepositoryPort } from '../../../application/ports';

const STORE = 'checks';
const VERSION = 1;

/**
 * IndexedDB check-in repository (database `base-vital`, store `checks`, keyPath `id`).
 * Every record passes through the `CheckRecord` schema before it is written.
 * Mirrors `MemoryCheckRepository` behaviour.
 */
export class IdbCheckRepository implements CheckRepositoryPort {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  constructor(private readonly dbName: string = 'base-vital') {}

  private db(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(this.dbName, VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORE)) {
            database.createObjectStore(STORE, { keyPath: 'id' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  async save(record: CheckRecord): Promise<void> {
    const valid = CheckRecord.parse(record);
    const db = await this.db();
    await db.put(STORE, valid);
  }

  /** Newest first, ordered by `id` (ISO date-time). */
  async list(): Promise<CheckRecord[]> {
    const db = await this.db();
    const records = (await db.getAll(STORE)) as CheckRecord[];
    return records.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  }

  /** Writes the records only when the store is empty, in one transaction. */
  async seedIfEmpty(records: CheckRecord[]): Promise<void> {
    const valid = records.map((record) => CheckRecord.parse(record));
    const db = await this.db();
    const tx = db.transaction(STORE, 'readwrite');
    const count = await tx.objectStore(STORE).count();
    if (count === 0) {
      for (const record of valid) {
        await tx.objectStore(STORE).put(record);
      }
    }
    await tx.done;
  }

  async clear(): Promise<void> {
    const db = await this.db();
    await db.clear(STORE);
  }
}
