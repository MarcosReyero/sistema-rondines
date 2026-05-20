import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { getUser, logout } from '../../lib/auth'
import { useOfflineSync } from '../../hooks/useOfflineSync'

export default function MisRondas() {
  const navigate = useNavigate()
  const user = getUser()
  const [rondas, setRondas] = useState([])
  const [ejecucionActiva, setEjecucionActiva] = useState(null)
  const [loading, setLoading] = useState(true)
  const [iniciando, setIniciando] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)
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

  useEffect(() => {
    const cargar = async () => {
      try {
        const [rondasRes, ejecRes] = await Promise.all([
          api.get('/rondas/'),
          api.get('/ejecuciones/?estado=en_curso'),
        ])
        setRondas(rondasRes.data.results || rondasRes.data)
        const activas = ejecRes.data.results || ejecRes.data
        setEjecucionActiva(activas[0] || null)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const iniciarRonda = async (rondaId) => {
    setIniciando(rondaId)
    try {
      const { data } = await api.post('/ejecuciones/', { ronda: rondaId })
      navigate(`/ejecucion/${data.id}`)
    } catch (err) {
      alert(err.response?.data?.error || 'Error al iniciar ronda')
    } finally {
      setIniciando(null)
    }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const nombreUsuario = user?.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : user?.username || 'Vigilante'

  return (
    <div className="min-h-screen bg-dark-300 flex flex-col">
      {/* Header */}
      <div className="bg-dark-400 px-4 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/30 text-xs uppercase tracking-wider">Bienvenido</p>
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

      <div className="flex-1 px-4 py-5 flex flex-col gap-4">
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

        {/* Ronda en curso */}
        {ejecucionActiva && (
          <div>
            <p className="text-white/30 text-xs uppercase tracking-wider mb-2">En curso ahora</p>
            <button
              onClick={() => navigate(`/ejecucion/${ejecucionActiva.id}`)}
              className="w-full bg-accent/10 border-2 border-accent rounded-2xl px-4 py-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-accent text-base truncate">{ejecucionActiva.ronda_nombre}</p>
                  <p className="text-white/50 text-sm">{ejecucionActiva.instalacion_nombre}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-accent font-bold text-lg">
                    {ejecucionActiva.progreso?.completados ?? '–'}/{ejecucionActiva.progreso?.total ?? '–'}
                  </p>
                  <p className="text-white/30 text-xs">completados</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-accent text-sm font-medium">
                <span>Continuar ronda</span>
                <span>→</span>
              </div>
            </button>
          </div>
        )}

        {/* Lista de rondas */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rondas.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <p className="text-5xl mb-4">🔒</p>
            <p className="text-white/50 font-medium">Sin rondas asignadas</p>
            <p className="text-white/25 text-sm mt-1">Contactá al supervisor</p>
          </div>
        ) : (
          <div>
            {!ejecucionActiva && (
              <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Rondas disponibles</p>
            )}
            {ejecucionActiva && rondas.length > 0 && (
              <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Otras rondas</p>
            )}
            <div className="space-y-3">
              {rondas.map((ronda) => (
                <div
                  key={ronda.id}
                  className="bg-dark-200 border border-white/5 rounded-2xl px-4 py-4"
                >
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-base truncate">{ronda.nombre}</h3>
                      <p className="text-white/40 text-sm">{ronda.instalacion_nombre}</p>
                      {ronda.descripcion && (
                        <p className="text-white/30 text-xs mt-1 line-clamp-2">{ronda.descripcion}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-2xl font-bold text-accent">{ronda.checkpoints_count}</span>
                      <p className="text-white/30 text-xs leading-none mt-0.5">QR</p>
                    </div>
                  </div>
                  <button
                    onClick={() => iniciarRonda(ronda.id)}
                    disabled={iniciando === ronda.id || !!ejecucionActiva}
                    className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-40
                      ${ejecucionActiva ? 'bg-dark-100 border border-white/10 text-white/30 cursor-not-allowed' : 'bg-accent text-dark-500'}`}
                  >
                    {iniciando === ronda.id
                      ? <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                          Iniciando...
                        </span>
                      : ejecucionActiva
                        ? 'Hay una ronda en curso'
                        : 'Iniciar Ronda →'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
