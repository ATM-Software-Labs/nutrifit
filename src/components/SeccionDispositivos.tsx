import { useState, useEffect } from 'react'

interface Dispositivo {
  id: string
  dispositivo?: string
  navegador?: string
  ip?: string
  ultimo_acceso: number
  es_actual?: boolean
}

export function SeccionDispositivos() {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    try {
      const res = await fetch('/api/dispositivos', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setDispositivos(data.dispositivos || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const revocar = async (id: string) => {
    try {
      const res = await fetch('/api/dispositivos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesionId: id })
      })
      if (res.ok) {
        setDispositivos((prev) => prev.filter((d) => d.id !== id))
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ background: '#141416', border: '1px solid #23262F', borderRadius: '20px', padding: '24px', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#FCFCFD' }}>Dispositivos y sesiones</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#777E90' }}>Sesiones activas en tu cuenta.</p>
        </div>
        <span style={{ fontSize: '12px', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '4px 10px', borderRadius: '999px' }}>
          {dispositivos.length} activos
        </span>
      </div>
      {cargando ? (
        <div style={{ color: '#777E90', fontSize: '14px' }}>Cargando sesiones...</div>
      ) : dispositivos.length === 0 ? (
        <div style={{ background: '#1A1D1F', borderRadius: '12px', padding: '16px', color: '#777E90', fontSize: '14px', textAlign: 'center' }}>
          Solo esta sesión activa.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {dispositivos.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#1A1D1F', borderRadius: '14px', border: '1px solid #23262F' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#FCFCFD' }}>{d.dispositivo || 'Navegador Web'}</span>
                <div style={{ fontSize: '12px', color: '#777E90', marginTop: '2px' }}>{d.navegador} {d.ip ? `· ${d.ip}` : ''}</div>
              </div>
              <button onClick={() => revocar(d.id)} style={{ background: 'transparent', border: '1px solid #353945', color: '#EF4444', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                Cerrar sesión
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
