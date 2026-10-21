import { precacheAndRoute } from 'workbox/precaching';
import { registerRoute } from 'workbox/routing';
import { CacheFirst } from 'workbox/strategies';
import { NetworkFirst } from 'workbox/strategies';
import { StaleWhileRevalidate } from 'workbox/strategies';
import { ExpirationPlugin } from 'workbox/expiration';
import { BackgroundSync } from 'workbox/background-sync';
import { addRoute } from 'workbox/routing';

precacheAndRoute(self.__WB_MANIFEST);

// Offline fallback for navigation requests
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new StaleWhileRevalidate({
    cacheName: 'app-shell',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24, // 1 day
      }),
    ],
  }),
);

// Cache API responses with NetworkFirst, but fall back to offline
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
    timeoutSeconds: 3,
  }),
);

// Background sync for offline sales
const OFFLINE_QUEUE_NAME = 'offline-sales-queue';
const salesSync = new BackgroundSync(
  'offline-sync',
  {
    maxRetentionTime: 24 * 60, // 24 hours
  }
);

registerRoute(
  ({ request }) => request.method === 'POST' && url.pathname === '/api/vendas',
  async ({ request, event }) => {
    try {
      const response = await fetch(request);
      return response;
    } catch (error) {
      // Queue for offline retry
      const clonedRequest = request.clone();
      event.waitUntil(salesSync.registerRequestHandler(clonedRequest));
      throw error;
    }
  },
  'POST'
);

// Serve offline fallback page when offline
registerRoute(
  ({ request }) => request.mode === 'navigate' && !navigator.onLine,
  new CacheFirst({
    cacheName: 'offline-fallback',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 1,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  }),
);