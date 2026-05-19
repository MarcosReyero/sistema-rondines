import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'

export default function EjecucionRonda() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ejecucion, setEjecucion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [finalizando, setFinalizando] = useState(false)

  const cargar = () => {
    api.get(`/ejecuciones/${id}/`)
      .then(({ data }) => setEjecucion(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [id])

  const finalizar = async () => {
    if (!confirm('¿Finalizar la ronda?')) return
    setFinalizando(true)
    try {
      await api.post(`/ejecuciones/${id}/finalizar/`)
      navigate('/rondas')
    } catch (err) {
      alert(err.response?.data?.error || 'Error al finalizar')
      setFinalizando(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!ejecucion) return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center text-white/50">
      Ejecución no encontrada
    </div>
  )

  const { progreso, scans, ronda_nombre, instalacion_nombre } = ejecucion
  const scanIds = new Set(scans.map((s) => s.checkpoint))

  const checkpointOrdenes = ejecucion.ronda
    ? []
    : []

  const pct = progreso.total > 0 ? Math.round((progreso.completados / progreso.total) * 100) : 0
  const todosCompletos = progreso.completados >= progreso.total

  return (
    <div className="min-h-screen bg-dark-300 flex flex-col">
      {/* Header */}
      <div className="bg-dark-400 px-4 py-4 border-b border-white/5">
        <button onClick={() => navigate('/rondas')} className="text-accent text-sm mb-2">← Volver</button>
        <h1 className="font-bold text-white text-lg">{ronda_nombre}</h1>
        <p className="text-white/50 text-sm">{instalacion_nombre}</p>
      </div>

      {/* Progreso */}
      <div className="px-4 py-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/60">{progreso.completados} de {progreso.total} checkpoints</span>
          <span className="text-accent font-semibold">{pct}%</span>
        </div>
        <div className="h-3 bg-dark-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Scans realizados */}
      <div className="px-4 pb-4 flex-1">
        {scans.length > 0 && (
          <div className="mb-4">
            <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">Checkpoints escaneados</h3>
            <div className="space-y-2">
              {scans.map((scan) => (
                <div key={scan.id} className="flex items-center gap-3 bg-dark-200 rounded-xl px-3 py-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                    ${scan.tipo === 'alarma' ? 'bg-danger/20 text-danger' :
                      scan.tipo === 'incidencia' ? 'bg-warning/20 text-warning' :
                      'bg-accent/20 text-accent'}`}>
                    {scan.tipo === 'alarma' ? '!' : scan.tipo === 'incidencia' ? '⚠' : '✓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{scan.checkpoint_nombre}</p>
                    <p className="text-white/40 text-xs">
                      {new Date(scan.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      {scan.nota && ` — ${scan.nota}`}
                    </p>
                  </div>
                  <span className={`badge-${scan.tipo}`}>{scan.tipo}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado */}
        {ejecucion.estado === 'en_curso' && (
          <div className="bg-dark-200 rounded-2xl p-4 text-center border border-accent/20">
            <p className="text-white/60 text-sm mb-1">Escaneá los checkpoints con el QR</p>
            <p className="text-white/40 text-xs">Los QR llevan a /check/[uuid]</p>
          </div>
        )}
      </div>

      {/* Botón finalizar */}
      {ejecucion.estado === 'en_curso' && (
        <div className="px-4 pb-6 pt-2">
          <button
            onClick={finalizar}
            disabled={finalizando}
            className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-200 active:scale-95
              ${todosCompletos
                ? 'bg-accent text-dark-500 hover:bg-accent-hover'
                : 'bg-dark-100 text-white/40 border border-white/10'}`}
          >
            {finalizando ? 'Finalizando...' : todosCompletos ? 'Finalizar Ronda ✓' : `Finalizar (${progreso.completados}/${progreso.total})`}
          </button>
        </div>
      )}

      {ejecucion.estado !== 'en_curso' && (
        <div className="px-4 pb-6">
          <div className={`rounded-2xl py-4 text-center font-semibold
            ${ejecucion.estado === 'completada' ? 'bg-accent/20 text-accent' : 'bg-warning/20 text-warning'}`}>
            Ronda {ejecucion.estado}
          </div>
        </div>
      )}
    </div>
  )
}
