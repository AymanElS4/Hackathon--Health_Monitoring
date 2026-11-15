import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests need a real Postgres; they only run when DATABASE_URL is set.
const NODE_MODULES_GLOB = 'node_modules/**';
const INTEGRATION_GLOB = 'tests/integration/**';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { alias: { zod: path.resolve(__dirname, 'node_modules/zod') } },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: process.env.DATABASE_URL
      ? [NODE_MODULES_GLOB]
      : [NODE_MODULES_GLOB, INTEGRATION_GLOB],
    environment: 'node',
  },
});
