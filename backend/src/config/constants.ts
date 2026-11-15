import fs from 'node:fs';
import path from 'node:path';

// Shared numeric and path constants for the surgeon sync service.

const PACKAGE_NAME = '@base-vital/backend';
const PACKAGE_MANIFEST = 'package.json';

/** URL prefix for every HTTP route. */
export const API_PREFIX = 'api/v1';

/** Maximum time to wait for the database probe before reporting it down. */
export const DB_PROBE_TIMEOUT_MS = 2000;

/** Maximum time the Postgres pool waits to establish a new connection. */
export const DB_CONNECT_TIMEOUT_MS = 2000;

/** Failed surgeon access attempts allowed inside the window before lockout. */
export const MAX_FAILED_ATTEMPTS = 10;

/** Sliding window over which failed surgeon access attempts are counted. */
export const FAILED_ATTEMPTS_WINDOW_MS = 60_000;

/** Number of past days included in the surgeon's crew history view. */
export const HISTORY_DAYS = 14;

/** Walks up from a directory to the backend package root (name `@base-vital/backend`). */
function findPackageRoot(startDir: string): string {
  let current = startDir;
  for (;;) {
    const manifest = path.join(current, PACKAGE_MANIFEST);
    if (fs.existsSync(manifest)) {
      const parsed: unknown = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        (parsed as { name?: unknown }).name === PACKAGE_NAME
      ) {
        return current;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not locate ${PACKAGE_NAME} package root from ${startDir}`);
    }
    current = parent;
  }
}

/** Absolute path of the backend package root, valid from source and compiled output. */
export const PACKAGE_ROOT = findPackageRoot(__dirname);

/** Directory holding the ordered SQL migration files. */
export const MIGRATIONS_DIR = path.join(PACKAGE_ROOT, 'migrations');

/** Directory holding static files served by the backend. */
export const PUBLIC_DIR = path.join(PACKAGE_ROOT, 'public');

/** Postgres advisory lock id that serializes migrations for feature 004. */
export const MIGRATION_LOCK_KEY = 4004;

/** Database probe attempts at startup before the service gives up and exits. */
export const STARTUP_DB_ATTEMPTS = 30;

/** Delay between startup database probe attempts. */
export const STARTUP_DB_DELAY_MS = 1000;
