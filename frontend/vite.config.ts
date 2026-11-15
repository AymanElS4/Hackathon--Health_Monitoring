import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { TOKENS } from './src/config/design-tokens';

/**
 * Largest single file the service worker may precache: 25 MiB (25 * 1024 * 1024). Cloudflare Pages
 * rejects files of 25 MiB or more, so the Vosk model ships as parts under 20 MiB
 * (`public/models/vosk/parts/`); see specs/005-despliegue/spec.md FR-015.
 */
const MAX_PRECACHE_FILE_BYTES = 26214400;

// Vite + Vitest configuration. PWA: offline after first load (research R2, CA6).
// `data/*.json` is not copied to public/: it is imported through import.meta.glob
// in src/composition-root.ts, so it is bundled into the JS and precached with it.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Base Vital',
        short_name: 'Base Vital',
        lang: 'es',
        display: 'standalone',
        theme_color: TOKENS.color.primary,
        background_color: TOKENS.color.canvas,
        icons: [
          {
            src: 'logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        // App shell, fonts, logo, avatars, models (Vosk parts + manifest.json, Draco, body.glb/png) and bundled data.
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,wasm,json,glb,gz,part*}'],
        maximumFileSizeToCacheInBytes: MAX_PRECACHE_FILE_BYTES,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    // Pins the local time zone so calendar-day tests (mission day, agenda HH:mm) are deterministic.
    env: { TZ: 'America/Guayaquil' },
  },
});
