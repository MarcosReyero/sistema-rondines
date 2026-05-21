import React, { useRef, useState, useEffect } from 'react'
import CheckpointMarker from './CheckpointMarker'

export default function MapaCheckpoints({
  imagenUrl,
  checkpoints = [],
  ejecucionActiva,
  onMapClick,
  onMove,
  onDelete,
  adjustMode = false,
  imgPos = { x: 50, y: 50 },
  onImgPosChange,
  lastScanCpId = null,     // ID del checkpoint recién escaneado (para animación)
  readOnly = false,         // true → no drag/click en modo monitoreo
}) {
  const containerRef = useRef(null)
  const [dragging, setDragging] = useState(null)
  const [scansMap, setScansMap] = useState({})
  const [adjDrag, setAdjDrag] = useState(null)

  useEffect(() => {
    if (ejecucionActiva?.scans) {
      const map = {}
      ejecucionActiva.scans.forEach((s) => { map[s.checkpoint] = s })
      setScansMap(map)
    } else {
      setScansMap({})
    }
  }, [ejecucionActiva])

  const handleContainerClick = (e) => {
    if (!onMapClick || dragging || adjustMode || adjDrag || readOnly) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onMapClick(parseFloat(x.toFixed(2)), parseFloat(y.toFixed(2)))
  }

  const handleDragStart = (e, cp) => {
    if (adjustMode || readOnly) return
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

  const handleDragEnd = () => {
    setDragging(null)
    setAdjDrag(null)
  }

  const handleImgMouseDown = (e) => {
    if (!adjustMode) return
    e.preventDefault()
    e.stopPropagation()
    setAdjDrag({ mouseX: e.clientX, mouseY: e.clientY, posX: imgPos.x, posY: imgPos.y })
  }

  const handleMouseMove = (e) => {
    if (adjustMode && adjDrag) {
      const rect = containerRef.current.getBoundingClientRect()
      const dx = ((e.clientX - adjDrag.mouseX) / rect.width) * 100
      const dy = ((e.clientY - adjDrag.mouseY) / rect.height) * 100
      onImgPosChange?.({
        x: Math.min(100, Math.max(0, adjDrag.posX - dx * 0.7)),
        y: Math.min(100, Math.max(0, adjDrag.posY - dy * 0.7)),
      })
      return
    }
    if (dragging) {
      const cp = checkpoints.find((c) => c.id === dragging)
      if (cp) handleDrag(e, cp)
    }
  }

  // Build ordered path from scans
  const lineas = ejecucionActiva?.scans
    ? [...ejecucionActiva.scans]
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map((s) => ({ ...checkpoints.find((cp) => cp.id === s.checkpoint), scanId: s.id }))
        .filter((cp) => cp?.pos_x != null)
    : []

  return (
    <div
      className={`relative w-full h-full min-h-64 rounded-2xl overflow-hidden bg-dark-100 border border-white/5 select-none
        ${adjustMode ? 'cursor-grab' : readOnly ? 'cursor-default' : ''}`}
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      {/* Map image */}
      {imagenUrl ? (
        <img
          src={imagenUrl}
          alt="Mapa"
          style={adjustMode ? { objectPosition: `${imgPos.x}% ${imgPos.y}%` } : {}}
          className={`absolute inset-0 w-full h-full ${adjustMode ? 'object-cover' : 'object-fill'}`}
          draggable={false}
          onMouseDown={handleImgMouseDown}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/20">
          <div className="text-center">
            <p className="text-5xl mb-2">🗺</p>
            <p className="text-sm">Sin imagen satelital</p>
            {!readOnly && <p className="text-xs mt-1">Cargá una imagen en la instalación</p>}
          </div>
        </div>
      )}

      {/* Dark overlay for legibility */}
      {imagenUrl && !adjustMode && (
        <div className="absolute inset-0 bg-dark-500/35" />
      )}

      {/* Adjust mode overlay */}
      {adjustMode && (
        <div className="absolute inset-0 bg-dark-500/10 border-2 border-accent/60 pointer-events-none" />
      )}

      {/* Route lines SVG */}
      {!adjustMode && lineas.length > 1 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {lineas.map((cp, i) => {
            if (i === 0) return null
            const prev = lineas[i - 1]
            const isLatest = i === lineas.length - 1
            return (
              <line
                key={`line-${cp.scanId ?? i}`}
                x1={`${prev.pos_x}%`} y1={`${prev.pos_y}%`}
                x2={`${cp.pos_x}%`}  y2={`${cp.pos_y}%`}
                stroke="#00d4aa"
                strokeWidth={isLatest ? '2.5' : '1.5'}
                strokeDasharray={isLatest ? '8 4' : '5 4'}
                opacity={isLatest ? '0.9' : '0.45'}
                filter={isLatest ? 'url(#glow)' : undefined}
              />
            )
          })}
        </svg>
      )}

      {/* Checkpoint markers */}
      {!adjustMode && checkpoints.map((cp, idx) => (
        <CheckpointMarker
          key={cp.id}
          checkpoint={cp}
          numero={idx + 1}
          scan={scansMap[cp.id]}
          isNew={lastScanCpId === cp.id}
          onDragStart={readOnly ? undefined : (e) => handleDragStart(e, cp)}
          onDelete={readOnly ? undefined : () => onDelete?.(cp.id)}
          isDragging={dragging === cp.id}
        />
      ))}

      {/* Adjust mode hint */}
      {adjustMode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-dark-500/90 text-accent text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
          Arrastrá para ajustar la posición de la imagen
        </div>
      )}

      {/* Edit mode hint */}
      {!adjustMode && !readOnly && onMapClick && (
        <div className="absolute bottom-3 left-3 bg-dark-500/80 text-white/50 text-xs px-3 py-1.5 rounded-full pointer-events-none">
          Click para agregar checkpoint
        </div>
      )}
    </div>
  )
}
