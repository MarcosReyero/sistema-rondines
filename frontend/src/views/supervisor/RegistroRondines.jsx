import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function RegistroRondines() {
  const [ejecuciones, setEjecuciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState(null)
  const [filtros, setFiltros] = useState({ estado: '', fecha_desde: '', fecha_hasta: '', vigilante: '' })
  const [vigilantes, setVigilantes] = useState([])
  const [exportando, setExportando] = useState(false)

  const cargar = () => {
    setLoading(true)
    const params = new URLSearchParams()
    Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v) })
    api.get(`/ejecuciones/?${params}`).then(({ data }) => {
      setEjecuciones(data.results || data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
    api.get('/vigilantes/').then(({ data }) => setVigilantes(data.results || data))
  }, [])

  const verDetalle = async (id) => {
    const { data } = await api.get(`/ejecuciones/${id}/`)
    setDetalle(data)
  }

  const exportarExcel = async () => {
    setExportando(true)
    try {
      const response = await api.get('/exportar/excel/', { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rondines.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportando(false)
    }
  }

  const colorEstado = { completada: 'text-accent', en_curso: 'text-blue-400', incompleta: 'text-warning' }

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Registro de Rondines</h1>
        <button onClick={exportarExcel} disabled={exportando} className="btn-ghost text-sm">
          {exportando ? 'Exportando...' : '↓ Excel'}
        </button>
      </div>

      {/* Filtros */}
      <div className="card mb-5 grid grid-cols-2 xl:grid-cols-4 gap-3">
        <select className="input-field text-sm py-2" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
          <option value="">Todos los estados</option>
          <option value="en_curso">En curso</option>
          <option value="completada">Completada</option>
          <option value="incompleta">Incompleta</option>
        </select>
        <select className="input-field text-sm py-2" value={filtros.vigilante} onChange={(e) => setFiltros({ ...filtros, vigilante: e.target.value })}>
          <option value="">Todos los vigilantes</option>
          {vigilantes.map((v) => <option key={v.id} value={v.id}>{v.first_name} {v.last_name || v.username}</option>)}
        </select>
        <input type="date" className="input-field text-sm py-2" value={filtros.fecha_desde} onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })} />
        <input type="date" className="input-field text-sm py-2" value={filtros.fecha_hasta} onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })} />
        <div className="col-span-full">
          <button onClick={cargar} className="btn-primary text-sm py-2 px-6">Filtrar</button>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-auto rounded-2xl border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-dark-400">
              <tr>
                {['Ronda', 'Instalación', 'Vigilante', 'Inicio', 'Fin', 'Estado', 'Progreso', ''].map((h) => (
                  <th key={h} className="text-left text-white/40 font-medium px-4 py-3 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ejecuciones.map((e) => (
                <tr key={e.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{e.ronda_nombre}</td>
                  <td className="px-4 py-3 text-white/60">{e.instalacion_nombre}</td>
                  <td className="px-4 py-3 text-white/60">{e.vigilante_nombre}</td>
                  <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                    {format(new Date(e.fecha_inicio), 'dd/MM/yy HH:mm', { locale: es })}
                  </td>
                  <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                    {e.fecha_fin ? format(new Date(e.fecha_fin), 'dd/MM/yy HH:mm', { locale: es }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge-${e.estado}`}>{e.estado.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-dark-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: e.progreso.total ? `${(e.progreso.completados / e.progreso.total) * 100}%` : '0%' }}
                        />
                      </div>
                      <span className="text-white/40 text-xs">{e.progreso.completados}/{e.progreso.total}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => verDetalle(e.id)} className="text-accent hover:underline text-xs">Ver</button>
                  </td>
                </tr>
              ))}
              {ejecuciones.length === 0 && (
                <tr><td colSpan={8} className="text-center text-white/30 py-12">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setDetalle(null)}>
          <div className="bg-dark-200 rounded-2xl p-6 w-full max-w-lg border border-white/10 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-white text-lg">{detalle.ronda_nombre}</h3>
                <p className="text-white/40 text-sm">{detalle.vigilante_nombre} · {detalle.instalacion_nombre}</p>
              </div>
              <span className={`badge-${detalle.estado}`}>{detalle.estado.replace('_', ' ')}</span>
            </div>
            <div className="space-y-2">
              {(detalle.scans || []).map((scan, i) => (
                <div key={scan.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0
                    ${scan.tipo === 'alarma' ? 'bg-danger/20 text-danger' :
                      scan.tipo === 'incidencia' ? 'bg-warning/20 text-warning' :
                      'bg-accent/20 text-accent'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{scan.checkpoint_nombre}</p>
                    {scan.nota && <p className="text-white/40 text-xs mt-0.5">{scan.nota}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`badge-${scan.tipo}`}>{scan.tipo}</span>
                    <p className="text-white/30 text-xs mt-0.5">
                      {format(new Date(scan.timestamp), 'HH:mm', { locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setDetalle(null)} className="btn-ghost w-full mt-4 text-sm">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
