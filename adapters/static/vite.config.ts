/**
 * Vite config for the Static Site Generation (SSR → HTML) build.
 *
 * Used by `npm run build.server` to produce static HTML via Qwik's static adapter.
 * This runs AFTER the client build and generates pre-rendered HTML pages.
 */

import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import { staticAdapter } from '@builder.io/qwik-city/adapters/static/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

const base = process.env.VITE_BASE_PATH ?? '/purplesky/';

export default defineConfig({
  base,
  plugins: [
    qwikCity(),
    qwikVite(),
    wasm(),
    topLevelAwait(),
    staticAdapter({
      origin: 'https://x1nn1x.github.io',
    }),
  ],
  resolve: {
    alias: {
      '~': '/src',
    },
  },
  build: {
    ssr: true,
    outDir: 'server',
    rollupOptions: {
      input: ['src/entry.ssr.tsx', '@qwik-city-plan'],
    },
  },
  optimizeDeps: {
    exclude: ['purplesky-wasm'],
  },
});
