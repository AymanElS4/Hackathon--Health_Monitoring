export interface ConnectivityPort {
  /** Current connectivity state: true when the device reports being online. */
  isOnline(): boolean;
  /** Calls `cb` with the new state on every change. Returns the unsubscribe function. */
  subscribe(cb: (online: boolean) => void): () => void;
}
