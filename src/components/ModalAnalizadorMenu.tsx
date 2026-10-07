import { useState } from 'react'

interface Plato {
  nombre: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  recomendado: boolean
  motivo: string
}

interface Props {
  abierto: boolean
  caloriasRestantes?: number
  alCerrar: () => void
  alElegirPlato: (plato: Plato) => void
}

export function ModalAnalizadorMenu({ abierto, caloriasRestantes = 994, alCerrar, alElegirPlato }: Props) {
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [platos, setPlatos] = useState<Plato[]>([])

  if (!abierto) return null

  const analizar = async () => {
    if (!texto.trim()) return
    setCargando(true)
    try {
      const res = await fetch('/api/alimentos/analizar-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textoMenu: texto })
      })
      const data = await res.json()
      if (data.platos) {
        setPlatos(data.platos)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px'
    }}>
      <div style={{
        background: '#141416', border: '1px solid #23262F', borderRadius: '24px',
        width: '100%', maxWidth: '520px', padding: '24px', color: '#FCFCFD',
        maxHeight: '90vh', overflowY: 'auto', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>🍽️ Escáner de Menú y Carta</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#777E90' }}>
              Te quedan <strong style={{ color: '#10B981' }}>{caloriasRestantes} kcal</strong> hoy. Elige la mejor opción.
            </p>
          </div>
          <button onClick={alCerrar} style={{ background: 'transparent', border: 'none', color: '#777E90', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <textarea
            placeholder="Pega aquí los platos del menú del día, la descripción de la carta o ingredientes..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            style={{
              width: '100%', padding: '12px', background: '#1A1D1F', border: '1px solid #23262F',
              borderRadius: '12px', color: '#FCFCFD', fontSize: '13px', boxSizing: 'border-box', outline: 'none', resize: 'vertical'
            }}
          />
          <button
            onClick={analizar}
            disabled={cargando}
            style={{
              marginTop: '8px', width: '100%', padding: '12px', background: '#10B981', border: 'none',
              borderRadius: '12px', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer'
            }}
          >
            {cargando ? 'Analizando valores y opciones...' : 'Analizar platos'}
          </button>
        </div>

        {platos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {platos.map((p, idx) => (
              <div
                key={idx}
                style={{
                  background: '#1A1D1F', border: `1px solid ${p.recomendado ? '#10B981' : '#23262F'}`,
                  borderRadius: '14px', padding: '14px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#FCFCFD' }}>{p.nombre}</span>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px',
                    background: p.recomendado ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: p.recomendado ? '#10B981' : '#EF4444'
                  }}>
                    {p.recomendado ? 'Opción Top' : 'Alta en grasa'}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#777E90', marginBottom: '8px' }}>{p.motivo}</div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                    <strong style={{ color: '#FCFCFD' }}>{p.calorias} kcal</strong> · P: {p.proteinas}g · C: {p.carbohidratos}g · G: {p.grasas}g
                  </div>
                  <button
                    onClick={() => { alElegirPlato(p); alCerrar() }}
                    style={{
                      background: '#23262F', border: '1px solid #353945', color: '#10B981',
                      borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    Registrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
