import React, { useState, useEffect } from 'react'
import { ModalEntrenamiento } from './ModalEntrenamiento'

export function TarjetaEntrenamientos({ pesoUsuario = 85.5 }: { pesoUsuario?: number }) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [entrenos, setEntrenos] = useState<any[]>([])

  const cargar = async () => {
    try {
      const res = await fetch('/api/entrenamientos')
      if (res.ok) {
        const data = await res.json()
        setEntrenos(data.entrenamientos || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { cargar() }, [])

  const caloriasTotales = entrenos.reduce((acc, curr) => acc + (curr.calorias || 0), 0)

  const guardarEntreno = async (datos: any) => {
    await fetch('/api/entrenamientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    })
    cargar()
  }

  return (
    <>
      <div style={{
        background: '#141416', border: '1px solid #23262F', borderRadius: '20px',
        padding: '20px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🔥</span>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#FCFCFD' }}>Ejercicio diario</span>
          </div>
          <button
            onClick={() => setModalAbierto(true)}
            style={{
              background: '#23262F', border: '1px solid #353945', color: '#10B981',
              borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            + Añadir
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#FCFCFD' }}>{caloriasTotales}</span>
          <span style={{ fontSize: '14px', color: '#777E90' }}>kcal quemadas</span>
        </div>

        {entrenos.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#777E90', textAlign: 'center', padding: '12px 0' }}>
            Sin entrenamientos registrados hoy
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {entrenos.map((e) => (
              <div key={e.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', background: '#1A1D1F', borderRadius: '10px', border: '1px solid #23262F'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#FCFCFD' }}>{e.nombre}</div>
                  <div style={{ fontSize: '11px', color: '#777E90' }}>{e.minutos} min · {e.origen}</div>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#10B981' }}>-{e.calorias} kcal</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalEntrenamiento
        abierto={modalAbierto}
        pesoUsuario={pesoUsuario}
        alCerrar={() => setModalAbierto(false)}
        alGuardar={guardarEntreno}
      />
    </>
  )
}
