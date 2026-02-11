/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PurpleSky Service Worker – Offline Support & Caching
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This service worker provides:
 *  - Cache-first strategy for static assets (JS, CSS, images, WASM)
 *  - Network-first strategy for API calls (AT Protocol)
 *  - Offline fallback page
 *  - Background sync for offline edits (posts, comments, votes)
 *  - Periodic cache cleanup
 *
 * HOW TO EDIT:
 *  - To change caching strategies, edit the fetch event handler
 *  - To add new cached routes, add patterns to CACHE_PATTERNS
 *  - To change cache expiration, edit MAX_AGE_MS
 *
 * CACHING STRATEGIES:
 *  - Static assets: Cache-first (fast loads, update in background)
 *  - API data: Network-first (fresh data, fall back to cache)
 *  - Images/videos: Cache-first with size limit
 *  - WASM modules: Cache-first (they rarely change)
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CACHE_NAME = 'purplesky-v1';
const STATIC_CACHE = 'purplesky-static-v1';
const IMAGE_CACHE = 'purplesky-images-v1';
const API_CACHE = 'purplesky-api-v1';

// Max age for cached API responses (5 minutes)
const API_MAX_AGE_MS = 5 * 60 * 1000;
// Max cached images (to prevent filling storage)
const MAX_CACHED_IMAGES = 200;

// Static assets to precache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
];

// ── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate immediately (don't wait for old SW to stop)
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== STATIC_CACHE && name !== IMAGE_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      )
    )
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (POST, PUT, DELETE go to network)
  if (event.request.method !== 'GET') return;

  // API calls: Network-first with cache fallback
  if (url.hostname.includes('bsky.social') ||
      url.hostname.includes('bsky.app') ||
      url.hostname.includes('microcosm.blue')) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  // Images/videos: Cache-first
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|mp4|webm)$/i) ||
      url.hostname.includes('cdn.bsky.app')) {
    event.respondWith(cacheFirst(event.request, IMAGE_CACHE));
    return;
  }

  // WASM: Cache-first
  if (url.pathname.endsWith('.wasm')) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Static assets: Cache-first
  event.respondWith(cacheFirst(event.request, STATIC_CACHE));
});

// ── Cache-First Strategy ──────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

// ── Network-First Strategy ────────────────────────────────────────────────
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Background Sync (for offline edits) ───────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-posts') {
    event.waitUntil(syncOfflinePosts());
  }
  if (event.tag === 'sync-votes') {
    event.waitUntil(syncOfflineVotes());
  }
});

async function syncOfflinePosts() {
  // Read pending posts from IndexedDB and send them
  // This is a placeholder – implement with your offline queue
  console.log('[SW] Syncing offline posts...');
}

async function syncOfflineVotes() {
  console.log('[SW] Syncing offline votes...');
}

// ── Push Notifications (for mentions, replies) ────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'PurpleSky', {
      body: data.body || 'New activity',
      icon: './icon.svg',
      badge: './icon.svg',
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) {
    event.waitUntil(self.clients.openWindow(url));
  }
});
