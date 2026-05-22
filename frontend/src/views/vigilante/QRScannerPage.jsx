import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../../lib/api'
import { guardarScanOffline, getCheckpointCacheado, getEjecucionCacheada } from '../../lib/db'

const READER_ID = 'qr-page-reader'

const TIPOS = [
  { key: 'observacion', label: 'Sin novedades', icon: '✓', bg: 'bg-accent/10', border: 'border-accent', iconBg: 'bg-accent/20 text-accent', btn: 'bg-accent text-dark-500', placeholder: 'Describí lo observado en el sector...' },
  { key: 'incidencia',  label: 'Incidencia',    icon: '⚠', bg: 'bg-warning/10', border: 'border-warning', iconBg: 'bg-warning/20 text-warning', btn: 'bg-warning text-dark-500', placeholder: 'Describí la incidencia encontrada...' },
  { key: 'alarma',      label: 'Alarma',         icon: '!', bg: 'bg-danger/10',  border: 'border-danger',  iconBg: 'bg-danger/20 text-danger',   btn: 'bg-danger text-white',       placeholder: 'Describí la emergencia con detalle...' },
]

export default function QRScannerPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const ejecucionIdHint = location.state?.ejecucionId ?? null
  const [fase, setFase] = useState('iniciando') // iniciando | escaneando | errorCamara | cargando | form | enviando | resultado
  const [errorCamara, setErrorCamara] = useState('')
  const [checkpoint, setCheckpoint] = useState(null)
  const [ejecucionActiva, setEjecucionActiva] = useState(null)
  const [tipo, setTipo] = useState('observacion')
  const [nota, setNota] = useState('')
  const [notaError, setNotaError] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [uuidActual, setUuidActual] = useState(null)
  const [torchActivo, setTorchActivo] = useState(false)
  const qrRef = useRef(null)
  const detectadoRef = useRef(false)
  const notaRef = useRef(null)

  const toggleLinterna = async () => {
    try {
      const video = document.querySelector(`#${READER_ID} video`)
      if (!video?.srcObject) return
      const track = video.srcObject.getVideoTracks()[0]
      if (!track) return
      await track.applyConstraints({ advanced: [{ torch: !torchActivo }] })
      setTorchActivo((v) => !v)
    } catch (_) {}
  }

  const detenerCamara = () => {
    try {
      document.querySelectorAll(`#${READER_ID} video`).forEach(v => {
        if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null }
      })
    } catch (_) {}
    try { qrRef.current?.stop().catch(() => {}) } catch (_) {}
  }

  useEffect(() => {
    const qr = new Html5Qrcode(READER_ID, { verbose: false })
    qrRef.current = qr

    qr.start(
      { facingMode: 'environment' },
      {
        fps: 12,
        // responsive qrbox: up to 260px but never more than 75% of the smaller dimension
        qrbox: (w, h) => { const s = Math.min(w, h, 260); return { width: s, height: s } },
      },
      async (text) => {
        if (detectadoRef.current) return
        detectadoRef.current = true
        detenerCamara()

        const match = text.match(/\/check\/([a-f0-9-]{36})/i)
        const uuid = match ? match[1] : text.trim()
        setUuidActual(uuid)
        setFase('cargando')

        // When already offline, skip the network round-trip and go straight to cache
        if (!navigator.onLine) {
          const cpCached = getCheckpointCacheado(uuid)
          if (cpCached) {
            setCheckpoint(cpCached)
            setEjecucionActiva(getEjecucionCacheada())
            setFase('form')
          } else {
            setResultado({ ok: false, titulo: 'Sin conexión', subtitulo: 'Este checkpoint no está disponible offline. Abrí la ronda al menos una vez con conexión.' })
            setFase('resultado')
          }
          return
        }

        try {
          const [{ data: cp }, ejecucionData] = await Promise.all([
            api.get(`/checkpoints/uuid/${uuid}/`),
            ejecucionIdHint
              ? api.get(`/ejecuciones/${ejecucionIdHint}/`).then((r) => r.data)
              : api.get('/ejecuciones/?estado=en_curso').then((r) => (r.data.results || r.data)[0] || null),
          ])
          setCheckpoint(cp)
          const ej = ejecucionData?.estado !== undefined
            ? (ejecucionData.estado === 'en_curso' ? ejecucionData : null)
            : ejecucionData
          setEjecucionActiva(ej)
          setFase('form')
        } catch {
          // Network failed despite appearing online — try cache as fallback
          const cpCached = getCheckpointCacheado(uuid)
          if (cpCached) {
            setCheckpoint(cpCached)
            setEjecucionActiva(getEjecucionCacheada())
            setFase('form')
          } else {
            setResultado({ ok: false, titulo: 'QR no reconocido', subtitulo: 'Este checkpoint no existe o fue desactivado.' })
            setFase('resultado')
          }
        }
      },
      () => {}
    )
      .then(() => setFase('escaneando'))
      .catch((err) => {
        const msg = String(err)
        setErrorCamara(
          msg.includes('permission') || msg.includes('NotAllowed')
            ? 'Permiso de cámara denegado. Habilitalo en los ajustes del navegador.'
            : msg.includes('NotFound') || msg.includes('no camera')
            ? 'No se encontró cámara trasera en este dispositivo.'
            : 'No se pudo iniciar la cámara.'
        )
        setFase('errorCamara')
      })

    return () => { detenerCamara() }
  }, [])

  const tipoActual = TIPOS.find((t) => t.key === tipo)

  const handleTipoChange = (key) => {
    setTipo(key); setNota(''); setNotaError(false)
    setTimeout(() => notaRef.current?.focus(), 100)
  }

  const enviar = async () => {
    if (!nota.trim()) { setNotaError(true); notaRef.current?.focus(); return }
    if (!ejecucionActiva) {
      setResultado({ ok: false, titulo: 'Sin ronda activa', subtitulo: 'El supervisor te asignará una ronda.' })
      setFase('resultado'); return
    }

    setFase('enviando')
    const timestamp = new Date().toISOString()
    const payload = { checkpoint: checkpoint.id, tipo, nota: nota.trim(), timestamp }

    if (!navigator.onLine) {
      await guardarScanOffline({ checkpoint_uuid: uuidActual, ejecucion_id: ejecucionActiva.id, timestamp, tipo, nota: nota.trim() })
      setResultado({ ok: true, offline: true, titulo: checkpoint.nombre, subtitulo: 'Guardado sin conexión — se sincronizará al reconectar.', hora: new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) })
      setFase('resultado'); return
    }

    try {
      const { data: scanResp } = await api.post(`/ejecuciones/${ejecucionActiva.id}/scan/`, payload)
      setResultado({ ok: true, titulo: checkpoint.nombre, subtitulo: tipo === 'observacion' ? 'Sin novedades' : tipo === 'incidencia' ? 'Incidencia registrada' : 'Alarma registrada', hora: new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }), tipo, _scan: scanResp.scan, _progreso: scanResp.progreso, _ejecucionId: ejecucionActiva.id })
      setFase('resultado')
    } catch (err) {
      if (err.response?.status === 409) {
        setResultado({ ok: null, titulo: 'Ya escaneado', subtitulo: `${checkpoint.nombre} ya fue registrado en esta ronda.` })
        setFase('resultado'); return
      }
      if (!navigator.onLine) {
        await guardarScanOffline({ checkpoint_uuid: uuidActual, ejecucion_id: ejecucionActiva.id, timestamp, tipo, nota: nota.trim() })
        setResultado({ ok: true, offline: true, titulo: checkpoint.nombre, subtitulo: 'Guardado sin conexión — se sincronizará al reconectar.', hora: new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) })
      } else {
        setResultado({ ok: false, titulo: 'Error al registrar', subtitulo: err.response?.data?.error || 'Intentá de nuevo.' })
      }
      setFase('resultado')
    }
  }

  const enCamara = fase === 'iniciando' || fase === 'escaneando'

  return (
    <>
      {/* Supress html5-qrcode's built-in QR box overlay */}
      <style>{`
        #${READER_ID} { background: #000; }
        #${READER_ID} video { object-fit: cover !important; width: 100% !important; height: 100% !important; }
        #${READER_ID}__scan_region { width: 100% !important; height: 100% !important; }
        #qr-shaded-region { display: none !important; }
      `}</style>

      {/* ── Camera overlay — always in DOM so html5-qrcode keeps its element ── */}
      {/* display:none hides it without unmounting, preserving video state     */}
      <div
        className="fixed inset-0 flex flex-col bg-black"
        style={{ zIndex: 50, display: enCamara ? 'flex' : 'none' }}
      >
        {/* Header */}
        <div
          className="shrink-0 px-4 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
        >
          <div>
            <h2 className="font-bold text-white text-lg">Escanear checkpoint</h2>
            <p className="text-white/40 text-sm mt-0.5">
              {fase === 'iniciando' ? 'Iniciando cámara...' : 'Posicioná el QR dentro del cuadrado'}
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white text-lg active:scale-90 transition-transform"
          >
            ✕
          </button>
        </div>

        {/* Camera area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Spinner while camera initializes */}
          {fase === 'iniciando' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* html5-qrcode injects video here */}
          <div id={READER_ID} className="absolute inset-0" />

          {/* Custom viewfinder — corners + scan line */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <div
              className="relative"
              style={{ width: 'min(260px, 75vw)', height: 'min(260px, 75vw)' }}
            >
              <span className="absolute top-0 left-0 w-9 h-9 border-t-[3px] border-l-[3px] border-accent" />
              <span className="absolute top-0 right-0 w-9 h-9 border-t-[3px] border-r-[3px] border-accent" />
              <span className="absolute bottom-0 left-0 w-9 h-9 border-b-[3px] border-l-[3px] border-accent" />
              <span className="absolute bottom-0 right-0 w-9 h-9 border-b-[3px] border-r-[3px] border-accent" />
              {fase === 'escaneando' && (
                <div
                  className="absolute left-2 right-2 h-0.5 rounded-full animate-scan-line"
                  style={{
                    background: 'linear-gradient(to right, transparent, #00d4aa, transparent)',
                    boxShadow: '0 0 8px #00d4aa, 0 0 16px #00d4aa44',
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer instruction + torch */}
        {fase === 'escaneando' && (
          <div
            className="shrink-0 px-6 py-5 flex flex-col items-center gap-3"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
          >
            <p className="text-white/40 text-sm">Acercá el teléfono al código QR del checkpoint</p>
            <button
              onClick={toggleLinterna}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border active:scale-95 transition-all
                ${torchActivo
                  ? 'bg-yellow-400/15 text-yellow-300 border-yellow-400/40'
                  : 'bg-white/8 text-white/40 border-white/10'}`}
            >
              <span>🔦</span>
              <span>{torchActivo ? 'Linterna encendida' : 'Linterna'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Error de cámara ── */}
      {fase === 'errorCamara' && (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-danger/20 border-2 border-danger flex items-center justify-center text-4xl">📷</div>
          <p className="text-white font-semibold text-lg">Sin acceso a la cámara</p>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs">{errorCamara}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-2 w-full max-w-xs py-4 rounded-2xl bg-dark-100 border border-white/10 text-white/60 font-medium active:scale-95 transition-transform"
          >
            Volver
          </button>
        </div>
      )}

      {/* ── Cargando checkpoint tras detectar QR ── */}
      {fase === 'cargando' && (
        <div className="min-h-screen bg-dark-300 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Verificando checkpoint...</p>
        </div>
      )}

      {/* ── Formulario de observación ── */}
      {(fase === 'form' || fase === 'enviando') && (
        <div className="min-h-screen bg-dark-300 flex flex-col">
          {/* Header */}
          <div className="bg-dark-400 px-4 pt-safe-top pb-4 border-b border-white/5 shrink-0">
            <button onClick={() => navigate(-1)} className="text-accent text-sm mb-2 flex items-center gap-1">
              <span>←</span> <span>Volver</span>
            </button>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Checkpoint detectado</p>
            <h1 className="font-bold text-white text-xl leading-tight">{checkpoint?.nombre}</h1>
            {!ejecucionActiva && (
              <div className="mt-2 flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-lg px-3 py-1.5">
                <span className="text-warning text-sm">⚠</span>
                <p className="text-warning text-xs">Sin ronda activa — el supervisor debe asignarte una</p>
              </div>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-auto">
            {/* Tipo selector */}
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">¿Qué registrás?</p>
              <div className="grid grid-cols-3 gap-2">
                {TIPOS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => handleTipoChange(t.key)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl px-1.5 py-3 border-2 transition-all duration-150 active:scale-95
                      ${tipo === t.key ? `${t.bg} ${t.border}` : 'border-white/10 bg-dark-200'}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold
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

            {/* Nota */}
            <div className="flex-1 flex flex-col min-h-0">
              <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">
                Observación <span className="text-danger">*</span>
              </label>
              <textarea
                ref={notaRef}
                className={`input-field flex-1 min-h-[120px] resize-none text-base leading-relaxed transition-colors
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

          {/* Submit button */}
          <div className="px-4 pb-safe-bottom pt-3 border-t border-white/5 bg-dark-300 shrink-0">
            <button
              onClick={enviar}
              disabled={fase === 'enviando'}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-50 ${tipoActual.btn}`}
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
      )}

      {/* ── Resultado ── */}
      {fase === 'resultado' && resultado && (() => {
        const r = resultado
        const esOk = r.ok === true
        const esError = r.ok === false
        const esNeutro = r.ok === null
        return (
          <div className="min-h-screen bg-dark-300 flex flex-col items-center justify-center px-6 text-center">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-5
              ${esOk ? (r.offline ? 'bg-warning/20 border-2 border-warning' : 'bg-accent/20 border-2 border-accent')
                : esNeutro ? 'bg-warning/20 border-2 border-warning'
                : 'bg-danger/20 border-2 border-danger'}`}>
              <span className={`text-4xl
                ${esOk ? (r.offline ? 'text-warning' : 'text-accent') : esNeutro ? 'text-warning' : 'text-danger'}`}>
                {esOk ? (r.offline ? '⊘' : '✓') : esNeutro ? '⊙' : '✗'}
              </span>
            </div>

            {esOk && !r.offline && r.tipo && (
              <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3
                ${r.tipo === 'alarma' ? 'bg-danger/20 text-danger' : r.tipo === 'incidencia' ? 'bg-warning/20 text-warning' : 'bg-accent/20 text-accent'}`}>
                {r.tipo}
              </span>
            )}
            {r.offline && (
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 bg-warning/20 text-warning">
                Offline
              </span>
            )}

            <h2 className="text-xl font-bold text-white mb-2">{r.titulo}</h2>
            <p className="text-white/50 text-sm mb-1">{r.subtitulo}</p>
            {r.hora && <p className="text-white/30 text-xs mb-6">{r.hora}</p>}
            {!r.hora && <div className="mb-6" />}

            <div className="w-full space-y-3">
              <button
                onClick={() => {
                  const r = resultado
                  if (r?._ejecucionId) {
                    navigate(`/ejecucion/${r._ejecucionId}`, {
                      state: r._scan ? { newScan: r._scan, progreso: r._progreso } : undefined,
                      replace: true,
                    })
                  } else {
                    navigate(-1)
                  }
                }}
                className="w-full py-4 rounded-2xl font-semibold bg-dark-100 border border-white/10 text-white/70 active:scale-95 transition-transform"
              >
                ← Volver a la ronda
              </button>
              {esError && (
                <button
                  onClick={() => navigate(-1)}
                  className="w-full py-4 rounded-2xl font-semibold bg-accent text-dark-500 active:scale-95 transition-transform"
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>
        )
      })()}
    </>
  )
}
