import { useState } from 'react'

export function SeccionPreferenciasAvanzadas() {
  const [ayunoActivo, setAyunoActivo] = useState(false)
  const [tipoAyuno, setTipoAyuno] = useState('16/8')
  const [modoMacros, setModoMacros] = useState<'porcentaje' | 'gramos_kg'>('gramos_kg')
  const [protPorKg, setProtPorKg] = useState(1.8)

  return (
    <div style={{
      background: '#141416',
      border: '1px solid #23262F',
      borderRadius: '20px',
      padding: '24px',
      marginTop: '24px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{ marginBottom: '18px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#FCFCFD' }}>
          Estrategia Nutricional y Ayuno
        </h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#777E90' }}>
          Personaliza cómo se calculan tus necesidades y ventanas horarias.
        </p>
      </div>

      {/* Ajuste de Proteínas por Peso */}
      <div style={{
        padding: '16px', background: '#1A1D1F', borderRadius: '14px', border: '1px solid #23262F', marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#FCFCFD' }}>Cálculo de Proteína</div>
            <div style={{ fontSize: '12px', color: '#777E90' }}>Ajusta los gramos por kilogramo de peso corporal</div>
          </div>
          <span style={{ color: '#10B981', fontWeight: 700, fontSize: '15px' }}>{protPorKg} g/kg</span>
        </div>
        <input
          type="range"
          min={1.2}
          max={2.6}
          step={0.1}
          value={protPorKg}
          onChange={(e) => setProtPorKg(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#10B981' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#777E90', marginTop: '4px' }}>
          <span>1.2 g (Mantenimiento)</span>
          <span>1.8 - 2.2 g (Hipertrofia / Déficit)</span>
          <span>2.6 g (Atleta)</span>
        </div>
      </div>

      {/* Ayuno Intermitente */}
      <div style={{
        padding: '16px', background: '#1A1D1F', borderRadius: '14px', border: '1px solid #23262F'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#FCFCFD' }}>Temporizador de Ayuno</div>
            <div style={{ fontSize: '12px', color: '#777E90' }}>Muestra tu ventana de alimentación en el dashboard</div>
          </div>
          <button
            onClick={() => setAyunoActivo(!ayunoActivo)}
            style={{
              background: ayunoActivo ? '#10B981' : '#23262F',
              border: 'none',
              borderRadius: '999px',
              width: '46px',
              height: '26px',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <div style={{
              width: '20px',
              height: '20px',
              background: '#fff',
              borderRadius: '50%',
              position: 'absolute',
              top: '3px',
              left: ayunoActivo ? '23px' : '3px',
              transition: 'all 0.2s ease'
            }} />
          </button>
        </div>

        {ayunoActivo && (
          <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
            {['16/8', '18/6', '20/4', 'OMAD'].map((protocolo) => (
              <button
                key={protocolo}
                onClick={() => setTipoAyuno(protocolo)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '10px',
                  border: `1px solid ${tipoAyuno === protocolo ? '#10B981' : '#23262F'}`,
                  background: tipoAyuno === protocolo ? 'rgba(16, 185, 129, 0.15)' : '#141416',
                  color: tipoAyuno === protocolo ? '#10B981' : '#777E90',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {protocolo}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
