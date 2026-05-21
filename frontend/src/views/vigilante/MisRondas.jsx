import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { getUser, logout } from '../../lib/auth'
import { useOfflineSync } from '../../hooks/useOfflineSync'
import QRScannerModal from '../../components/QRScannerModal'

export default function MisRondas() {
  const navigate = useNavigate()
  const user = getUser()
  const [ejecucion, setEjecucion] = useState(null)   // ronda activa asignada
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(navigator.onLine)
  const [scannerAbierto, setScannerAbierto] = useState(false)
  useOfflineSync()

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/ejecuciones/?estado=en_curso')
      const lista = data.results || data
      setEjecucion(lista[0] || null)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Refrescar al volver al foco (después de un scan)
  useEffect(() => {
    const onFocus = () => cargar()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [cargar])

  const handleLogout = () => { logout(); navigate('/login') }

  const nombreUsuario = user?.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : user?.username || 'Vigilante'

  const pct = ejecucion?.progreso?.total > 0
    ? Math.round((ejecucion.progreso.completados / ejecucion.progreso.total) * 100)
    : 0

  return (
    <div className="min-h-screen bg-dark-300 flex flex-col">
      {/* Header */}
      <div className="bg-dark-400 px-4 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/30 text-xs uppercase tracking-wider">Vigilante</p>
            <h1 className="font-bold text-white text-lg leading-tight">{nombreUsuario}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${online ? 'bg-accent' : 'bg-danger'}`} />
              <span className={`text-xs ${online ? 'text-accent' : 'text-danger'}`}>
                {online ? 'En línea' : 'Sin conexión'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/30 hover:text-white/70 text-sm transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 flex flex-col gap-5">
        {/* Banner sin conexión */}
        {!online && (
          <div className="bg-warning/10 border border-warning/30 rounded-2xl px-4 py-3 flex items-start gap-2.5">
            <span className="text-warning text-base mt-0.5">⚠</span>
            <div>
              <p className="text-warning text-sm font-medium">Sin conexión</p>
              <p className="text-warning/70 text-xs mt-0.5">Los scans se guardan localmente y se sincronizan al reconectar.</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Ronda activa asignada */}
            {ejecucion ? (
              <div>
                <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Ronda en curso</p>
                <button
                  onClick={() => navigate(`/ejecucion/${ejecucion.id}`)}
                  className="w-full bg-dark-200 border border-white/10 rounded-2xl px-4 py-4 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-white text-base truncate">{ejecucion.ronda_nombre}</p>
                      <p className="text-white/40 text-sm">{ejecucion.instalacion_nombre}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-accent font-bold text-lg">
                        {ejecucion.progreso?.completados ?? 0}/{ejecucion.progreso?.total ?? 0}
                      </p>
                      <p className="text-white/30 text-xs">completados</p>
                    </div>
                  </div>
                  {/* Barra de progreso */}
                  <div className="mt-3 h-1.5 bg-dark-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-white/25 text-xs mt-2 text-right">Ver detalle →</p>
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-3">
                <p className="text-4xl">⏳</p>
                <p className="text-white/50 font-medium">Sin ronda asignada</p>
                <p className="text-white/25 text-sm">El supervisor te asignará una ronda</p>
              </div>
            )}

            {/* Botón escanear — siempre visible */}
            <div className="mt-auto">
              <button
                onClick={() => setScannerAbierto(true)}
                className="w-full py-5 rounded-2xl font-bold text-xl bg-accent text-dark-500 active:scale-[0.98] transition-transform flex items-center justify-center gap-3 shadow-lg"
                style={{ boxShadow: '0 0 24px #00d4aa44' }}
              >
                <span className="text-2xl">⬛</span>
                Escanear QR
              </button>
              {!ejecucion && (
                <p className="text-white/20 text-xs text-center mt-2">
                  Podés escanear aunque no haya ronda activa
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Scanner */}
      {scannerAbierto && (
        <QRScannerModal
          onScan={(uuid) => {
            setScannerAbierto(false)
            navigate(`/check/${uuid}`)
          }}
          onClose={() => setScannerAbierto(false)}
        />
      )}
    </div>
  )
}
