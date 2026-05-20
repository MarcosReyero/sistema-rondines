import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'

const TIPO_CONFIG = {
  observacion: { icon: '✓', color: 'text-accent', bg: 'bg-accent/15', label: 'OK' },
  incidencia:  { icon: '⚠', color: 'text-warning', bg: 'bg-warning/15', label: 'INC' },
  alarma:      { icon: '!', color: 'text-danger',  bg: 'bg-danger/15',  label: 'ALM' },
}

export default function EjecucionRonda() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ejecucion, setEjecucion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [finalizando, setFinalizando] = useState(false)
  const [confirmarFin, setConfirmarFin] = useState(false)

  const cargar = useCallback(() => {
    api.get(`/ejecuciones/${id}/`)
      .then(({ data }) => setEjecucion(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  // Refrescar al volver al foco (después de escanear)
  useEffect(() => {
    const onFocus = () => cargar()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [cargar])

  const finalizar = async () => {
    setFinalizando(true)
    try {
      await api.post(`/ejecuciones/${id}/finalizar/`)
      navigate('/rondas')
    } catch (err) {
      alert(err.response?.data?.error || 'Error al finalizar')
      setFinalizando(false)
    }
    setConfirmarFin(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-dark-300 flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-white/30 text-sm">Cargando ronda...</p>
    </div>
  )

  if (!ejecucion) return (
    <div className="min-h-screen bg-dark-300 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl">🔍</p>
      <p className="text-white/50">Ejecución no encontrada</p>
      <button onClick={() => navigate('/rondas')} className="btn-ghost">← Mis rondas</button>
    </div>
  )

  const { progreso, scans, ronda_nombre, instalacion_nombre, estado } = ejecucion
  const scaneadosIds = new Set(scans.map((s) => s.checkpoint))
  const pct = progreso.total > 0 ? Math.round((progreso.completados / progreso.total) * 100) : 0
  const todosCompletos = progreso.completados >= progreso.total && progreso.total > 0

  return (
    <div className="min-h-screen bg-dark-300 flex flex-col">
      {/* Header */}
      <div className="bg-dark-400 px-4 py-4 border-b border-white/5">
        <button onClick={() => navigate('/rondas')} className="text-accent text-sm mb-2 flex items-center gap-1">
          <span>←</span> <span>Mis rondas</span>
        </button>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-bold text-white text-lg leading-tight truncate">{ronda_nombre}</h1>
            <p className="text-white/40 text-sm">{instalacion_nombre}</p>
          </div>
          <button
            onClick={cargar}
            className="shrink-0 w-8 h-8 flex items-center justify-center text-white/30 hover:text-accent transition-colors rounded-full hover:bg-white/5"
            title="Actualizar"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Progreso */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-end justify-between mb-2">
          <div>
            <span className="text-3xl font-bold text-white">{progreso.completados}</span>
            <span className="text-white/30 text-lg"> / {progreso.total}</span>
            <p className="text-white/40 text-xs mt-0.5">checkpoints escaneados</p>
          </div>
          <span className={`text-2xl font-bold ${todosCompletos ? 'text-accent' : 'text-white/50'}`}>{pct}%</span>
        </div>
        <div className="h-2.5 bg-dark-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${todosCompletos ? 'bg-accent' : 'bg-accent/70'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {todosCompletos && (
          <p className="text-accent text-xs mt-1.5 flex items-center gap-1">
            <span>✓</span> Todos los checkpoints completados
          </p>
        )}
      </div>

      {/* Lista de scans */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {estado === 'en_curso' && scans.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📱</p>
            <p className="text-white/40 text-sm">Escaneá los QR de cada checkpoint</p>
            <p className="text-white/25 text-xs mt-1">Los puntos se irán marcando aquí</p>
          </div>
        )}

        {scans.length > 0 && (
          <div className="space-y-2">
            <p className="text-white/30 text-xs uppercase tracking-wider mb-3">Registros de esta ronda</p>
            {[...scans].reverse().map((scan) => {
              const cfg = TIPO_CONFIG[scan.tipo] || TIPO_CONFIG.observacion
              return (
                <div key={scan.id} className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 ${cfg.bg}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold shrink-0 bg-dark-300/50 ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white text-sm font-semibold truncate">{scan.checkpoint_nombre}</p>
                      <span className="text-white/30 text-xs shrink-0">
                        {new Date(scan.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {scan.nota && (
                      <p className="text-white/55 text-xs mt-0.5 leading-snug line-clamp-2">{scan.nota}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-safe-bottom pt-3 border-t border-white/5 bg-dark-300">
        {estado === 'en_curso' ? (
          <button
            onClick={() => setConfirmarFin(true)}
            disabled={finalizando}
            className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-200 active:scale-[0.98] disabled:opacity-50
              ${todosCompletos
                ? 'bg-accent text-dark-500'
                : 'bg-dark-100 border border-white/10 text-white/50'}`}
          >
            {todosCompletos ? '✓ Finalizar Ronda' : `Finalizar (${progreso.completados}/${progreso.total})`}
          </button>
        ) : (
          <div className={`rounded-2xl py-4 text-center font-semibold
            ${estado === 'completada' ? 'bg-accent/15 text-accent' : 'bg-warning/15 text-warning'}`}>
            Ronda {estado === 'completada' ? 'completada ✓' : 'incompleta'}
          </div>
        )}
      </div>

      {/* Modal confirmación finalizar */}
      {confirmarFin && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 px-4 pb-6">
          <div className="bg-dark-200 rounded-3xl p-6 w-full max-w-sm border border-white/10">
            <h3 className="font-bold text-white text-lg mb-1">
              {todosCompletos ? 'Finalizar ronda' : '¿Finalizar sin completar?'}
            </h3>
            <p className="text-white/50 text-sm mb-5">
              {todosCompletos
                ? `Se registrarán ${progreso.completados} checkpoints completados.`
                : `Quedan ${progreso.total - progreso.completados} checkpoints sin escanear.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmarFin(false)}
                className="flex-1 py-3.5 rounded-2xl border border-white/10 text-white/60 font-medium active:scale-95 transition-transform"
              >
                Cancelar
              </button>
              <button
                onClick={finalizar}
                disabled={finalizando}
                className="flex-1 py-3.5 rounded-2xl bg-accent text-dark-500 font-bold active:scale-95 transition-transform disabled:opacity-50"
              >
                {finalizando ? 'Finalizando...' : 'Finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
