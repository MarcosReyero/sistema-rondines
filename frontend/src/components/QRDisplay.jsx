import React from 'react'

export default function QRDisplay({ nombre, qrBase64, uuid }) {
  const descargar = () => {
    const a = document.createElement('a')
    a.href = `data:image/png;base64,${qrBase64}`
    a.download = `QR_${nombre}.png`
    a.click()
  }

  return (
    <div className="flex flex-col items-center">
      <h3 className="font-bold text-white text-lg mb-1">{nombre}</h3>
      <p className="text-white/30 text-xs mb-4 font-mono">{uuid}</p>
      <div className="bg-white p-4 rounded-2xl">
        <img
          src={`data:image/png;base64,${qrBase64}`}
          alt={`QR ${nombre}`}
          className="w-48 h-48 object-contain"
        />
      </div>
      <button onClick={descargar} className="btn-primary mt-4 text-sm w-full">
        ↓ Descargar PNG
      </button>
    </div>
  )
}
