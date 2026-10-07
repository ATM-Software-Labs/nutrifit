import { useState } from 'react'

interface Props {
  alAbrirCamara: () => void
  alAbrirComida: () => void
  alSumarAguaRapida: (ml: number) => void
}

export function AccionesRapidasMovil({ alAbrirCamara, alAbrirComida, alSumarAguaRapida }: Props) {
  const [desplegado, setDesplegado] = useState(false)

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '20px',
      zIndex: 9000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '10px'
    }}>
      {/* Botones secundarios al abrir */}
      {desplegado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <button
            onClick={() => { alSumarAguaRapida(250); setDesplegado(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', background: '#1A1D1F',
              border: '1px solid #23262F', color: '#38BDF8', padding: '10px 14px',
              borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}
          >
            <span>💧 +250 ml Agua</span>
          </button>

          <button
            onClick={() => { alAbrirCamara(); setDesplegado(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', background: '#1A1D1F',
              border: '1px solid #23262F', color: '#FCFCFD', padding: '10px 14px',
              borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}
          >
            <span>📷 Escanear Barcode</span>
          </button>

          <button
            onClick={() => { alAbrirComida(); setDesplegado(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', background: '#1A1D1F',
              border: '1px solid #23262F', color: '#10B981', padding: '10px 14px',
              borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}
          >
            <span>🍽️ Añadir Plato</span>
          </button>
        </div>
      )}

      {/* Botón flotante principal (+) */}
      <button
        onClick={() => setDesplegado(!desplegado)}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '28px',
          background: '#10B981',
          border: 'none',
          color: '#FFFFFF',
          fontSize: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
          transform: desplegado ? 'rotate(45deg)' : 'none',
          transition: 'transform 0.2s ease'
        }}
      >
        +
      </button>
    </div>
  )
}
