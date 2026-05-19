import React from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPO_ICON = { incidencia: '⚠', alarma: '🚨', observacion: '✓' }

export default function AlertasFeed({ alertas = [], onAtender }) {
  const sinAtender = alertas.filter((a) => !a.atendida && ['incidencia', 'alarma'].includes(a.tipo))

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white/60 text-sm uppercase tracking-wider">Alertas</h2>
        {sinAtender.length > 0 && (
          <span className="bg-danger text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
            {sinAtender.length}
          </span>
        )}
      </div>

      <div className="space-y-2 overflow-auto flex-1">
        {alertas.length === 0 ? (
          <div className="text-center text-white/20 py-8 text-sm">Sin alertas</div>
        ) : (
          alertas.map((alerta, i) => (
            <div
              key={alerta.id || i}
              className={`rounded-xl px-3 py-3 border transition-opacity duration-300 ${
                alerta.atendida ? 'opacity-40 bg-dark-100 border-white/5' :
                alerta.tipo === 'alarma' ? 'bg-danger/10 border-danger/30' :
                'bg-warning/10 border-warning/30'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0 mt-0.5">{TIPO_ICON[alerta.tipo]}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${
                    alerta.tipo === 'alarma' ? 'text-danger' :
                    alerta.tipo === 'incidencia' ? 'text-warning' : 'text-accent'
                  }`}>
                    {alerta.checkpoint_nombre || alerta.checkpoint}
                  </p>
                  {alerta.nota && (
                    <p className="text-white/50 text-xs mt-0.5 line-clamp-2">{alerta.nota}</p>
                  )}
                  <p className="text-white/30 text-xs mt-1">
                    {alerta.vigilante_nombre} ·{' '}
                    {alerta.timestamp
                      ? format(new Date(alerta.timestamp), 'HH:mm', { locale: es })
                      : ''}
                  </p>
                </div>
                {!alerta.atendida && onAtender && (
                  <button
                    onClick={() => onAtender(alerta.id)}
                    className="text-white/30 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                  >
                    ✓
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
