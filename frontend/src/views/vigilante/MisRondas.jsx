import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { getUser, logout } from '../../lib/auth'
import { useOfflineSync } from '../../hooks/useOfflineSync'

export default function MisRondas() {
  const navigate = useNavigate()
  const user = getUser()
  const [rondas, setRondas] = useState([])
  const [loading, setLoading] = useState(true)
  const [iniciando, setIniciando] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)
  useOfflineSync()

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

  useEffect(() => {
    api.get('/rondas/').then(({ data }) => {
      setRondas(data.results || data)
    }).catch(console.error).finally(() => setLoading(false))
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

  return (
    <div className="min-h-screen bg-dark-300 flex flex-col">
      {/* Header */}
      <div className="bg-dark-400 px-4 py-4 flex items-center justify-between border-b border-white/5">
        <div>
          <h1 className="font-bold text-white">Mis Rondas</h1>
          <p className="text-white/50 text-xs">{user?.nombre}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${online ? 'bg-accent' : 'bg-danger'}`} title={online ? 'En línea' : 'Sin conexión'} />
          <button onClick={handleLogout} className="text-white/40 hover:text-white/80 text-sm transition-colors">
            Salir
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6">
        {!online && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3 mb-4 text-warning text-sm flex items-center gap-2">
            <span>⚠</span> Sin conexión — los scans se guardarán localmente
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rondas.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <p className="text-5xl mb-4">🔒</p>
            <p>No hay rondas asignadas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rondas.map((ronda) => (
              <div key={ronda.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{ronda.nombre}</h3>
                    <p className="text-white/50 text-sm">{ronda.instalacion_nombre}</p>
                    {ronda.descripcion && (
                      <p className="text-white/40 text-xs mt-1 line-clamp-2">{ronda.descripcion}</p>
                    )}
                  </div>
                  <div className="ml-3 text-right shrink-0">
                    <span className="text-2xl font-bold text-accent">{ronda.checkpoints_count}</span>
                    <p className="text-white/40 text-xs">checkpoints</p>
                  </div>
                </div>
                <button
                  onClick={() => iniciarRonda(ronda.id)}
                  disabled={iniciando === ronda.id}
                  className="btn-primary w-full text-sm py-2.5 disabled:opacity-50"
                >
                  {iniciando === ronda.id ? 'Iniciando...' : 'Iniciar Ronda'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
