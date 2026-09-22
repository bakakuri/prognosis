/**
 * PredictX Service Worker
 * Cache strategy: Network-first for API, Cache-first for static assets
 */
const CACHE_NAME = 'predictx-v2';
const API_CACHE_NAME = 'predictx-api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/layout.css',
  '/css/navigation.css',
  '/css/cards.css',
  '/css/components.css',
  '/css/pages.css',
  '/css/responsive.css',
  '/js/app.js',
  '/js/api.js',
  '/js/state.js',
  '/js/router.js',
  '/js/utils.js',
  '/js/components/bottom-nav.js',
  '/js/components/sidebar-nav.js',
  '/js/components/match-card.js',
  '/js/components/toast.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ─── Install ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('SW: Some assets failed to cache', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clear old caches
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME && k !== API_CACHE_NAME)
            .map(k => caches.delete(k))
        )
      ),
    ])
  );
});

// ─── Fetch Strategy ────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and non-http requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API requests: Network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // Static assets: Cache-first
  event.respondWith(cacheFirstStatic(request));
});

async function networkFirstAPI(request) {
  const url = new URL(request.url);

  // Don't cache admin endpoints
  if (url.pathname.includes('/admin/')) {
    return fetch(request).catch(() =>
      new Response(JSON.stringify({ error: { message: 'Offline' } }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503,
      })
    );
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: { message: 'You are offline' } }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503,
    });
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type !== 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offline = await caches.match('/');
      if (offline) return offline;
    }
    return new Response('Offline', { status: 503 });
  }
}
