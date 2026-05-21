import React, { useState } from 'react'

const COLORES = {
  sin_scan:    { bg: 'bg-white/15',   border: 'border-white/30',  text: 'text-white/60' },
  observacion: { bg: 'bg-accent/30',  border: 'border-accent',    text: 'text-accent' },
  incidencia:  { bg: 'bg-warning/30', border: 'border-warning',   text: 'text-warning' },
  alarma:      { bg: 'bg-danger/30',  border: 'border-danger',    text: 'text-danger', pulse: true },
}

export default function CheckpointMarker({ checkpoint, numero, scan, onDragStart, onDelete, isDragging, isNew }) {
  const [hover, setHover] = useState(false)
  const estado = scan ? scan.tipo : 'sin_scan'
  const colores = COLORES[estado] || COLORES.sin_scan

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 ${onDragStart ? 'cursor-move' : 'cursor-default'} group`}
      style={{ left: `${checkpoint.pos_x}%`, top: `${checkpoint.pos_y}%` }}
      onMouseDown={onDragStart}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Alarm pulse ring */}
      {colores.pulse && (
        <div className="absolute inset-0 -m-1 rounded-full bg-danger/40 animate-ping" />
      )}

      {/* New-scan expanding ring — plays once on scan event */}
      {isNew && (
        <div
          key={`pulse-${checkpoint.id}-${Date.now()}`}
          className="absolute inset-0 -m-0.5 rounded-full bg-accent/50 animate-scan-pulse pointer-events-none"
        />
      )}

      <div
        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all duration-200
          ${colores.bg} ${colores.border} ${colores.text}
          ${isDragging ? 'scale-125 shadow-lg shadow-accent/30' : 'hover:scale-110'}
          ${isNew ? 'scale-110 shadow-md shadow-accent/50' : ''}`}
      >
        {scan
          ? <span className="text-[10px]">{estado === 'observacion' ? '✓' : estado === 'incidencia' ? '⚠' : '!'}</span>
          : <span>{numero}</span>
        }
      </div>

      {/* Tooltip */}
      {hover && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none z-20">
          <div className="bg-dark-500 border border-white/10 rounded-xl px-3 py-2 text-left whitespace-nowrap shadow-xl">
            <p className="text-white text-xs font-semibold">{checkpoint.nombre}</p>
            {scan ? (
              <>
                <p className={`text-xs mt-0.5 capitalize ${colores.text}`}>{scan.tipo}</p>
                {scan.nota && <p className="text-white/40 text-xs mt-0.5 max-w-[160px] truncate">{scan.nota}</p>}
                <p className="text-white/25 text-xs mt-0.5">
                  {new Date(scan.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </>
            ) : (
              <p className="text-white/40 text-xs mt-0.5">Pendiente</p>
            )}
          </div>
          {onDelete && (
            <button
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger text-white text-xs flex items-center justify-center hover:bg-danger-hover pointer-events-auto"
              onMouseDown={(e) => { e.stopPropagation(); onDelete() }}
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  )
}
