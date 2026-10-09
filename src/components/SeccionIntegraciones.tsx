import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Integracion {
  proveedor: string
  estado: string | null
}

/** Strava ya no se conecta. El listado sale del servidor y no incluye tokens. */
export function SeccionIntegraciones() {
  const [integraciones, setIntegraciones] = useState<Integracion[]>([])

  useEffect(() => {
    let vivo = true
    api
      .integraciones()
      .then((r) => {
        if (vivo) setIntegraciones(r.integraciones.filter((i) => i.proveedor.toLowerCase() !== 'strava'))
      })
      .catch(() => {
        if (vivo) setIntegraciones([])
      })
    return () => {
      vivo = false
    }
  }, [])

  return (
    <div style={{ background: '#141416', border: '1px solid #23262F', borderRadius: '20px', padding: '24px', marginTop: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#FCFCFD' }}>Integraciones y Wearables</h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#777E90' }}>Servicios conectados a tu cuenta.</p>
      </div>
      {integraciones.length === 0 ? (
        <div style={{ background: '#1A1D1F', borderRadius: '12px', padding: '16px', color: '#777E90', fontSize: '14px' }}>No hay otros servicios conectados.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {integraciones.map((i) => (
            <div key={i.proveedor} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#1A1D1F', borderRadius: '14px', border: '1px solid #23262F' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#FCFCFD' }}>{i.proveedor}</div>
              <span style={{ fontSize: '12px', color: '#777E90' }}>{i.estado ?? 'conectado'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
