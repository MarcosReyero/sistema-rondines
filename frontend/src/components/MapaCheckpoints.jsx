import React, { useRef, useState, useEffect } from 'react'
import CheckpointMarker from './CheckpointMarker'

export default function MapaCheckpoints({
  imagenUrl,
  checkpoints = [],
  ejecucionActiva,
  onMapClick,
  onMove,
  onDelete,
}) {
  const containerRef = useRef(null)
  const [dragging, setDragging] = useState(null)
  const [scansMap, setScansMap] = useState({})

  useEffect(() => {
    if (ejecucionActiva?.scans) {
      const map = {}
      ejecucionActiva.scans.forEach((s) => { map[s.checkpoint] = s })
      setScansMap(map)
    }
  }, [ejecucionActiva])

  const handleContainerClick = (e) => {
    if (!onMapClick || dragging) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onMapClick(parseFloat(x.toFixed(2)), parseFloat(y.toFixed(2)))
  }

  const handleDragStart = (e, cp) => {
    e.stopPropagation()
    setDragging(cp.id)
  }

  const handleDrag = (e, cp) => {
    if (!dragging || dragging !== cp.id) return
    e.stopPropagation()
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))
    onMove?.(cp.id, parseFloat(x.toFixed(2)), parseFloat(y.toFixed(2)))
  }

  const handleDragEnd = () => setDragging(null)

  const lineas = ejecucionActiva?.scans
    ? [...ejecucionActiva.scans]
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map((s) => checkpoints.find((cp) => cp.id === s.checkpoint))
        .filter(Boolean)
    : []

  return (
    <div className="relative w-full h-full min-h-64 rounded-2xl overflow-hidden bg-dark-100 border border-white/5 select-none"
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseMove={(e) => { if (dragging) { const cp = checkpoints.find((c) => c.id === dragging); if (cp) handleDrag(e, cp) } }}
      onMouseUp={handleDragEnd}
    >
      {imagenUrl ? (
        <img
          src={imagenUrl}
          alt="Mapa"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/20">
          <div className="text-center">
            <p className="text-5xl mb-2">🗺</p>
            <p className="text-sm">Sin imagen satelital</p>
            <p className="text-xs mt-1">Cargá una imagen en la instalación</p>
          </div>
        </div>
      )}

      {/* Overlay semi transparente para legibilidad */}
      {imagenUrl && <div className="absolute inset-0 bg-dark-500/30" />}

      {/* Líneas de recorrido de la ejecución activa */}
      {lineas.length > 1 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {lineas.map((cp, i) => {
            if (i === 0) return null
            const prev = lineas[i - 1]
            return (
              <line
                key={`line-${i}`}
                x1={`${prev.pos_x}%`} y1={`${prev.pos_y}%`}
                x2={`${cp.pos_x}%`} y2={`${cp.pos_y}%`}
                stroke="#00d4aa"
                strokeWidth="2"
                strokeDasharray="6 3"
                opacity="0.6"
              />
            )
          })}
        </svg>
      )}

      {/* Marcadores */}
      {checkpoints.map((cp, idx) => (
        <CheckpointMarker
          key={cp.id}
          checkpoint={cp}
          numero={idx + 1}
          scan={scansMap[cp.id]}
          onDragStart={(e) => handleDragStart(e, cp)}
          onDelete={() => onDelete?.(cp.id)}
          isDragging={dragging === cp.id}
        />
      ))}

      {onMapClick && (
        <div className="absolute bottom-3 left-3 bg-dark-500/80 text-white/50 text-xs px-3 py-1.5 rounded-full pointer-events-none">
          Click para agregar checkpoint
        </div>
      )}
    </div>
  )
}
