import { defineConfig } from 'vitest/config';

// Pure library: no DOM, runs in Node.
export default defineConfig({
  test: {
    environment: 'node',
  },
});
