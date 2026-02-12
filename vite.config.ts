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

import { defineConfig, type Plugin } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

const isProd = process.env.NODE_ENV === 'production';
const base = process.env.VITE_BASE_PATH ?? (isProd ? '/purplesky-1/' : '/');

/**
 * Vite plugin that rewrites public/manifest.json after the build copies it,
 * replacing relative "./" references with the actual base path.
 * This ensures `start_url`, `scope`, and icon paths resolve correctly
 * on any domain regardless of which page the user installs from.
 *
 * Files in `public/` are copied as-is by Vite (they don't go through the
 * bundle pipeline), so we rewrite the file on disk in `writeBundle`.
 */
function pwaManifestPlugin(basePath: string): Plugin {
  return {
    name: 'pwa-manifest-base',
    apply: 'build',
    async writeBundle(opts) {
      const outDir = opts.dir;
      if (!outDir) return;
      const { readFileSync, writeFileSync, existsSync } = await import('fs');
      const { join } = await import('path');
      const manifestPath = join(outDir, 'manifest.json');
      if (!existsSync(manifestPath)) return;
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        if (manifest.start_url === './' || manifest.start_url === '.') {
          manifest.start_url = basePath;
        }
        if (manifest.scope === './' || manifest.scope === '.') {
          manifest.scope = basePath;
        }
        if (Array.isArray(manifest.icons)) {
          for (const icon of manifest.icons) {
            if (typeof icon.src === 'string' && icon.src.startsWith('./')) {
              icon.src = basePath + icon.src.slice(2);
            }
          }
        }
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      } catch { /* leave manifest unchanged if parse fails */ }
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    /* QwikCity must come before qwikVite */
    qwikCity(),
    qwikVite(),
    /* WASM plugins: allow importing .wasm as ES modules */
    wasm(),
    topLevelAwait(),
    /* Rewrite manifest.json with absolute base paths for PWA install */
    pwaManifestPlugin(base),
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
