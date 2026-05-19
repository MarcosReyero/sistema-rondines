// Service Worker — Sistema de Rondines
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// Precache app shell generado por Vite
precacheAndRoute(self.__WB_MANIFEST || [])
cleanupOutdatedCaches()

// API de rondas y checkpoints — NetworkFirst con fallback a caché
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/rondas') || url.pathname.startsWith('/api/instalaciones') || url.pathname.startsWith('/api/checkpoints'),
  new NetworkFirst({
    cacheName: 'api-data',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 3600 })],
  })
)

// Imágenes satelitales — CacheFirst
registerRoute(
  ({ url }) => url.pathname.startsWith('/media/'),
  new CacheFirst({
    cacheName: 'media',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 604800 })],
  })
)

// Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts' })
)

// ─── Intercepción de scans offline ───────────────────────────────────────────

const DB_NAME = 'rondines_offline'
const STORE = 'scans_pendientes'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Background Sync: cuando vuelve la conexión, intenta reenviar scans pendientes
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-scans') {
    event.waitUntil(syncPendingScans())
  }
})

async function syncPendingScans() {
  const db = await openDB()
  const scans = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  if (!scans.length) return

  const token = await getToken()
  if (!token) return

  const res = await fetch('/api/sync/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ scans: scans.map(({ id: _, ...s }) => s) }),
  })

  if (res.ok) {
    const data = await res.json()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    scans.forEach((scan, i) => {
      if (data.resultados?.[i]?.ok) store.delete(scan.id)
    })
  }
}

async function getToken() {
  const clients = await self.clients.matchAll()
  return new Promise((resolve) => {
    if (!clients.length) { resolve(null); return }
    const mc = new MessageChannel()
    mc.port1.onmessage = (e) => resolve(e.data?.token || null)
    clients[0].postMessage({ type: 'get_token' }, [mc.port2])
    setTimeout(() => resolve(null), 1000)
  })
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Rondines', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'rondin',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})
