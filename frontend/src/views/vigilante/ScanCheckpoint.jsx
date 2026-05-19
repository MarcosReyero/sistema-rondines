import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { guardarScanOffline } from '../../lib/db'

const TIPOS = [
  { key: 'observacion', label: 'Observación', desc: 'Todo normal', color: 'accent', icon: '✓' },
  { key: 'incidencia', label: 'Incidencia', desc: 'Algo a reportar', color: 'warning', icon: '⚠' },
  { key: 'alarma', label: 'Alarma', desc: 'Emergencia', color: 'danger', icon: '!' },
]

export default function ScanCheckpoint() {
  const { uuid } = useParams()
  const navigate = useNavigate()
  const [checkpoint, setCheckpoint] = useState(null)
  const [ejecucionActiva, setEjecucionActiva] = useState(null)
  const [tipo, setTipo] = useState('observacion')
  const [nota, setNota] = useState('')
  const [fase, setFase] = useState('cargando') // cargando | seleccion | enviando | ok | error
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    const init = async () => {
      try {
        const { data: cp } = await api.get(`/checkpoints/uuid/${uuid}/`)
        setCheckpoint(cp)

        // Buscar ejecución en curso del vigilante
        const { data: ejecs } = await api.get('/ejecuciones/?estado=en_curso')
        const lista = ejecs.results || ejecs
        const activa = lista.find((e) =>
          e.ronda === cp.instalacion || true // se mostrará si hay cualquier ejecución activa
        )
        setEjecucionActiva(activa || null)
        setFase('seleccion')
      } catch {
        setFase('error')
        setMensaje('Checkpoint no encontrado o sin ejecución activa')
      }
    }
    init()
  }, [uuid])

  const enviar = async () => {
    if (!ejecucionActiva) {
      setFase('error')
      setMensaje('No hay una ronda en curso. Iniciá una ronda primero.')
      return
    }
    setFase('enviando')
    const timestamp = new Date().toISOString()

    const payload = {
      checkpoint: checkpoint.id,
      tipo,
      nota,
      timestamp,
    }

    if (!navigator.onLine) {
      await guardarScanOffline({
        checkpoint_uuid: uuid,
        ejecucion_id: ejecucionActiva.id,
        timestamp,
        tipo,
        nota,
      })
      setFase('ok')
      setMensaje(`✓ Guardado offline — ${checkpoint.nombre}`)
      return
    }

    try {
      await api.post(`/ejecuciones/${ejecucionActiva.id}/scan/`, payload)
      setFase('ok')
      setMensaje(`✓ ${checkpoint.nombre} registrado`)
    } catch (err) {
      const error = err.response?.data?.error || ''
      if (err.response?.status === 409) {
        setFase('ok')
        setMensaje('Ya escaneaste este checkpoint en esta ronda')
        return
      }
      if (!navigator.onLine) {
        await guardarScanOffline({ checkpoint_uuid: uuid, ejecucion_id: ejecucionActiva.id, timestamp, tipo, nota })
        setFase('ok')
        setMensaje('Guardado offline')
      } else {
        setFase('error')
        setMensaje(error || 'Error al registrar scan')
      }
    }
  }

  if (fase === 'cargando') return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (fase === 'ok') return (
    <div className="min-h-screen bg-dark-300 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-24 h-24 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center mb-6">
        <span className="text-4xl text-accent">✓</span>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{mensaje}</h2>
      <p className="text-white/50 text-sm mb-8">{new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
      <button onClick={() => navigate(-1)} className="btn-ghost">
        ← Volver a la ronda
      </button>
    </div>
  )

  if (fase === 'error') return (
    <div className="min-h-screen bg-dark-300 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-24 h-24 rounded-full bg-danger/20 border-2 border-danger flex items-center justify-center mb-6">
        <span className="text-4xl text-danger">✗</span>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{mensaje}</h2>
      <button onClick={() => navigate('/rondas')} className="btn-ghost mt-6">Ir a mis rondas</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-dark-300 flex flex-col">
      {/* Header */}
      <div className="bg-dark-400 px-4 py-4 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="text-accent text-sm mb-1">← Volver</button>
        <h1 className="font-bold text-white text-lg">{checkpoint?.nombre}</h1>
        {!ejecucionActiva && (
          <p className="text-warning text-xs mt-0.5">⚠ Sin ronda activa — el scan se guardará igual</p>
        )}
      </div>

      <div className="flex-1 px-4 py-6 flex flex-col gap-4">
        {/* Selector de tipo */}
        <h2 className="text-white/60 text-sm uppercase tracking-wider">¿Qué registrás?</h2>
        <div className="space-y-3">
          {TIPOS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTipo(t.key)}
              className={`w-full flex items-center gap-4 rounded-2xl px-4 py-4 border-2 transition-all duration-200 text-left
                ${tipo === t.key
                  ? t.key === 'alarma' ? 'border-danger bg-danger/10' :
                    t.key === 'incidencia' ? 'border-warning bg-warning/10' :
                    'border-accent bg-accent/10'
                  : 'border-white/10 bg-dark-200'}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold shrink-0
                ${t.key === 'alarma' ? 'bg-danger/20 text-danger' :
                  t.key === 'incidencia' ? 'bg-warning/20 text-warning' :
                  'bg-accent/20 text-accent'}`}>
                {t.icon}
              </div>
              <div>
                <p className="font-semibold text-white">{t.label}</p>
                <p className="text-white/50 text-sm">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Nota (requerida para incidencia/alarma) */}
        {(tipo === 'incidencia' || tipo === 'alarma') && (
          <div>
            <label className="block text-sm text-white/60 mb-1.5">
              Descripción {tipo === 'alarma' ? '(urgente)' : ''}
            </label>
            <textarea
              className="input-field h-28 resize-none"
              placeholder={tipo === 'alarma' ? 'Describí la emergencia...' : 'Describí la incidencia...'}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Botón confirmar */}
      <div className="px-4 pb-8">
        <button
          onClick={enviar}
          disabled={fase === 'enviando'}
          className={`w-full py-5 rounded-2xl font-bold text-lg transition-all duration-200 active:scale-95 disabled:opacity-50
            ${tipo === 'alarma' ? 'bg-danger text-white hover:bg-danger-hover' :
              tipo === 'incidencia' ? 'bg-warning text-dark-500 hover:bg-warning-hover' :
              'bg-accent text-dark-500 hover:bg-accent-hover'}`}
        >
          {fase === 'enviando' ? 'Registrando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}
