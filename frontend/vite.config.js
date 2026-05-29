import { defineConfig, loadEnv } from 'vite'
import { readFileSync } from 'fs'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isCapacitor = mode === 'capacitor'

  // Docker: VITE_BASE_PATH=/ | Capacitor: .env.capacitor sets / | Railway Django: /static/
  const base = env.VITE_BASE_PATH || (isCapacitor ? '/' : (process.env.NODE_ENV === 'production' ? '/static/' : '/'))

  return {
    plugins: [
      react(),
      // PWA service worker solo para web — en Capacitor el app va bundleado en el APK
      !isCapacitor && VitePWA({
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
              urlPattern: /\/api\/(rondas|instalaciones|checkpoints)\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-static',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 60, maxAgeSeconds: 86400 }
              }
            },
            {
              urlPattern: /\/api\/ejecuciones\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-ejecuciones',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 40, maxAgeSeconds: 86400 }
              }
            },
            {
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
      }),
    ].filter(Boolean),

    server: {
      proxy: {
        '/api': { target: 'http://localhost:8000', changeOrigin: true },
        '/media': { target: 'http://localhost:8000', changeOrigin: true },
        '/ws': { target: 'ws://localhost:8000', ws: true }
      }
    },

    define: {
      __APP_VERSION__: JSON.stringify(version),
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      assetsDir: 'assets',
    },

    base,
  }
})
