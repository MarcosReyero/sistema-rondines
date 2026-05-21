import { useState, useEffect } from 'react'
import { useSyncOffline } from '../hooks/useSyncOffline'
import { isAuthenticated } from '../lib/auth'

export default function SyncBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  const { pendientes, sincronizando, lastResult, sincronizar } = useSyncOffline()

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!isAuthenticated()) return null

  // Syncing in progress
  if (sincronizando) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] pointer-events-none">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-dark-400 border border-accent/30 shadow-xl shadow-black/40">
          <span className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-accent text-sm font-medium whitespace-nowrap">Sincronizando {pendientes} scan{pendientes !== 1 ? 's' : ''}...</span>
        </div>
      </div>
    )
  }

  // Just finished — success toast
  if (lastResult?.ok && lastResult.count > 0) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] pointer-events-none animate-fade-in">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-dark-400 border border-accent/40 shadow-xl shadow-black/40">
          <span className="text-accent text-base">✓</span>
          <span className="text-accent text-sm font-medium whitespace-nowrap">
            {lastResult.count} scan{lastResult.count !== 1 ? 's' : ''} sincronizado{lastResult.count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    )
  }

  // Sync failed toast
  if (lastResult?.ok === false) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] pointer-events-none animate-fade-in">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-dark-400 border border-warning/40 shadow-xl shadow-black/40">
          <span className="text-warning text-base">⚠</span>
          <span className="text-warning text-sm font-medium whitespace-nowrap">No se pudo sincronizar — se reintentará al reconectar</span>
        </div>
      </div>
    )
  }

  // Offline with pending scans — persistent yellow pill
  if (!online && pendientes > 0) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200]">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-dark-400 border border-warning/40 shadow-xl shadow-black/40">
          <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
          <span className="text-warning text-sm font-medium whitespace-nowrap">
            {pendientes} scan{pendientes !== 1 ? 's' : ''} pendiente{pendientes !== 1 ? 's' : ''} · Sin conexión
          </span>
        </div>
      </div>
    )
  }

  // Online with pending scans (transitional) — show retry button
  if (online && pendientes > 0 && !sincronizando) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] animate-fade-in">
        <button
          onClick={sincronizar}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-dark-400 border border-accent/30 shadow-xl shadow-black/40 active:scale-95 transition-transform"
        >
          <span className="text-accent text-base">↑</span>
          <span className="text-accent text-sm font-medium whitespace-nowrap">
            {pendientes} scan{pendientes !== 1 ? 's' : ''} por sincronizar · Tap para sincronizar
          </span>
        </button>
      </div>
    )
  }

  return null
}
