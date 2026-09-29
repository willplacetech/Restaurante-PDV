import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg'],
      manifest: {
        name: 'Restaurante PDV',
        short_name: 'Restaurante',
        description: 'Sistema de PDV para restaurante',
        theme_color: '#a0522d',
        background_color: '#f7f3ec',
        start_url: '/',
        display: 'standalone',
        display_override: ['standalone'],
        orientation: 'portrait',
        scope: '/',
        icons: [
          {
            src: '/logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document' || request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: ({ request }) => ['style', 'script', 'font', 'image', 'worker'].includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
            },
          },
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && /\/api\//.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
      // No iOS, cache pode ser limpo após ~7 dias sem uso.
    })
  ],
})
