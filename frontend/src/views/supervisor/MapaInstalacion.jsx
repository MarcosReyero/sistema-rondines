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
  const [showFormInstalacion, setShowFormInstalacion] = useState(false)
  const [showFormCheckpoint, setShowFormCheckpoint] = useState(false)
  const [posClick, setPosClick] = useState(null)
  const [formCp, setFormCp] = useState({ nombre: '', descripcion: '' })
  const [formInst, setFormInst] = useState({ nombre: '', descripcion: '' })
  const [imagenFile, setImagenFile] = useState(null)
  const [guardando, setGuardando] = useState(false)

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
    setSeleccionada(inst)
    navigate(`/supervisor/instalaciones/${inst.id}`, { replace: true })
    const { data } = await api.get(`/instalaciones/${inst.id}/checkpoints/`)
    setCheckpoints(data.results || data)

    // Buscar ejecución activa para esta instalación
    const { data: ejec } = await api.get(`/ejecuciones/?estado=en_curso&instalacion=${inst.id}`)
    const lista = ejec.results || ejec
    setEjecucionActiva(lista[0] || null)
  }

  const handleMapClick = (x, y) => {
    setPosClick({ x, y })
    setFormCp({ nombre: '', descripcion: '' })
    setShowFormCheckpoint(true)
  }

  const crearCheckpoint = async () => {
    if (!formCp.nombre.trim()) return
    setGuardando(true)
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
      setGuardando(false)
    }
  }

  const moverCheckpoint = async (cpId, x, y) => {
    await api.patch(`/checkpoints/${cpId}/`, { pos_x: x, pos_y: y })
    setCheckpoints((prev) => prev.map((cp) => cp.id === cpId ? { ...cp, pos_x: x, pos_y: y } : cp))
  }

  const eliminarCheckpoint = async (cpId) => {
    if (!confirm('¿Eliminar este checkpoint?')) return
    await api.delete(`/checkpoints/${cpId}/`)
    setCheckpoints((prev) => prev.filter((cp) => cp.id !== cpId))
  }

  const crearInstalacion = async () => {
    if (!formInst.nombre.trim()) return
    setGuardando(true)
    try {
      const fd = new FormData()
      fd.append('nombre', formInst.nombre)
      fd.append('descripcion', formInst.descripcion)
      if (imagenFile) fd.append('imagen_satelital', imagenFile)
      const { data } = await api.post('/instalaciones/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setInstalaciones((prev) => [...prev, data])
      setShowFormInstalacion(false)
      seleccionar(data)
    } finally {
      setGuardando(false)
    }
  }

  const actualizarImagen = async (e) => {
    const file = e.target.files[0]
    if (!file || !seleccionada) return
    const fd = new FormData()
    fd.append('imagen_satelital', file)
    const { data } = await api.patch(`/instalaciones/${seleccionada.id}/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    setSeleccionada(data)
    setInstalaciones((prev) => prev.map((i) => i.id === data.id ? data : i))
  }

  return (
    <div className="flex h-full">
      {/* Sidebar instalaciones */}
      <div className="w-64 bg-dark-400 border-r border-white/5 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">Instalaciones</h2>
          <button onClick={() => setShowFormInstalacion(true)} className="text-accent text-xl leading-none hover:text-accent-hover">+</button>
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
                seleccionada?.id === inst.id
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

      {/* Mapa */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!seleccionada ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-4">
            <p className="text-5xl">🗺</p>
            <p>Seleccioná una instalación</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h1 className="font-bold text-white">{seleccionada.nombre}</h1>
                <p className="text-white/40 text-sm">{checkpoints.length} checkpoints · hacé click en el mapa para agregar</p>
              </div>
              <label className="btn-ghost text-sm cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={actualizarImagen} />
                📷 Cambiar imagen
              </label>
            </div>
            <div className="flex-1 overflow-hidden p-6">
              <MapaCheckpoints
                imagenUrl={seleccionada.imagen_satelital}
                checkpoints={checkpoints}
                ejecucionActiva={ejecucionActiva}
                onMapClick={handleMapClick}
                onMove={moverCheckpoint}
                onDelete={eliminarCheckpoint}
              />
            </div>
          </>
        )}
      </div>

      {/* Modal nueva instalación */}
      {showFormInstalacion && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-dark-200 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h3 className="font-bold text-white mb-4">Nueva Instalación</h3>
            <div className="space-y-3">
              <input className="input-field" placeholder="Nombre" value={formInst.nombre} onChange={(e) => setFormInst({ ...formInst, nombre: e.target.value })} />
              <textarea className="input-field h-20 resize-none" placeholder="Descripción (opcional)" value={formInst.descripcion} onChange={(e) => setFormInst({ ...formInst, descripcion: e.target.value })} />
              <label className="block">
                <span className="text-white/50 text-sm block mb-1">Imagen satelital</span>
                <input type="file" accept="image/*" className="text-white/50 text-sm" onChange={(e) => setImagenFile(e.target.files[0])} />
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowFormInstalacion(false)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={crearInstalacion} disabled={guardando} className="btn-primary flex-1">
                {guardando ? 'Guardando...' : 'Crear'}
              </button>
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
              <input className="input-field" placeholder="Nombre del sector" value={formCp.nombre} onChange={(e) => setFormCp({ ...formCp, nombre: e.target.value })} autoFocus />
              <textarea className="input-field h-20 resize-none" placeholder="Descripción (opcional)" value={formCp.descripcion} onChange={(e) => setFormCp({ ...formCp, descripcion: e.target.value })} />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowFormCheckpoint(false)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={crearCheckpoint} disabled={guardando} className="btn-primary flex-1">
                {guardando ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
