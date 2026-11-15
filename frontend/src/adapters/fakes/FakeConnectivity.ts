import type { ConnectivityPort } from '../../application/ports';

/** In-memory connectivity for tests and demos. `setOnline` notifies subscribers. */
export class FakeConnectivity implements ConnectivityPort {
  private online: boolean;
  private readonly subscribers = new Set<(online: boolean) => void>();

  constructor(initial = true) {
    this.online = initial;
  }

  isOnline(): boolean {
    return this.online;
  }

  setOnline(value: boolean): void {
    this.online = value;
    for (const cb of [...this.subscribers]) {
      cb(value);
    }
  }

  subscribe(cb: (online: boolean) => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }
}
