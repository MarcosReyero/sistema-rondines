import { useEffect, useState, useCallback, useRef } from 'react'
import api from '../lib/api'
import { getScansPendientes, limpiarScansSincronizados } from '../lib/db'
import { isAuthenticated } from '../lib/auth'

export function useSyncOffline() {
  const [pendientes, setPendientes] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [lastResult, setLastResult] = useState(null) // { ok, count } | null
  const toastTimer = useRef(null)

  const actualizarContador = useCallback(async () => {
    try {
      const scans = await getScansPendientes()
      setPendientes(scans.length)
    } catch {}
  }, [])

  const sincronizar = useCallback(async () => {
    if (!isAuthenticated()) return
    let scans
    try {
      scans = await getScansPendientes()
    } catch { return }
    if (scans.length === 0) return

    setSincronizando(true)
    try {
      const payload = scans.map(({ id: _id, _saved_at, ...rest }) => rest)
      const { data } = await api.post('/sync/', { scans: payload })

      const exitosos = (data.resultados || [])
        .map((r, i) => (r.ok ? scans[i].id : null))
        .filter(Boolean)

      if (exitosos.length > 0) {
        await limpiarScansSincronizados(exitosos)
      }

      clearTimeout(toastTimer.current)
      setLastResult({ ok: true, count: exitosos.length })
      toastTimer.current = setTimeout(() => setLastResult(null), 4000)
      await actualizarContador()
    } catch {
      clearTimeout(toastTimer.current)
      setLastResult({ ok: false })
      toastTimer.current = setTimeout(() => setLastResult(null), 5000)
    } finally {
      setSincronizando(false)
    }
  }, [actualizarContador])

  useEffect(() => {
    actualizarContador()
    const onOnline = () => sincronizar()
    window.addEventListener('online', onOnline)
    // Try immediately on mount in case app reloaded while offline
    if (navigator.onLine) sincronizar()
    return () => {
      window.removeEventListener('online', onOnline)
      clearTimeout(toastTimer.current)
    }
  }, [sincronizar, actualizarContador])

  return { pendientes, sincronizando, lastResult, sincronizar }
}
