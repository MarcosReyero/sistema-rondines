import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'logo.svg'],
      manifest: {
        name: 'Sistema de Rondines',
        short_name: 'Rondines',
        description: 'Control de rondines de vigilancia',
        theme_color: '#0f0f23',
        background_color: '#0f0f23',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/manifest-icon-192.maskable.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/manifest-icon-192.maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/manifest-icon-512.maskable.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/manifest-icon-512.maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            // Static app data: instalaciones, rondas, checkpoints
            urlPattern: /\/api\/(rondas|instalaciones|checkpoints)\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-static',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 86400 }
            }
          },
          {
            // Ejecuciones: needed for page reload offline
            urlPattern: /\/api\/ejecuciones\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-ejecuciones',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 86400 }
            }
          },
          {
            // Checkpoint by UUID: needed for QR scan offline
            urlPattern: /\/api\/checkpoints\/uuid\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-checkpoints-uuid',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 604800 }
            }
          },
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/media': { target: 'http://localhost:8000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:8000', ws: true }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Django sirve estáticos desde /static/, Vite tiene que generar rutas con ese prefijo
    assetsDir: 'assets',
  },
  // Docker nginx: VITE_BASE_PATH=/ | Railway Django/whitenoise: sin variable → /static/
  base: process.env.VITE_BASE_PATH ?? (process.env.NODE_ENV === 'production' ? '/static/' : '/')
})
