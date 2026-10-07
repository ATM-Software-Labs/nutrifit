import { useState } from 'react'

interface Props {
  abierto: boolean
  alCerrar: () => void
  alGuardarRacion: (racion: { nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number }) => void
}

export function ModalCalculadorTupper({ abierto, alCerrar, alGuardarRacion }: Props) {
  const [nombreReceta, setNombreReceta] = useState('Batch Cooking / Guiso')
  const [raciones, setRaciones] = useState(4)
  const [caloriasTotales, setCaloriasTotales] = useState(2000)
  const [proteinaTotal, setProteinaTotal] = useState(160)
  const [carbosTotales, setCarbosTotales] = useState(200)
  const [grasasTotales, setGrasasTotales] = useState(45)

  if (!abierto) return null

  const calPorcion = Math.round(caloriasTotales / raciones)
  const protPorcion = Math.round(proteinaTotal / raciones)
  const carbPorcion = Math.round(carbosTotales / raciones)
  const grasaPorcion = Math.round(grasasTotales / raciones)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px'
    }}>
      <div style={{
        background: '#141416', border: '1px solid #23262F', borderRadius: '24px',
        width: '100%', maxWidth: '440px', padding: '24px', color: '#FCFCFD',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>🍲 Calculadora de Tupper / Receta</h3>
          <button onClick={alCerrar} style={{ background: 'transparent', border: 'none', color: '#777E90', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#777E90', marginBottom: '4px' }}>Nombre del plato</label>
          <input
            type="text"
            value={nombreReceta}
            onChange={(e) => setNombreReceta(e.target.value)}
            style={{ width: '100%', padding: '10px', background: '#1A1D1F', border: '1px solid #23262F', borderRadius: '10px', color: '#fff', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#777E90', marginBottom: '4px' }}>
            <span>Número de raciones / tuppers:</span>
            <span style={{ color: '#10B981', fontWeight: 600 }}>{raciones} tuppers</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={raciones}
            onChange={(e) => setRaciones(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#10B981' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#777E90', marginBottom: '4px' }}>Kcal totales olla</label>
            <input type="number" value={caloriasTotales} onChange={(e) => setCaloriasTotales(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: '#1A1D1F', border: '1px solid #23262F', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#777E90', marginBottom: '4px' }}>Proteína total (g)</label>
            <input type="number" value={proteinaTotal} onChange={(e) => setProteinaTotal(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: '#1A1D1F', border: '1px solid #23262F', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ background: '#1A1D1F', border: '1px solid #23262F', borderRadius: '14px', padding: '14px', marginBottom: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#777E90' }}>Valores por 1 tupper</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#10B981', margin: '4px 0' }}>{calPorcion} kcal</div>
          <div style={{ fontSize: '12px', color: '#94A3B8' }}>P: {protPorcion}g · C: {carbPorcion}g · G: {grasaPorcion}g</div>
        </div>

        <button
          onClick={() => {
            alGuardarRacion({
              nombre: `${nombreReceta} (1 ración)`,
              calorias: calPorcion,
              proteinas: protPorcion,
              carbohidratos: carbPorcion,
              grasas: grasaPorcion
            })
            alCerrar()
          }}
          style={{ width: '100%', padding: '12px', background: '#10B981', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
        >
          Registrar 1 tupper hoy
        </button>
      </div>
    </div>
  )
}
