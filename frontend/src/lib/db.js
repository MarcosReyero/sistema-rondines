const DB_NAME = 'rondines_offline'
const DB_VERSION = 1
const STORE_SCANS = 'scans_pendientes'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_SCANS)) {
        const store = db.createObjectStore(STORE_SCANS, { keyPath: 'id', autoIncrement: true })
        store.createIndex('ejecucion_id', 'ejecucion_id', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function guardarScanOffline(scan) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCANS, 'readwrite')
    const req = tx.objectStore(STORE_SCANS).add({ ...scan, _saved_at: new Date().toISOString() })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getScansPendientes() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCANS, 'readonly')
    const req = tx.objectStore(STORE_SCANS).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function eliminarScan(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCANS, 'readwrite')
    const req = tx.objectStore(STORE_SCANS).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ─── Caché offline: checkpoints y ejecución activa ───────────────────────────

export function cachearCheckpoints(checkpoints) {
  try {
    const mapa = {}
    checkpoints.forEach((cp) => { mapa[String(cp.codigo_qr)] = cp })
    localStorage.setItem('rondines_cp_cache', JSON.stringify(mapa))
  } catch {}
}

export function getCheckpointCacheado(uuid) {
  try {
    const mapa = JSON.parse(localStorage.getItem('rondines_cp_cache') || '{}')
    return mapa[String(uuid)] || null
  } catch { return null }
}

export function cachearEjecucionActiva(ejecucion) {
  try {
    if (ejecucion) {
      localStorage.setItem('rondines_ejecucion', JSON.stringify({
        id: ejecucion.id,
        ronda: ejecucion.ronda,
        ronda_nombre: ejecucion.ronda_nombre,
        instalacion_nombre: ejecucion.instalacion_nombre,
        estado: ejecucion.estado,
        progreso: ejecucion.progreso ?? null,
        hora_limite: ejecucion.hora_limite ?? null,
        vencida: ejecucion.vencida ?? false,
      }))
    } else {
      localStorage.removeItem('rondines_ejecucion')
    }
  } catch {}
}

export function getEjecucionCacheada() {
  try {
    return JSON.parse(localStorage.getItem('rondines_ejecucion') || 'null')
  } catch { return null }
}

export async function limpiarScansSincronizados(ids) {
  const db = await openDB()
  const tx = db.transaction(STORE_SCANS, 'readwrite')
  const store = tx.objectStore(STORE_SCANS)
  await Promise.all(ids.map((id) => new Promise((res) => { store.delete(id).onsuccess = res })))
}
