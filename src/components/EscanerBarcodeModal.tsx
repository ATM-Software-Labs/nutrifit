import React, { useEffect, useRef, useState } from 'react'

interface Props {
  abierto: boolean
  alDetectar: (producto: any) => void
  alCerrar: () => void
}

export function EscanerBarcodeModal({ abierto, alDetectar, alCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codigoManual, setCodigoManual] = useState('')

  useEffect(() => {
    if (!abierto) return
    let stream: MediaStream | null = null
    let animationFrame: number

    const iniciarCamara = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] })
          const detectar = async () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current)
                if (barcodes.length > 0) {
                  buscarCodigo(barcodes[0].rawValue)
                  return
                }
              } catch (_) {}
            }
            animationFrame = requestAnimationFrame(detectar)
          }
          detectar()
        }
      } catch (err) {
        setError('No se pudo acceder a la cámara.')
      }
    }
    iniciarCamara()
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [abierto])

  const buscarCodigo = async (ean: string) => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/alimentos/barcode?ean=${ean}`)
      const data = await res.json()
      if (res.ok && data.producto) {
        alDetectar(data.producto)
        alCerrar()
      } else {
        setError(data.error || 'Código no reconocido')
      }
    } catch (e) {
      setError('Error al consultar el alimento')
    } finally {
      setCargando(false)
    }
  }

  if (!abierto) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
      <div style={{ background: '#141416', border: '1px solid #23262F', borderRadius: '24px', width: '100%', maxWidth: '420px', padding: '24px', color: '#FCFCFD' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Escanear código de barras</h3>
          <button onClick={alCerrar} style={{ background: 'transparent', border: 'none', color: '#777E90', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ position: 'relative', width: '100%', height: '220px', background: '#000', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
        </div>
        {cargando && <div style={{ color: '#10B981', fontSize: '13px', marginBottom: '12px' }}>Buscando...</div>}
        {error && <div style={{ color: '#EF4444', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="text" placeholder="Código EAN" value={codigoManual} onChange={(e) => setCodigoManual(e.target.value)} style={{ flex: 1, padding: '10px 14px', background: '#1A1D1F', border: '1px solid #23262F', borderRadius: '10px', color: '#FCFCFD' }} />
          <button onClick={() => codigoManual && buscarCodigo(codigoManual)} style={{ padding: '10px 16px', background: '#10B981', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Buscar</button>
        </div>
      </div>
    </div>
  )
}
