import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'

const READER_ID = 'qr-page-reader'

export default function QRScannerPage() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState('iniciando') // iniciando | escaneando | error
  const [errorMsg, setErrorMsg] = useState('')
  const qrRef = useRef(null)
  const detectadoRef = useRef(false)

  useEffect(() => {
    const qr = new Html5Qrcode(READER_ID, { verbose: false })
    qrRef.current = qr

    qr.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: { width: 260, height: 260 } },
      (text) => {
        if (detectadoRef.current) return
        detectadoRef.current = true

        const match = text.match(/\/check\/([a-f0-9-]{36})/i)
        const uuid = match ? match[1] : text.trim()

        // Detener cámara, luego navegar
        qr.stop()
          .catch(() => {})
          .finally(() => navigate(`/check/${uuid}`, { replace: true }))
      },
      () => {}
    )
      .then(() => setEstado('escaneando'))
      .catch((err) => {
        const msg = String(err)
        setEstado('error')
        if (msg.includes('permission') || msg.includes('NotAllowed')) {
          setErrorMsg('Permiso de cámara denegado. Habilitalo en los ajustes del navegador.')
        } else if (msg.includes('NotFound') || msg.includes('no camera')) {
          setErrorMsg('No se encontró cámara trasera en este dispositivo.')
        } else {
          setErrorMsg('No se pudo iniciar la cámara.')
        }
      })

    return () => {
      qr.stop().catch(() => {})
    }
  }, [navigate])

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 50 }}>
      {/* Header */}
      <div
        className="shrink-0 px-4 py-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%)' }}
      >
        <div>
          <h2 className="font-bold text-white text-lg">Escanear checkpoint</h2>
          <p className="text-white/40 text-xs mt-0.5">
            {estado === 'iniciando' && 'Iniciando cámara...'}
            {estado === 'escaneando' && 'Posicioná el QR dentro del cuadrado'}
            {estado === 'error' && 'Error de cámara'}
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white text-lg active:scale-90 transition-transform"
        >
          ✕
        </button>
      </div>

      {/* Área cámara */}
      <div className="flex-1 relative overflow-hidden">
        {estado === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-danger/20 border-2 border-danger flex items-center justify-center text-4xl">
              📷
            </div>
            <p className="text-white font-semibold">Sin acceso a la cámara</p>
            <p className="text-white/50 text-sm leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-2 px-6 py-3 rounded-2xl bg-dark-100 border border-white/10 text-white/60 active:scale-95 transition-transform"
            >
              Volver
            </button>
          </div>
        ) : (
          <>
            {estado === 'iniciando' && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* html5-qrcode renderiza el video aquí */}
            <div id={READER_ID} className="w-full h-full" />

            {/* Overlay esquinas + línea */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative" style={{ width: 260, height: 260 }}>
                <span className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-accent" />
                <span className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-accent" />
                <span className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-accent" />
                <span className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-accent" />
                {estado === 'escaneando' && (
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
          </>
        )}
      </div>

      {/* Footer */}
      {estado === 'escaneando' && (
        <div
          className="shrink-0 px-6 py-5 text-center"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)' }}
        >
          <p className="text-white/40 text-sm">Acercá el teléfono al código QR del checkpoint</p>
        </div>
      )}
    </div>
  )
}
