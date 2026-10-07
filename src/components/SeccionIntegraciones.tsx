import { useState } from 'react'

export function SeccionIntegraciones() {
  const [stravaConectado] = useState(false)

  const conectarStrava = () => {
    const CLIENT_ID = 'STRAVA_CLIENT_ID'
    const REDIRECT = encodeURIComponent(`${window.location.origin}/api/integraciones/strava/callback`)
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT}&scope=read,activity:read_all`
  }

  return (
    <div style={{ background: '#141416', border: '1px solid #23262F', borderRadius: '20px', padding: '24px', marginTop: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#FCFCFD' }}>Integraciones y Wearables</h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#777E90' }}>Sincroniza tus actividades y quema calórica automáticamente.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#1A1D1F', borderRadius: '14px', border: '1px solid #23262F' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#FCFCFD' }}>Strava</div>
            <div style={{ fontSize: '12px', color: '#777E90' }}>Ciclismo, carreras, caminatas y rutas</div>
          </div>
          <button onClick={conectarStrava} style={{ background: 'rgba(252, 82, 0, 0.15)', border: '1px solid #FC5200', color: '#FC5200', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            {stravaConectado ? 'Conectado' : 'Conectar'}
          </button>
        </div>
      </div>
    </div>
  )
}
