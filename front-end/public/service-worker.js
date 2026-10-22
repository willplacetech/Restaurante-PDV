const LEGACY_CACHE_NAME = 'pdv-static-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const hadLegacyCache = await caches.has(LEGACY_CACHE_NAME);
    if (hadLegacyCache) {
      await caches.delete(LEGACY_CACHE_NAME);
    }

    await self.clients.claim();

    if (hadLegacyCache) {
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(clients.map((client) => client.navigate(new URL('/', client.url).href)));
    }
  })());
});
