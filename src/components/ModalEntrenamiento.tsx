import React, { useState } from 'react'
import { LISTA_EJERCICIOS, calcularCaloriasQuemadas } from '../lib/deportes'

interface Props {
  abierto: boolean
  pesoUsuario?: number
  alCerrar: () => void
  alGuardar: (datos: { nombre: string; minutos: number; calorias: number; tipo: string }) => void
}

export function ModalEntrenamiento({ abierto, pesoUsuario = 85.5, alCerrar, alGuardar }: Props) {
  const [ejercicioId, setEjercicioId] = useState(LISTA_EJERCICIOS[0].id)
  const [minutos, setMinutos] = useState(45)

  if (!abierto) return null

  const seleccionado = LISTA_EJERCICIOS.find((e) => e.id === ejercicioId) || LISTA_EJERCICIOS[0]
  const caloriasCalculadas = calcularCaloriasQuemadas(seleccionado.met, pesoUsuario, minutos)

  const manejarSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alGuardar({
      tipo: seleccionado.categoria,
      nombre: seleccionado.nombre,
      minutos,
      calorias: caloriasCalculadas
    })
    alCerrar()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
      <div style={{ background: '#141416', border: '1px solid #23262F', borderRadius: '24px', width: '100%', maxWidth: '440px', padding: '24px', color: '#FCFCFD' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Registrar ejercicio</h2>
          <button onClick={alCerrar} style={{ background: 'transparent', border: 'none', color: '#777E90', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={manejarSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#777E90', marginBottom: '6px' }}>Tipo de actividad</label>
            <select value={ejercicioId} onChange={(e) => setEjercicioId(e.target.value)} style={{ width: '100%', padding: '12px', background: '#1A1D1F', border: '1px solid #23262F', borderRadius: '12px', color: '#FCFCFD' }}>
              {LISTA_EJERCICIOS.map((ej) => <option key={ej.id} value={ej.id}>{ej.nombre}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#777E90', marginBottom: '6px' }}>
              <span>Duración</span>
              <span style={{ color: '#10B981', fontWeight: 600 }}>{minutos} min</span>
            </div>
            <input type="range" min={5} max={180} step={5} value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} style={{ width: '100%', accentColor: '#10B981' }} />
          </div>
          <div style={{ background: '#1A1D1F', borderRadius: '16px', padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#777E90' }}>Gasto calórico estimado</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#10B981' }}>~{caloriasCalculadas} kcal</div>
            </div>
          </div>
          <button type="submit" style={{ width: '100%', padding: '14px', background: '#10B981', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
            Añadir a mi registro diario
          </button>
        </form>
      </div>
    </div>
  )
}
