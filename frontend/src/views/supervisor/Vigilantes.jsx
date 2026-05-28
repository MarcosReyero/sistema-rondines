import React, { useEffect, useState } from 'react'
import api from '../../lib/api'

export default function Vigilantes() {
  const [vigilantes, setVigilantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', first_name: '', last_name: '', email: '', password: '', rol: 'vigilante' })
  const [guardando, setGuardando] = useState(false)
  const [ejecucionesActivas, setEjecucionesActivas] = useState([])

  useEffect(() => {
    cargar()
    api.get('/ejecuciones/?estado=en_curso').then(({ data }) => {
      setEjecucionesActivas(data.results || data)
    })
  }, [])

  const cargar = () => {
    setLoading(true)
    api.get('/vigilantes/').then(({ data }) => {
      setVigilantes(data.results || data)
    }).finally(() => setLoading(false))
  }

  const crear = async () => {
    setGuardando(true)
    try {
      const { data } = await api.post('/vigilantes/crear/', form)
      setVigilantes((prev) => [...prev, data])
      setShowForm(false)
      setForm({ username: '', first_name: '', last_name: '', email: '', password: '', rol: 'vigilante' })
    } catch (err) {
      alert(JSON.stringify(err.response?.data))
    } finally {
      setGuardando(false)
    }
  }

  const toggle = async (v) => {
    const { data } = await api.patch(`/vigilantes/${v.id}/toggle/`)
    setVigilantes((prev) => prev.map((u) => u.id === data.id ? data : u))
  }

  const ejecucionDeVigilante = (userId) =>
    ejecucionesActivas.find((e) => e.vigilante === userId)

  return (
    <div className="p-4 md:p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Vigilantes</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ Nuevo</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {vigilantes.map((v) => {
            const activo = ejecucionDeVigilante(v.id)
            return (
              <div key={v.id} className="card flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                    ${v.is_active ? 'bg-accent/20 text-accent' : 'bg-white/5 text-white/30'}`}>
                    {(v.first_name?.[0] || v.username[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">
                      {v.first_name} {v.last_name} <span className="text-white/40 text-sm">@{v.username}</span>
                    </p>
                    {activo ? (
                      <p className="text-accent text-xs">🔄 En ronda: {activo.ronda_nombre}</p>
                    ) : (
                      <p className="text-white/30 text-xs">{v.is_active ? 'Sin actividad' : 'Desactivado'}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {v.perfil?.rol === 'supervisor' && (
                    <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded">supervisor</span>
                  )}
                  <button
                    onClick={() => toggle(v)}
                    className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                      v.is_active
                        ? 'text-danger/60 hover:text-danger hover:bg-danger/10'
                        : 'text-accent/60 hover:text-accent hover:bg-accent/10'
                    }`}
                  >
                    {v.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            )
          })}
          {vigilantes.length === 0 && (
            <div className="text-center py-16 text-white/30">No hay vigilantes</div>
          )}
        </div>
      )}

      {/* Modal crear */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-dark-200 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h3 className="font-bold text-white mb-4">Nuevo Usuario</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="input-field" placeholder="Nombre" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                <input className="input-field" placeholder="Apellido" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
              <input className="input-field" placeholder="Usuario" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <input className="input-field" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="input-field" placeholder="Contraseña" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <select className="input-field" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                <option value="vigilante">Vigilante</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={crear} disabled={guardando} className="btn-primary flex-1">
                {guardando ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
