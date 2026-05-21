import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { guardarScanOffline } from '../../lib/db'

const TIPOS = [
  {
    key: 'observacion',
    label: 'Sin novedades',
    desc: 'Todo en orden',
    icon: '✓',
    bg: 'bg-accent/10',
    border: 'border-accent',
    iconBg: 'bg-accent/20 text-accent',
    btn: 'bg-accent text-dark-500',
    placeholder: 'Describí lo observado en el sector...',
  },
  {
    key: 'incidencia',
    label: 'Incidencia',
    desc: 'Algo a reportar',
    icon: '⚠',
    bg: 'bg-warning/10',
    border: 'border-warning',
    iconBg: 'bg-warning/20 text-warning',
    btn: 'bg-warning text-dark-500',
    placeholder: 'Describí la incidencia encontrada...',
  },
  {
    key: 'alarma',
    label: 'Alarma',
    desc: 'Emergencia',
    icon: '!',
    bg: 'bg-danger/10',
    border: 'border-danger',
    iconBg: 'bg-danger/20 text-danger',
    btn: 'bg-danger text-white',
    placeholder: 'Describí la emergencia con detalle...',
  },
]

export default function ScanCheckpoint() {
  const { uuid } = useParams()
  const navigate = useNavigate()
  const notaRef = useRef(null)

  const [checkpoint, setCheckpoint] = useState(null)
  const [ejecucionActiva, setEjecucionActiva] = useState(null)
  const [tipo, setTipo] = useState('observacion')
  const [nota, setNota] = useState('')
  const [notaError, setNotaError] = useState(false)
  const [fase, setFase] = useState('cargando')
  const [resultado, setResultado] = useState(null) // { ok, titulo, subtitulo, offline, yaEscaneado }

  useEffect(() => {
    const init = async () => {
      try {
        const { data: cp } = await api.get(`/checkpoints/uuid/${uuid}/`)
        setCheckpoint(cp)
        const { data: ejecs } = await api.get('/ejecuciones/?estado=en_curso')
        const lista = ejecs.results || ejecs
        setEjecucionActiva(lista[0] || null)
        setFase('seleccion')
      } catch {
        setFase('resultado')
        setResultado({
          ok: false,
          titulo: 'QR no reconocido',
          subtitulo: 'Este checkpoint no existe o fue desactivado.',
        })
      }
    }
    init()
  }, [uuid])

  const tipoActual = TIPOS.find((t) => t.key === tipo)

  const handleTipoChange = (key) => {
    setTipo(key)
    setNota('')
    setNotaError(false)
    setTimeout(() => notaRef.current?.focus(), 100)
  }

  const enviar = async () => {
    if (!nota.trim()) {
      setNotaError(true)
      notaRef.current?.focus()
      return
    }

    if (!ejecucionActiva) {
      setFase('resultado')
      setResultado({
        ok: false,
        titulo: 'Sin ronda activa',
        subtitulo: 'El supervisor debe asignarte una ronda antes de escanear.',
      })
      return
    }

    setFase('enviando')
    const timestamp = new Date().toISOString()
    const payload = { checkpoint: checkpoint.id, tipo, nota: nota.trim(), timestamp }

    if (!navigator.onLine) {
      await guardarScanOffline({
        checkpoint_uuid: uuid,
        ejecucion_id: ejecucionActiva.id,
        timestamp, tipo, nota: nota.trim(),
      })
      setFase('resultado')
      setResultado({
        ok: true,
        offline: true,
        titulo: checkpoint.nombre,
        subtitulo: 'Guardado sin conexión — se sincronizará al reconectar.',
        hora: new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      })
      return
    }

    try {
      await api.post(`/ejecuciones/${ejecucionActiva.id}/scan/`, payload)
      setFase('resultado')
      setResultado({
        ok: true,
        titulo: checkpoint.nombre,
        subtitulo: `${tipo === 'observacion' ? 'Sin novedades' : tipo === 'incidencia' ? 'Incidencia registrada' : 'Alarma registrada'}`,
        hora: new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        tipo,
      })
    } catch (err) {
      if (err.response?.status === 409) {
        setFase('resultado')
        setResultado({
          ok: null,
          titulo: 'Ya escaneado',
          subtitulo: `${checkpoint.nombre} ya fue registrado en esta ronda.`,
        })
        return
      }
      if (!navigator.onLine) {
        await guardarScanOffline({
          checkpoint_uuid: uuid,
          ejecucion_id: ejecucionActiva.id,
          timestamp, tipo, nota: nota.trim(),
        })
        setFase('resultado')
        setResultado({
          ok: true,
          offline: true,
          titulo: checkpoint.nombre,
          subtitulo: 'Guardado sin conexión — se sincronizará al reconectar.',
          hora: new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        })
      } else {
        setFase('resultado')
        setResultado({
          ok: false,
          titulo: 'Error al registrar',
          subtitulo: err.response?.data?.error || 'Intentá de nuevo.',
        })
      }
    }
  }

  // ── Pantalla de carga ────────────────────────────────────────────────────────
  if (fase === 'cargando') return (
    <div className="min-h-screen bg-dark-300 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-3 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-white/40 text-sm">Verificando checkpoint...</p>
    </div>
  )

  // ── Pantalla de resultado ────────────────────────────────────────────────────
  if (fase === 'resultado') {
    const r = resultado
    const esOk = r.ok === true
    const esError = r.ok === false
    const esNeutro = r.ok === null

    return (
      <div className="min-h-screen bg-dark-300 flex flex-col items-center justify-center px-6 text-center">
        {/* Ícono grande */}
        <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-6
          ${esOk ? (r.offline ? 'bg-warning/20 border-2 border-warning' : 'bg-accent/20 border-2 border-accent') :
            esNeutro ? 'bg-warning/20 border-2 border-warning' :
            'bg-danger/20 border-2 border-danger'}`}>
          <span className={`text-5xl
            ${esOk ? (r.offline ? 'text-warning' : 'text-accent') :
              esNeutro ? 'text-warning' : 'text-danger'}`}>
            {esOk ? (r.offline ? '⊘' : '✓') : esNeutro ? '⊙' : '✗'}
          </span>
        </div>

        {/* Tipo badge (solo en éxito) */}
        {esOk && !r.offline && r.tipo && (
          <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3
            ${r.tipo === 'alarma' ? 'bg-danger/20 text-danger' :
              r.tipo === 'incidencia' ? 'bg-warning/20 text-warning' :
              'bg-accent/20 text-accent'}`}>
            {r.tipo}
          </span>
        )}
        {r.offline && (
          <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 bg-warning/20 text-warning">
            Offline
          </span>
        )}

        <h2 className="text-2xl font-bold text-white mb-2">{r.titulo}</h2>
        <p className="text-white/50 text-sm mb-2">{r.subtitulo}</p>
        {r.hora && <p className="text-white/30 text-xs mb-8">{r.hora}</p>}
        {!r.hora && <div className="mb-8" />}

        <div className="w-full space-y-3">
          <button
            onClick={() => navigate(-1)}
            className="w-full py-4 rounded-2xl font-semibold bg-dark-100 border border-white/10 text-white/70 active:scale-95 transition-transform"
          >
            ← Volver a la ronda
          </button>
          {esError && (
            <button
              onClick={() => { setFase('seleccion'); setResultado(null) }}
              className="w-full py-4 rounded-2xl font-semibold bg-accent text-dark-500 active:scale-95 transition-transform"
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Formulario de scan ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-300 flex flex-col">
      {/* Header */}
      <div className="bg-dark-400 px-4 pt-safe-top pb-4 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="text-accent text-sm mb-2 flex items-center gap-1">
          <span>←</span> <span>Volver</span>
        </button>
        <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Checkpoint</p>
        <h1 className="font-bold text-white text-xl leading-tight">{checkpoint?.nombre}</h1>
        {!ejecucionActiva && (
          <div className="mt-2 flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-lg px-3 py-1.5">
            <span className="text-warning text-sm">⚠</span>
            <p className="text-warning text-xs">Sin ronda activa</p>
          </div>
        )}
      </div>

      <div className="flex-1 px-4 py-5 flex flex-col gap-5 overflow-auto">
        {/* Selector de tipo */}
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">¿Qué registrás?</p>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.key}
                onClick={() => handleTipoChange(t.key)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 border-2 transition-all duration-150 active:scale-95
                  ${tipo === t.key ? `${t.bg} ${t.border}` : 'border-white/10 bg-dark-200'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold
                  ${tipo === t.key ? t.iconBg : 'bg-white/5 text-white/30'}`}>
                  {t.icon}
                </div>
                <span className={`text-xs font-semibold leading-tight text-center ${tipo === t.key ? 'text-white' : 'text-white/40'}`}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Nota (siempre obligatoria) */}
        <div className="flex-1 flex flex-col">
          <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">
            Observación <span className="text-danger">*</span>
          </label>
          <textarea
            ref={notaRef}
            className={`input-field flex-1 min-h-[140px] resize-none text-base leading-relaxed transition-colors
              ${notaError ? 'border-danger focus:border-danger' : ''}`}
            placeholder={tipoActual.placeholder}
            value={nota}
            onChange={(e) => { setNota(e.target.value); if (e.target.value.trim()) setNotaError(false) }}
          />
          {notaError && (
            <p className="text-danger text-xs mt-1.5 flex items-center gap-1">
              <span>!</span> La observación es obligatoria
            </p>
          )}
        </div>
      </div>

      {/* Botón confirmar */}
      <div className="px-4 pb-safe-bottom pt-3 border-t border-white/5 bg-dark-300">
        <button
          onClick={enviar}
          disabled={fase === 'enviando'}
          className={`w-full py-5 rounded-2xl font-bold text-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-50
            ${tipoActual.btn}`}
        >
          {fase === 'enviando'
            ? <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                Registrando...
              </span>
            : tipo === 'alarma' ? '⚠ Confirmar Alarma'
            : tipo === 'incidencia' ? 'Reportar Incidencia'
            : 'Confirmar Escaneo'}
        </button>
      </div>
    </div>
  )
}
