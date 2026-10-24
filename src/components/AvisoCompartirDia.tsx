/**
 * Aviso dentro de la app al final del día: «¿Compartes tu día?». Solo hoy, si hay comidas,
 * a partir de una hora antes del aviso de cierre (o 21:00 si no hay cierre configurado) y
 * solo si el canal «app» del cierre está activo en Ajustes › Recordatorios. Una vez al día.
 */
import { useEffect, useState } from 'react'
import { Share2, X } from 'lucide-react'
import { leerRecordatorios } from '../lib/push.ts'
import { tocaAvisoCompartir } from '../lib/avisoCompartir.ts'

const clave = (f: string) => `nf:compartir:aviso:${f}`
export function AvisoCompartirDia({ fecha, numComidas, onCompartir }: { fecha: string; numComidas: number; onCompartir: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let ok = true
    let descartado = false
    try { descartado = localStorage.getItem(clave(fecha)) === '1' } catch { /* sin storage */ }
    if (descartado || numComidas < 1) { setVisible(false); return }
    leerRecordatorios()
      .then((e) => {
        const p = e.preferencias
        const canalApp = p.canales?.cierre?.app ?? true
        if (ok) setVisible(tocaAvisoCompartir({ ahora: new Date(), numComidas, cierre: p.cierre, canalApp, descartado }))
      })
      .catch(() => undefined)
    return () => void (ok = false)
  }, [fecha, numComidas])
  if (!visible) return null
  const cerrar = () => { try { localStorage.setItem(clave(fecha), '1') } catch { /* nada */ } setVisible(false) }
  return (
    <div role="status" className="tarjeta flex items-center gap-3 border border-mint/30 bg-mint/5 px-4 py-3" data-testid="aviso-compartir">
      <span aria-hidden className="text-2xl">🌱</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Día cerrado: {numComidas} {numComidas === 1 ? 'comida' : 'comidas'}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">¿Compartes tu día? Solo emojis y números, nunca fotos.</p>
      </div>
      <button type="button" onClick={() => { cerrar(); onCompartir() }} className="inline-flex items-center gap-1.5 rounded-full bg-mint-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-mint-800">
        <Share2 size={15} /> Compartir
      </button>
      <button type="button" onClick={cerrar} aria-label="Ahora no" className="rounded-full p-1 text-neutral-400 hover:text-graphite dark:hover:text-white"><X size={16} /></button>
    </div>
  )
}
