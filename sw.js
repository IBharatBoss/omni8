// sw.js - High-Performance Offline Cache & Stale-While-Revalidate Engine
const CACHE_NAME = 'omnitools-v4-cache';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.webp',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/command-bar.css',
  './src/main.js',
  './src/core/bus.js',
  './src/core/state.js',
  './src/core/memory.js',
  './src/core/scroll-lock.js',
  './src/core/worker-pool.js',
  './src/engine/registry.js',
  './src/engine/ingest.js',
  './src/services/rtdb.js',
  './src/services/ai-copilot.js',
  './src/ui/router.js',
  './src/ui/home-view.js',
  './src/ui/studio-view.js',
  './src/ui/options-panel.js',
  './src/ui/dropzone.js',
  './src/ui/command-bar.js',
  './src/ui/chat-copilot.js',
  './src/tools/img-to-webp.js',
  './src/tools/img-to-png.js',
  './src/tools/img-to-jpg.js',
  './src/tools/img-compress.js',
  './src/tools/pdf-merge.js',
  './src/tools/pdf-split.js',
  './src/tools/img-resize.js',
  './src/tools/svg-to-png.js'
];

// Install: Pre-cache all local application shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache partial warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up obsolete caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for local assets, Network-First for dynamic/API requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET or chrome-extension requests
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Stale-While-Revalidate Strategy
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
