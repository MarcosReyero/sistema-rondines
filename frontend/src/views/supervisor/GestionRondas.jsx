import React, { useEffect, useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '../../lib/api'

function SortableItem({ cp }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cp.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 bg-dark-100 rounded-xl px-3 py-2.5 ${isDragging ? 'opacity-50' : ''}`}
      {...attributes}
    >
      <span className="text-white/30 cursor-grab" {...listeners}>⠿</span>
      <span className="text-white text-sm flex-1">{cp.nombre}</span>
    </div>
  )
}

export default function GestionRondas() {
  const [rondas, setRondas] = useState([])
  const [instalaciones, setInstalaciones] = useState([])
  const [checkpointsPorInst, setCheckpointsPorInst] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', instalacion: '', activo: true })
  const [cpSeleccionados, setCpSeleccionados] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [loading, setLoading] = useState(true)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    Promise.all([
      api.get('/rondas/'),
      api.get('/instalaciones/'),
    ]).then(([r, i]) => {
      setRondas(r.data.results || r.data)
      setInstalaciones(i.data.results || i.data)
    }).finally(() => setLoading(false))
  }, [])

  const cargarCheckpoints = async (instId) => {
    if (!instId) { setCheckpointsPorInst([]); return }
    const { data } = await api.get(`/instalaciones/${instId}/checkpoints/`)
    setCheckpointsPorInst(data.results || data)
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre: '', descripcion: '', instalacion: '', activo: true })
    setCpSeleccionados([])
    setShowForm(true)
  }

  const abrirEditar = async (ronda) => {
    setEditando(ronda)
    setForm({ nombre: ronda.nombre, descripcion: ronda.descripcion, instalacion: ronda.instalacion, activo: ronda.activo })
    await cargarCheckpoints(ronda.instalacion)
    const orden = ronda.checkpoint_ordenes || []
    setCpSeleccionados(orden.map((o) => o.checkpoint))
    setShowForm(true)
  }

  const toggleCp = (cp) => {
    setCpSeleccionados((prev) => {
      const existe = prev.find((c) => c.id === cp.id)
      return existe ? prev.filter((c) => c.id !== cp.id) : [...prev, cp]
    })
  }

  const handleDragEnd = ({ active, over }) => {
    if (active.id !== over?.id) {
      setCpSeleccionados((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const guardar = async () => {
    setGuardando(true)
    const payload = {
      ...form,
      checkpoints_orden: cpSeleccionados.map((cp, i) => ({ checkpoint_id: cp.id, orden: i + 1 }))
    }
    try {
      if (editando) {
        const { data } = await api.put(`/rondas/${editando.id}/`, payload)
        setRondas((prev) => prev.map((r) => r.id === data.id ? data : r))
      } else {
        const { data } = await api.post('/rondas/', payload)
        setRondas((prev) => [...prev, data])
      }
      setShowForm(false)
    } finally {
      setGuardando(false)
    }
  }

  const desactivar = async (ronda) => {
    if (!confirm(`¿Desactivar "${ronda.nombre}"?`)) return
    await api.delete(`/rondas/${ronda.id}/`)
    setRondas((prev) => prev.filter((r) => r.id !== ronda.id))
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Gestión de Rondas</h1>
        <button onClick={abrirNuevo} className="btn-primary text-sm">+ Nueva Ronda</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {rondas.map((ronda) => (
            <div key={ronda.id} className="card flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-white">{ronda.nombre}</h3>
                  {!ronda.activo && <span className="badge-incompleta">inactiva</span>}
                </div>
                <p className="text-white/40 text-sm">{ronda.instalacion_nombre} · {ronda.checkpoints_count} checkpoints</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => abrirEditar(ronda)} className="text-sm text-white/40 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  Editar
                </button>
                <button onClick={() => desactivar(ronda)} className="text-sm text-danger/60 hover:text-danger px-3 py-1.5 rounded-lg hover:bg-danger/10 transition-colors">
                  Desactivar
                </button>
              </div>
            </div>
          ))}
          {rondas.length === 0 && (
            <div className="text-center py-16 text-white/30">No hay rondas creadas</div>
          )}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-dark-200 rounded-2xl p-6 w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-auto">
            <h3 className="font-bold text-white text-lg mb-5">{editando ? 'Editar Ronda' : 'Nueva Ronda'}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2">
                <label className="text-white/50 text-sm block mb-1">Nombre</label>
                <input className="input-field" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-white/50 text-sm block mb-1">Instalación</label>
                <select
                  className="input-field"
                  value={form.instalacion}
                  onChange={(e) => { setForm({ ...form, instalacion: e.target.value }); cargarCheckpoints(e.target.value) }}
                >
                  <option value="">Seleccioná...</option>
                  {instalaciones.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-white/50 text-sm block mb-1">Descripción</label>
                <textarea className="input-field h-16 resize-none" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </div>
            </div>

            {/* Selector checkpoints */}
            {form.instalacion && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/50 text-sm mb-2">Checkpoints disponibles</p>
                  <div className="space-y-1.5 max-h-48 overflow-auto">
                    {checkpointsPorInst.filter((cp) => !cpSeleccionados.find((c) => c.id === cp.id)).map((cp) => (
                      <button key={cp.id} onClick={() => toggleCp(cp)} className="w-full text-left px-3 py-2 rounded-xl text-sm text-white/60 hover:bg-accent/10 hover:text-accent transition-colors bg-dark-100">
                        + {cp.nombre}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-white/50 text-sm mb-2">Orden de recorrido (arrastrá)</p>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={cpSeleccionados.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1.5 max-h-48 overflow-auto">
                        {cpSeleccionados.map((cp) => (
                          <div key={cp.id} className="flex items-center gap-1">
                            <SortableItem cp={cp} />
                            <button onClick={() => toggleCp(cp)} className="text-white/30 hover:text-danger p-1">✕</button>
                          </div>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={guardar} disabled={guardando || !form.nombre || !form.instalacion} className="btn-primary flex-1 disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
