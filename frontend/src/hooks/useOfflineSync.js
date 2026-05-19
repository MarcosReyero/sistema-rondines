import { useEffect, useCallback } from 'react'
import api from '../lib/api'
import { getScansPendientes, limpiarScansSincronizados } from '../lib/db'

export function useOfflineSync() {
  const sync = useCallback(async () => {
    if (!navigator.onLine) return
    const pendientes = await getScansPendientes()
    if (pendientes.length === 0) return

    const scans = pendientes.map((s) => ({
      checkpoint_uuid: s.checkpoint_uuid,
      ejecucion_id: s.ejecucion_id,
      timestamp: s.timestamp,
      tipo: s.tipo,
      nota: s.nota || '',
      latitud: s.latitud || null,
      longitud: s.longitud || null,
    }))

    try {
      const { data } = await api.post('/sync/', { scans })
      const okIds = pendientes
        .filter((_, i) => data.resultados[i]?.ok)
        .map((s) => s.id)
      if (okIds.length > 0) {
        await limpiarScansSincronizados(okIds)
      }
    } catch {
      // retry next time
    }
  }, [])

  useEffect(() => {
    window.addEventListener('online', sync)
    sync()
    return () => window.removeEventListener('online', sync)
  }, [sync])

  return { sync }
}
