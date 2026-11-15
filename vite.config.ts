import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vite + Vitest configuration. PWA settings (T040) are added later.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
});
