/**
 * Cantidad de un producto envasado: botones rápidos (envase entero, ½, porción,
 * vaso) y campo libre con selector de unidad (ml/cl/l para líquidos; g para sólidos).
 * Trabaja siempre en la unidad base (g o ml).
 */
import { useId, useState } from 'react'
import { aMl, desdeMl, formatoCantidad, opcionesRapidas, type UnidadVolumen } from '../lib/liquidos.ts'
import type { MedidasProducto } from '../lib/tipos.ts'
import { cx } from './ui/cx.ts'

export function SelectorCantidad({ producto, cantidad, onCambio }: { producto: MedidasProducto; cantidad: number; onCambio: (base: number, clave?: string) => void }) {
  const liq = producto.unidad === 'ml'
  const [uv, setUv] = useState<UnidadVolumen>('ml')
  const id = useId()
  const opciones = opcionesRapidas(producto)
  const mostrado = liq ? desdeMl(cantidad, uv) : cantidad
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {liq ? '¿Cuánto has bebido?' : '¿Cuánto has comido?'}
      </legend>
      {opciones.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Cantidades rápidas">
          {opciones.map((o) => {
            const activa = Math.abs(o.cantidad - cantidad) < 0.5
            return (
              <button key={o.clave} type="button" aria-pressed={activa} onClick={() => onCambio(o.cantidad, o.clave)}
                className={cx('rounded-full border px-3 py-1.5 text-sm transition', activa ? 'border-mint-700 bg-mint-700 text-white' : 'border-neutral-200 hover:border-mint hover:bg-mint/10 dark:border-neutral-700')}>
                {o.etiqueta}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm text-neutral-600 dark:text-neutral-300">Otra cantidad</label>
        <input id={id} type="number" inputMode="decimal" min={0} step="any" value={Number.isFinite(mostrado) ? Math.round(mostrado * 1000) / 1000 : 0}
          onFocus={(e) => e.target.select()}
          onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); if (Number.isFinite(v) && v >= 0) onCambio(liq ? aMl(v, uv) : v) }}
          className="cifra h-10 w-24 rounded-xl border border-neutral-200 bg-card px-3 text-right text-sm focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint/15 dark:border-neutral-800 dark:bg-card-dark" />
        {liq ? (
          <div className="inline-flex rounded-xl border border-neutral-200 p-0.5 dark:border-neutral-700" role="radiogroup" aria-label="Unidad">
            {(['ml', 'cl', 'l'] as const).map((u) => (
              <button key={u} type="button" role="radio" aria-checked={uv === u} onClick={() => setUv(u)}
                className={cx('h-8 min-w-9 rounded-lg px-2 text-sm', uv === u ? 'bg-mint-700 text-white' : 'text-neutral-600 dark:text-neutral-300')}>{u}</button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-neutral-500">g</span>
        )}
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Valores nutricionales por 100 {producto.unidad}
        {producto.envase ? ` · envase de ${formatoCantidad(producto.envase, producto.unidad)}` : ''}
        {producto.unidades && producto.unidades > 1 ? ` (pack de ${producto.unidades})` : ''}
      </p>
    </fieldset>
  )
}
