// Global test setup: registers jest-dom matchers (toBeInTheDocument, etc.) with Vitest.
import '@testing-library/jest-dom/vitest';

const storageValues = new Map<string, string>();
const storage: Storage = {
  get length() {
    return storageValues.size;
  },
  clear() {
    storageValues.clear();
  },
  getItem(key) {
    return storageValues.get(String(key)) ?? null;
  },
  key(index) {
    return [...storageValues.keys()][index] ?? null;
  },
  removeItem(key) {
    storageValues.delete(String(key));
  },
  setItem(key, value) {
    storageValues.set(String(key), String(value));
  },
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: storage,
});
