/**
 * Vite configuration for PurpleSky
 *
 * This file configures:
 *  - Qwik framework plugin (enables resumability)
 *  - QwikCity plugin (file-based routing)
 *  - WASM support (loads Rust-compiled WebAssembly modules)
 *  - Base path for GitHub Pages deployment
 *
 * To edit the base path for deployment, change VITE_BASE_PATH env var.
 */

import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

const isProd = process.env.NODE_ENV === 'production';
const base = process.env.VITE_BASE_PATH ?? (isProd ? '/purplesky/' : '/');

export default defineConfig({
  base,
  plugins: [
    /* QwikCity must come before qwikVite */
    qwikCity(),
    qwikVite(),
    /* WASM plugins: allow importing .wasm as ES modules */
    wasm(),
    topLevelAwait(),
  ],
  resolve: {
    alias: {
      '~': '/src',
    },
    /* Ensure browser-compatible versions of packages are used.
       Without this, jose (used by @atproto for JWT/OAuth) resolves to its
       Node.js build which uses node:util.promisify – crashing in the browser. */
    conditions: ['browser', 'import', 'module', 'default'],
  },
  /* Dev server settings */
  server: {
    port: 5173,
    host: true, /* listen on 0.0.0.0 so 127.0.0.1 and localhost both work */
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  preview: {
    port: 4173,
  },
  /* Build settings */
  build: {
    target: 'es2021',
    /* Allow large WASM chunks */
    chunkSizeWarningLimit: 3000,
  },
  /* Enable WASM in optimized deps */
  optimizeDeps: {
    exclude: ['purplesky-wasm'],
    /* Force Vite to re-bundle these deps with browser conditions */
    include: ['jose', '@atproto/oauth-client-browser'],
  },
});
