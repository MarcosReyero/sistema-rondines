import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useWebSocket } from '../../hooks/useWebSocket'
import AlertasFeed from '../../components/AlertasFeed'

function MetricCard({ label, value, color = 'accent', icon }) {
  const colors = {
    accent: 'text-accent bg-accent/10',
    danger: 'text-danger bg-danger/10',
    warning: 'text-warning bg-warning/10',
    blue: 'text-blue-400 bg-blue-400/10',
  }
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
        <p className="text-white/50 text-sm">{label}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [alertas, setAlertas] = useState([])

  const cargar = () => {
    api.get('/dashboard/').then(({ data: d }) => {
      setData(d)
      setAlertas(d.alertas_recientes || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  useWebSocket((msg) => {
    if (['ronda_iniciada', 'ronda_finalizada', 'checkpoint_escaneado'].includes(msg.type)) {
      cargar()
    }
    if (msg.type === 'alerta') {
      setAlertas((prev) => [{ ...msg.data, id: Date.now() }, ...prev])
    }
  })

  const atenderAlerta = async (scanId) => {
    await api.patch(`/alertas/${scanId}/atender/`)
    setAlertas((prev) => prev.map((a) => a.id === scanId ? { ...a, atendida: true } : a))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 space-y-6 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <button onClick={cargar} className="text-white/40 hover:text-white text-sm transition-colors">↻ Actualizar</button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard icon="🔄" label="Rondas en curso" value={data?.rondines_en_curso} color="blue" />
        <MetricCard icon="✓" label="Completadas hoy" value={data?.rondines_completados_hoy} color="accent" />
        <MetricCard icon="📍" label="Scans hoy" value={data?.checkpoints_completados_hoy} color="accent" />
        <MetricCard icon="🚨" label="Alertas activas" value={data?.alertas_activas} color="danger" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Ejecuciones recientes */}
        <div className="xl:col-span-2 space-y-3">
          <h2 className="text-white/60 text-sm uppercase tracking-wider">Rondines recientes</h2>
          {(data?.ejecuciones_recientes || []).length === 0 ? (
            <div className="card text-white/30 text-sm text-center py-8">Sin actividad</div>
          ) : (
            <div className="space-y-2">
              {(data?.ejecuciones_recientes || []).map((e) => (
                <div key={e.id} className="card flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm truncate">{e.ronda_nombre}</p>
                    <p className="text-white/40 text-xs">{e.vigilante_nombre} · {e.instalacion_nombre}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`badge-${e.estado}`}>{e.estado.replace('_', ' ')}</span>
                    <p className="text-white/30 text-xs mt-1">
                      {e.progreso.completados}/{e.progreso.total}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas feed */}
        <div>
          <AlertasFeed alertas={alertas} onAtender={atenderAlerta} />
        </div>
      </div>
    </div>
  )
}
