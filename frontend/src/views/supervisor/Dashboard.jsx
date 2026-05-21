import React, { useEffect, useState, useCallback, useRef } from 'react'
import api from '../../lib/api'
import { useWebSocket } from '../../hooks/useWebSocket'
import MapaCheckpoints from '../../components/MapaCheckpoints'

const TIPO_COLOR = {
  observacion: 'text-accent bg-accent/15',
  incidencia:  'text-warning bg-warning/15',
  alarma:      'text-danger bg-danger/15',
}
const TIPO_ICON = { observacion: '✓', incidencia: '⚠', alarma: '!' }

export default function Dashboard() {
  const [instalaciones, setInstalaciones] = useState([])
  const [instSel, setInstSel] = useState(null)
  const [checkpoints, setCheckpoints] = useState([])
  const [ejecuciones, setEjecuciones] = useState([])   // todas las activas
  const [ejecVista, setEjecVista] = useState(null)      // la que se muestra en el mapa
  const [lastScanCpId, setLastScanCpId] = useState(null)
  const [loading, setLoading] = useState(true)
  const lastScanTimer = useRef(null)

  // ── Cargar ejecuciones activas ──────────────────────────────────────────────
  const cargarEjecuciones = useCallback(async () => {
    const { data } = await api.get('/ejecuciones/?estado=en_curso')
    const lista = data.results || data
    setEjecuciones(lista)
    return lista
  }, [])

  // ── Cargar checkpoints de una instalación ───────────────────────────────────
  const cargarCheckpoints = useCallback(async (instId) => {
    const { data } = await api.get(`/instalaciones/${instId}/checkpoints/`)
    setCheckpoints(data.results || data)
  }, [])

  // ── Refrescar los datos de una ejecución específica ─────────────────────────
  const refrescarEjecucion = useCallback(async (ejId) => {
    const { data } = await api.get(`/ejecuciones/${ejId}/`)
    setEjecVista(data)
    setEjecuciones((prev) => prev.map((e) => e.id === ejId ? { ...e, progreso: data.progreso } : e))
    // Marcar el último checkpoint escaneado para la animación
    if (data.scans?.length > 0) {
      const ultimo = [...data.scans].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
      setLastScanCpId(ultimo.checkpoint)
      clearTimeout(lastScanTimer.current)
      lastScanTimer.current = setTimeout(() => setLastScanCpId(null), 4000)
    }
  }, [])

  // ── Inicialización ──────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [{ data: insts }, ejecs] = await Promise.all([
          api.get('/instalaciones/'),
          cargarEjecuciones(),
        ])
        const listaInsts = insts.results || insts
        setInstalaciones(listaInsts)

        // Auto-seleccionar la primera instalación que tiene una ronda activa
        let instAuto = null
        let ejecAuto = null
        for (const ej of ejecs) {
          const inst = listaInsts.find((i) => i.nombre === ej.instalacion_nombre)
          if (inst) { instAuto = inst; ejecAuto = ej; break }
        }
        // Si no hay rondas activas, seleccionar la primera instalación
        if (!instAuto && listaInsts.length > 0) instAuto = listaInsts[0]

        if (instAuto) {
          setInstSel(instAuto)
          await cargarCheckpoints(instAuto.id)
          if (ejecAuto) {
            // Cargar detalle completo (con scans)
            const { data: detalle } = await api.get(`/ejecuciones/${ejecAuto.id}/`)
            setEjecVista(detalle)
          }
        }
      } finally {
        setLoading(false)
      }
    }
    init()
    return () => clearTimeout(lastScanTimer.current)
  }, [cargarEjecuciones, cargarCheckpoints])

  // ── Cambiar instalación seleccionada ────────────────────────────────────────
  const seleccionarInst = useCallback(async (inst) => {
    setInstSel(inst)
    setEjecVista(null)
    await cargarCheckpoints(inst.id)
    // Auto-seleccionar la primera ejecución activa de esta instalación
    const { data } = await api.get(`/ejecuciones/?estado=en_curso&instalacion=${inst.id}`)
    const lista = data.results || data
    if (lista.length > 0) {
      const { data: det } = await api.get(`/ejecuciones/${lista[0].id}/`)
      setEjecVista(det)
    }
  }, [cargarCheckpoints])

  // ── Cambiar ejecución en el mapa ────────────────────────────────────────────
  const seleccionarEjecucion = useCallback(async (ej) => {
    const { data } = await api.get(`/ejecuciones/${ej.id}/`)
    setEjecVista(data)
    setLastScanCpId(null)
    // Si la ejecución es de otra instalación, cambiar instalación también
    const inst = instalaciones.find((i) => i.nombre === ej.instalacion_nombre)
    if (inst && inst.id !== instSel?.id) {
      setInstSel(inst)
      await cargarCheckpoints(inst.id)
    }
  }, [instalaciones, instSel, cargarCheckpoints])

  // ── WebSocket tiempo real ───────────────────────────────────────────────────
  const wsConnected = useWebSocket(useCallback((msg) => {
    if (msg.type === 'checkpoint_escaneado') {
      const ejId = msg.data?.ejecucion_id ?? msg.ejecucion_id
      if (ejId) {
        if (ejecVista?.id === ejId) {
          refrescarEjecucion(ejId)
        } else {
          // Actualizar progreso en la lista lateral aunque no sea la ejecución vista
          cargarEjecuciones()
        }
      }
    }
    if (msg.type === 'ronda_iniciada') {
      cargarEjecuciones()
    }
    if (msg.type === 'ronda_finalizada') {
      const ejId = msg.data?.ejecucion_id ?? msg.ejecucion_id
      cargarEjecuciones()
      if (ejecVista?.id === ejId) setEjecVista(null)
    }
    if (msg.type === 'alerta') {
      cargarEjecuciones()
    }
  }, [ejecVista, refrescarEjecucion, cargarEjecuciones]))

  // ── Ejecuciones filtradas a la instalación seleccionada ─────────────────────
  const ejecucionesDeInst = ejecuciones.filter(
    (e) => !instSel || e.instalacion_nombre === instSel.nombre
  )

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-3 border-b border-white/5 bg-dark-400 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-white font-bold text-base">Monitoreo en tiempo real</h1>
          <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full
            ${wsConnected ? 'bg-accent/15 text-accent' : 'bg-white/5 text-white/30'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-accent animate-pulse' : 'bg-white/30'}`} />
            {wsConnected ? 'LIVE' : 'Reconectando...'}
          </span>
        </div>

        {/* Selector de instalaciones */}
        <div className="flex items-center gap-2 ml-4 overflow-x-auto">
          {instalaciones.map((inst) => {
            const tieneActiva = ejecuciones.some((e) => e.instalacion_nombre === inst.nombre)
            return (
              <button
                key={inst.id}
                onClick={() => seleccionarInst(inst)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${instSel?.id === inst.id
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                {tieneActiva && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
                )}
                {inst.nombre}
              </button>
            )
          })}
        </div>

        <div className="ml-auto text-white/30 text-xs">
          {ejecuciones.length > 0
            ? `${ejecuciones.length} ronda${ejecuciones.length !== 1 ? 's' : ''} activa${ejecuciones.length !== 1 ? 's' : ''}`
            : 'Sin rondas activas'}
        </div>
      </div>

      {/* ── Cuerpo: mapa + panel ───────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Mapa */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col gap-3">
          {/* Sub-header del mapa */}
          <div className="flex items-center justify-between gap-3 shrink-0">
            <div>
              <p className="text-white/30 text-xs uppercase tracking-wider">
                {instSel?.nombre ?? 'Sin instalación'}
              </p>
              {ejecVista ? (
                <p className="text-white text-sm font-semibold">
                  {ejecVista.ronda_nombre}
                  <span className="text-white/40 font-normal"> · {ejecVista.vigilante_nombre}</span>
                </p>
              ) : (
                <p className="text-white/40 text-sm">Sin ronda activa en esta instalación</p>
              )}
            </div>
            {ejecVista && (
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-accent font-bold text-lg leading-none">
                    {ejecVista.progreso?.completados ?? 0}
                    <span className="text-white/30 font-normal text-sm">/{ejecVista.progreso?.total ?? 0}</span>
                  </p>
                  <p className="text-white/30 text-xs">checkpoints</p>
                </div>
                {/* Progress bar */}
                <div className="w-24 h-2 bg-dark-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700"
                    style={{
                      width: ejecVista.progreso?.total
                        ? `${(ejecVista.progreso.completados / ejecVista.progreso.total) * 100}%`
                        : '0%'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mapa principal */}
          <div className="flex-1 overflow-hidden">
            <MapaCheckpoints
              imagenUrl={instSel?.imagen_satelital}
              checkpoints={checkpoints}
              ejecucionActiva={ejecVista}
              lastScanCpId={lastScanCpId}
              readOnly
            />
          </div>
        </div>

        {/* ── Panel lateral ──────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 border-l border-white/5 flex flex-col overflow-hidden bg-dark-400">

          {/* Rondas activas */}
          <div className="shrink-0 px-4 pt-4 pb-2">
            <p className="text-white/30 text-xs uppercase tracking-wider mb-3">
              Rondas activas
              {ejecuciones.length > 0 && (
                <span className="ml-2 bg-accent/20 text-accent px-1.5 py-0.5 rounded text-xs font-bold">
                  {ejecuciones.length}
                </span>
              )}
            </p>
            {ejecuciones.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-4xl mb-2">⏳</p>
                <p className="text-white/30 text-xs">Sin rondas en curso</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ejecuciones.map((ej) => {
                  const pct = ej.progreso?.total > 0
                    ? Math.round((ej.progreso.completados / ej.progreso.total) * 100)
                    : 0
                  const esVista = ejecVista?.id === ej.id
                  return (
                    <button
                      key={ej.id}
                      onClick={() => seleccionarEjecucion(ej)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-150 active:scale-[0.98]
                        ${esVista
                          ? 'bg-accent/10 border-accent/30'
                          : 'bg-dark-200 border-white/5 hover:border-white/15'}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className={`text-xs font-semibold truncate ${esVista ? 'text-accent' : 'text-white'}`}>
                          {ej.ronda_nombre}
                        </p>
                        <span className="text-white/40 text-xs shrink-0">
                          {pct}%
                        </span>
                      </div>
                      <p className="text-white/40 text-xs truncate mb-2">{ej.vigilante_nombre}</p>
                      <div className="h-1 bg-dark-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${esVista ? 'bg-accent' : 'bg-accent/50'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-white/5 mx-4" />

          {/* Feed de scans */}
          <div className="flex-1 overflow-auto px-4 pt-3 pb-4">
            <p className="text-white/30 text-xs uppercase tracking-wider mb-3">
              Scans — {ejecVista?.ronda_nombre ?? 'sin ronda'}
            </p>
            {!ejecVista || !ejecVista.scans?.length ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">📡</p>
                <p className="text-white/20 text-xs">
                  {ejecVista ? 'Esperando primer scan...' : 'Seleccioná una ronda'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...ejecVista.scans]
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .map((scan, i) => {
                    const isNewest = i === 0
                    return (
                      <div
                        key={scan.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-all
                          ${isNewest ? 'animate-fade-in bg-accent/5 border border-accent/20' : 'bg-dark-200'}`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
                          ${TIPO_COLOR[scan.tipo] ?? 'text-white/50 bg-white/10'}`}>
                          {TIPO_ICON[scan.tipo] ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-semibold truncate">{scan.checkpoint_nombre}</p>
                          {scan.nota && (
                            <p className="text-white/45 text-xs mt-0.5 line-clamp-2 leading-snug">{scan.nota}</p>
                          )}
                        </div>
                        <p className="text-white/30 text-xs shrink-0">
                          {new Date(scan.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
