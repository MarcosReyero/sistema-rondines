import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import QRDisplay from '../../components/QRDisplay'

export default function GestionQR() {
  const [instalaciones, setInstalaciones] = useState([])
  const [instSeleccionada, setInstSeleccionada] = useState(null)
  const [checkpoints, setCheckpoints] = useState([])
  const [qrActivo, setQrActivo] = useState(null)
  const [qrData, setQrData] = useState({})
  const [loading, setLoading] = useState(false)
  const [descargandoZip, setDescargandoZip] = useState(false)

  useEffect(() => {
    api.get('/instalaciones/').then(({ data }) => setInstalaciones(data.results || data))
  }, [])

  const cargarCheckpoints = async (inst) => {
    setInstSeleccionada(inst)
    setLoading(true)
    const { data } = await api.get(`/instalaciones/${inst.id}/checkpoints/`)
    setCheckpoints(data.results || data)
    setLoading(false)
  }

  const verQR = async (cp) => {
    if (qrData[cp.id]) {
      setQrActivo(cp)
      return
    }
    const { data } = await api.get(`/qr/${cp.id}/`)
    setQrData((prev) => ({ ...prev, [cp.id]: data }))
    setQrActivo(cp)
  }

  const regenerar = async (cp) => {
    if (!confirm(`¿Regenerar QR de "${cp.nombre}"? El QR anterior dejará de funcionar.`)) return
    const { data } = await api.post(`/qr/${cp.id}/regenerar/`)
    setQrData((prev) => ({ ...prev, [cp.id]: data }))
    setCheckpoints((prev) => prev.map((c) => c.id === cp.id ? { ...c, codigo_qr: data.codigo_qr } : c))
    setQrActivo(cp)
  }

  const descargarZip = async () => {
    setDescargandoZip(true)
    try {
      const response = await api.get(`/instalaciones/${instSeleccionada.id}/qr-zip/`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${instSeleccionada.nombre}_qr.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDescargandoZip(false)
    }
  }

  return (
    <div className="p-4 md:p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Gestión de QR</h1>
        {instSeleccionada && (
          <button onClick={descargarZip} disabled={descargandoZip} className="btn-ghost text-sm">
            {descargandoZip ? 'Generando...' : '↓ Descargar todos (ZIP)'}
          </button>
        )}
      </div>

      <div className="flex flex-col md:grid md:grid-cols-4 gap-4 md:gap-6">
        {/* Lista instalaciones */}
        <div className="md:col-span-1">
          <h2 className="text-white/50 text-xs uppercase tracking-wider mb-3">Instalaciones</h2>
          <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-0 md:space-y-1 md:pb-0 md:overflow-visible">
            {instalaciones.map((inst) => (
              <button
                key={inst.id}
                onClick={() => cargarCheckpoints(inst)}
                className={`shrink-0 md:w-full text-left px-3 py-2 md:py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap md:whitespace-normal ${
                  instSeleccionada?.id === inst.id
                    ? 'bg-accent/10 text-accent'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                {inst.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Grid checkpoints */}
        <div className="md:col-span-3">
          {!instSeleccionada ? (
            <div className="text-white/30 text-center py-16">Seleccioná una instalación</div>
          ) : loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {checkpoints.map((cp) => (
                <div key={cp.id} className="card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{cp.nombre}</p>
                      <p className="text-white/40 text-xs mt-0.5 truncate">UUID: {String(cp.codigo_qr).slice(0, 8)}...</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => verQR(cp)} className="flex-1 py-2 text-sm bg-dark-100 hover:bg-accent/20 hover:text-accent rounded-xl transition-colors text-white/60">
                      Ver QR
                    </button>
                    <button onClick={() => regenerar(cp)} className="px-3 py-2 text-sm bg-dark-100 hover:bg-warning/20 hover:text-warning rounded-xl transition-colors text-white/40" title="Regenerar">
                      ↺
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal QR */}
      {qrActivo && qrData[qrActivo.id] && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={() => setQrActivo(null)}>
          <div className="bg-dark-200 rounded-2xl p-6 w-full max-w-sm border border-white/10" onClick={(e) => e.stopPropagation()}>
            <QRDisplay
              nombre={qrActivo.nombre}
              qrBase64={qrData[qrActivo.id].qr_base64}
              uuid={qrData[qrActivo.id].codigo_qr}
            />
            <button onClick={() => setQrActivo(null)} className="btn-ghost w-full mt-4 text-sm">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
