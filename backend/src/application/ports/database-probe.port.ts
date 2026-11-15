/** Injection token for the database reachability probe. */
export const DATABASE_PROBE = Symbol('DATABASE_PROBE');

/** Answers whether the database can currently be reached. */
export interface DatabaseProbe {
  /** Resolves `true` when the database responds, `false` otherwise. */
  isReachable(): Promise<boolean>;
}
