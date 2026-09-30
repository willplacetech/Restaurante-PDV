const CACHE_NAME = 'pdv-static-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (response.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.ico') || url.pathname.endsWith('.json'))) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

let offlineQueue = [];

self.addEventListener('message', (event) => {
  const { action, data } = event.data;

  if (action === 'queueRequest') {
    offlineQueue.push({
      url: data.url,
      method: data.method,
      headers: data.headers,
      body: data.body,
      timestamp: Date.now(),
    });
    console.log('[SW] Request queued for offline:', data.url);
  } else if (action === 'processQueue') {
    processOfflineQueue();
  } else if (action === 'getQueueStatus') {
    event.ports[0].postMessage({
      queueLength: offlineQueue.length,
      queue: offlineQueue,
    });
  }
});

async function processOfflineQueue() {
  if (offlineQueue.length === 0) return;

  console.log('[SW] Processing offline queue, items:', offlineQueue.length);

  const pending = [...offlineQueue];
  offlineQueue = [];

  for (const request of pending) {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      if (response.ok) {
        console.log('[SW] Offline request succeeded:', request.url);
      } else {
        console.warn('[SW] Offline request failed:', request.url, response.status);
        offlineQueue.unshift(request);
      }
    } catch (error) {
      console.error('[SW] Offline request error:', request.url, error);
      offlineQueue.unshift(request);
    }
  }

  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'QUEUE_PROCESSED',
      remaining: offlineQueue.length,
    });
  });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-sync') {
    event.waitUntil(processOfflineQueue());
  }
});