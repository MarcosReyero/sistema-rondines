import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import MapaCheckpoints from '../../components/MapaCheckpoints'

export default function MapaInstalacion() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [instalaciones, setInstalaciones] = useState([])
  const [seleccionada, setSeleccionada] = useState(null)
  const [checkpoints, setCheckpoints] = useState([])
  const [ejecucionActiva, setEjecucionActiva] = useState(null)
  const [loading, setLoading] = useState(true)

  // Checkpoint modal
  const [showFormCheckpoint, setShowFormCheckpoint] = useState(false)
  const [posClick, setPosClick] = useState(null)
  const [formCp, setFormCp] = useState({ nombre: '', descripcion: '' })
  const [errorCp, setErrorCp] = useState('')
  const [guardandoCp, setGuardandoCp] = useState(false)

  // Modo ajuste de imagen
  const [adjustMode, setAdjustMode] = useState(false)
  const [imgPos, setImgPos] = useState({ x: 50, y: 50 })

  // ── FLUJO DE NUEVA INSTALACIÓN ──────────────────────────────────────────────
  // Paso 1: modal con nombre + imagen
  const [showPaso1, setShowPaso1] = useState(false)
  const [formInst, setFormInst] = useState({ nombre: '', descripcion: '' })
  const [imagenFile, setImagenFile] = useState(null)
  const [errorInst, setErrorInst] = useState('')

  // Paso 2: mapa en borrador (checkpoints locales, aún no guardados)
  const [draft, setDraft] = useState(null)       // { nombre, descripcion, imagenFile, preview }
  const [draftCps, setDraftCps] = useState([])   // checkpoints pendientes
  const [guardando, setGuardando] = useState(false)

  const esDraft = draft !== null
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    api.get('/instalaciones/').then(({ data }) => {
      const lista = data.results || data
      setInstalaciones(lista)
      if (id) {
        const found = lista.find((i) => String(i.id) === String(id))
        if (found) seleccionar(found)
      }
    }).finally(() => setLoading(false))
  }, [id])

  const seleccionar = async (inst) => {
    cancelarDraft()
    setSeleccionada(inst)
    setAdjustMode(false)
    navigate(`/supervisor/instalaciones/${inst.id}`, { replace: true })
    const saved = localStorage.getItem(`imgPos_${inst.id}`)
    setImgPos(saved ? JSON.parse(saved) : { x: 50, y: 50 })
    const { data } = await api.get(`/instalaciones/${inst.id}/checkpoints/`)
    setCheckpoints(data.results || data)
    const { data: ejec } = await api.get(`/ejecuciones/?estado=en_curso&instalacion=${inst.id}`)
    setEjecucionActiva((ejec.results || ejec)[0] || null)
  }

  // ── Paso 1: abrir formulario inicial ────────────────────────────────────────
  const abrirNuevaInstalacion = () => {
    setFormInst({ nombre: '', descripcion: '' })
    setImagenFile(null)
    setErrorInst('')
    setShowPaso1(true)
  }

  // ── Paso 1 → Paso 2: ir al mapa en borrador ─────────────────────────────────
  const continuarAlMapa = () => {
    if (!formInst.nombre.trim()) { setErrorInst('El nombre es obligatorio'); return }
    const preview = imagenFile ? URL.createObjectURL(imagenFile) : null
    setDraft({ nombre: formInst.nombre, descripcion: formInst.descripcion, imagenFile, preview })
    setDraftCps([])
    setSeleccionada(null)
    setCheckpoints([])
    setShowPaso1(false)
  }

  // ── Cancelar borrador ────────────────────────────────────────────────────────
  const cancelarDraft = () => {
    if (draft?.preview) URL.revokeObjectURL(draft.preview)
    setDraft(null)
    setDraftCps([])
  }

  // ── Guardar todo al backend ──────────────────────────────────────────────────
  const guardarInstalacion = async () => {
    setGuardando(true)
    try {
      const fd = new FormData()
      fd.append('nombre', draft.nombre)
      fd.append('descripcion', draft.descripcion)
      if (draft.imagenFile) fd.append('imagen_satelital', draft.imagenFile)
      const { data: inst } = await api.post('/instalaciones/', fd)

      for (const cp of draftCps) {
        await api.post('/checkpoints/', {
          instalacion: inst.id,
          nombre: cp.nombre,
          descripcion: cp.descripcion,
          pos_x: cp.pos_x,
          pos_y: cp.pos_y,
        })
      }

      if (draft.preview) URL.revokeObjectURL(draft.preview)
      setDraft(null)
      setDraftCps([])
      setInstalaciones((prev) => [...prev, inst])
      seleccionar(inst)
    } catch (err) {
      const d = err.response?.data
      const msg = d
        ? (typeof d === 'string' ? d : Object.entries(d).map(([k, v]) => `${k}: ${[v].flat().join(', ')}`).join('\n'))
        : 'Error al guardar'
      alert(msg)
    } finally {
      setGuardando(false)
    }
  }

  // ── Checkpoints (instalación guardada) ──────────────────────────────────────
  const handleMapClick = (x, y) => {
    setPosClick({ x, y })
    setFormCp({ nombre: '', descripcion: '' })
    setErrorCp('')
    setShowFormCheckpoint(true)
  }

  const agregarCheckpoint = async () => {
    if (!formCp.nombre.trim()) { setErrorCp('El nombre es obligatorio'); return }
    setErrorCp('')

    if (esDraft) {
      // En borrador: guardar localmente con ID temporal
      setDraftCps((prev) => [...prev, {
        _tmpId: Date.now(),
        nombre: formCp.nombre,
        descripcion: formCp.descripcion,
        pos_x: posClick.x,
        pos_y: posClick.y,
      }])
      setShowFormCheckpoint(false)
      return
    }

    setGuardandoCp(true)
    try {
      const { data } = await api.post('/checkpoints/', {
        instalacion: seleccionada.id,
        nombre: formCp.nombre,
        descripcion: formCp.descripcion,
        pos_x: posClick.x,
        pos_y: posClick.y,
      })
      setCheckpoints((prev) => [...prev, data])
      setShowFormCheckpoint(false)
    } finally {
      setGuardandoCp(false)
    }
  }

  const moverCheckpoint = async (cpId, x, y) => {
    if (esDraft) {
      setDraftCps((prev) => prev.map((cp) => cp._tmpId === cpId ? { ...cp, pos_x: x, pos_y: y } : cp))
      return
    }
    await api.patch(`/checkpoints/${cpId}/`, { pos_x: x, pos_y: y })
    setCheckpoints((prev) => prev.map((cp) => cp.id === cpId ? { ...cp, pos_x: x, pos_y: y } : cp))
  }

  const eliminarCheckpoint = async (cpId) => {
    if (!confirm('¿Eliminar este checkpoint?')) return
    if (esDraft) {
      setDraftCps((prev) => prev.filter((cp) => cp._tmpId !== cpId))
      return
    }
    await api.delete(`/checkpoints/${cpId}/`)
    setCheckpoints((prev) => prev.filter((cp) => cp.id !== cpId))
  }

  const actualizarImagen = async (e) => {
    const file = e.target.files[0]
    if (!file || !seleccionada) return
    const fd = new FormData()
    fd.append('imagen_satelital', file)
    const { data } = await api.patch(`/instalaciones/${seleccionada.id}/`, fd)
    setSeleccionada(data)
    setInstalaciones((prev) => prev.map((i) => i.id === data.id ? data : i))
  }

  const handleImgPosChange = (pos) => {
    setImgPos(pos)
    if (seleccionada) localStorage.setItem(`imgPos_${seleccionada.id}`, JSON.stringify(pos))
  }

  const resetImgPos = () => {
    setImgPos({ x: 50, y: 50 })
    if (seleccionada) localStorage.removeItem(`imgPos_${seleccionada.id}`)
  }

  // Datos que se muestran en el mapa (draft o instalación guardada)
  const imagenActual = esDraft ? draft.preview : seleccionada?.imagen_satelital
  const checkpointsActuales = esDraft
    ? draftCps.map((cp) => ({ ...cp, id: cp._tmpId }))
    : checkpoints
  const nombreActual = esDraft ? draft.nombre : seleccionada?.nombre

  const mostrarMapa = esDraft || seleccionada

  return (
    <div className="flex h-full">
      {/* Sidebar — oculto en móvil cuando hay mapa activo */}
      <div className={`${mostrarMapa ? 'hidden md:flex' : 'flex'} w-full md:w-64 bg-dark-400 border-r border-white/5 flex-col md:shrink-0`}>
        <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">Instalaciones</h2>
          {!esDraft && (
            <button onClick={abrirNuevaInstalacion} className="text-accent text-xl leading-none hover:text-accent-hover">+</button>
          )}
        </div>
        <div className="flex-1 overflow-auto py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : instalaciones.map((inst) => (
            <button
              key={inst.id}
              onClick={() => seleccionar(inst)}
              className={`w-full text-left px-4 py-3 transition-colors ${
                seleccionada?.id === inst.id && !esDraft
                  ? 'bg-accent/10 border-r-2 border-accent text-accent'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <p className="font-medium text-sm truncate">{inst.nombre}</p>
              <p className="text-xs opacity-60">{inst.checkpoints_count} checkpoints</p>
            </button>
          ))}
        </div>
      </div>

      {/* Área principal — oculta en móvil cuando no hay mapa */}
      <div className={`${!mostrarMapa ? 'hidden md:flex' : 'flex'} flex-1 flex-col overflow-hidden`}>
        {!mostrarMapa ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-4">
            <p className="text-5xl">🗺</p>
            <p>Seleccioná una instalación o creá una nueva</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-white/5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                {/* Botón volver — solo móvil */}
                <button
                  onClick={() => esDraft ? cancelarDraft() : setSeleccionada(null)}
                  className="md:hidden text-accent text-sm shrink-0"
                >
                  ← Lista
                </button>
                <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-white truncate">{nombreActual}</h1>
                  {esDraft && (
                    <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full shrink-0">Sin guardar</span>
                  )}
                </div>
                <p className="text-white/40 text-xs md:text-sm">
                  {adjustMode
                    ? 'Arrastrá para mover la imagen'
                    : `${checkpointsActuales.length} checkpoint${checkpointsActuales.length !== 1 ? 's' : ''} · tocá el mapa para agregar`}
                </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {esDraft ? (
                  <>
                    <button onClick={cancelarDraft} className="btn-ghost text-sm">Cancelar</button>
                    <button onClick={guardarInstalacion} disabled={guardando} className="btn-primary text-sm">
                      {guardando ? 'Guardando...' : '💾 Guardar instalación'}
                    </button>
                  </>
                ) : (
                  <>
                    {seleccionada?.imagen_satelital && !adjustMode && (
                      <button onClick={() => setAdjustMode(true)} className="btn-ghost text-sm">🖼 Ajustar imagen</button>
                    )}
                    {adjustMode && (
                      <>
                        <button onClick={resetImgPos} className="btn-ghost text-sm">↩ Restablecer</button>
                        <button onClick={() => setAdjustMode(false)} className="btn-primary text-sm px-4 py-2">✓ Listo</button>
                      </>
                    )}
                    {!adjustMode && (
                      <label className="btn-ghost text-sm cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={actualizarImagen} />
                        📷 Cambiar imagen
                      </label>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Mapa */}
            <div className="flex-1 overflow-hidden p-3 md:p-6">
              <MapaCheckpoints
                imagenUrl={imagenActual}
                checkpoints={checkpointsActuales}
                ejecucionActiva={esDraft ? null : ejecucionActiva}
                onMapClick={handleMapClick}
                onMove={moverCheckpoint}
                onDelete={eliminarCheckpoint}
                adjustMode={adjustMode}
                imgPos={imgPos}
                onImgPosChange={handleImgPosChange}
              />
            </div>
          </>
        )}
      </div>

      {/* Modal paso 1: nombre + imagen */}
      {showPaso1 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-dark-200 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h3 className="font-bold text-white mb-1">Nueva Instalación</h3>
            <p className="text-white/40 text-sm mb-4">Después podrás agregar checkpoints en el mapa</p>
            <div className="space-y-3">
              <div>
                <input
                  className={`input-field ${errorInst ? 'border-danger' : ''}`}
                  placeholder="Nombre *"
                  autoFocus
                  value={formInst.nombre}
                  onChange={(e) => { setFormInst({ ...formInst, nombre: e.target.value }); setErrorInst('') }}
                  onKeyDown={(e) => e.key === 'Enter' && continuarAlMapa()}
                />
                {errorInst && <p className="text-danger text-xs mt-1">{errorInst}</p>}
              </div>
              <textarea
                className="input-field h-20 resize-none"
                placeholder="Descripción (opcional)"
                value={formInst.descripcion}
                onChange={(e) => setFormInst({ ...formInst, descripcion: e.target.value })}
              />
              <label className="block">
                <span className="text-white/50 text-sm block mb-1">Imagen del mapa</span>
                <input type="file" accept="image/*" className="text-white/50 text-sm" onChange={(e) => setImagenFile(e.target.files[0])} />
                {imagenFile && <p className="text-accent text-xs mt-1">✓ {imagenFile.name}</p>}
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPaso1(false)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={continuarAlMapa} className="btn-primary flex-1">Continuar al mapa →</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo checkpoint */}
      {showFormCheckpoint && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-dark-200 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h3 className="font-bold text-white mb-1">Nuevo Checkpoint</h3>
            <p className="text-white/40 text-sm mb-4">Posición: {posClick?.x.toFixed(1)}%, {posClick?.y.toFixed(1)}%</p>
            <div className="space-y-3">
              <div>
                <input
                  className={`input-field ${errorCp ? 'border-danger' : ''}`}
                  placeholder="Nombre del sector *"
                  value={formCp.nombre}
                  onChange={(e) => { setFormCp({ ...formCp, nombre: e.target.value }); setErrorCp('') }}
                  autoFocus
                />
                {errorCp && <p className="text-danger text-xs mt-1">{errorCp}</p>}
              </div>
              <textarea
                className="input-field h-20 resize-none"
                placeholder="Descripción (opcional)"
                value={formCp.descripcion}
                onChange={(e) => setFormCp({ ...formCp, descripcion: e.target.value })}
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowFormCheckpoint(false)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={agregarCheckpoint} disabled={guardandoCp} className="btn-primary flex-1">
                {guardandoCp ? 'Agregando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
