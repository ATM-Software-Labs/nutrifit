import { useId, useState } from 'react'
import { ChevronDown, Copy, Plus, Trash2 } from 'lucide-react'
import { cx } from './ui/cx.ts'
import { entero } from '../lib/formato.ts'
import { emojiComida, esFotoReal } from '../lib/miniaturaComida.ts'
import { NOMBRE_TIPO, type Comida, type TipoComida } from '../lib/tipos.ts'

function Miniatura({ c }: { c: Comida }) {
  const [rota, setRota] = useState(false)
  const foto = esFotoReal(c.imagen_url) && !rota ? c.imagen_url : null
  if (foto) {
    return (
      <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
        <img src={foto} alt="" width={36} height={36} className="h-full w-full object-cover" onError={() => setRota(true)} />
      </span>
    )
  }
  return (
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 text-[22px] leading-none dark:bg-neutral-800">
      <span className="block leading-none">{emojiComida(c)}</span>
    </span>
  )
}

function FilaComida({
  c,
  onBorrar,
  onRepetir,
  onFrecuente,
}: {
  c: Comida
  onBorrar: (c: Comida) => void
  onRepetir: (c: Comida) => void
  onFrecuente: (c: Comida) => void
}) {
  const [confirmar, setConfirmar] = useState(false)
  const [menu, setMenu] = useState(false)
  return (
    <li className={cx('flex items-center gap-3 py-3', c.pendiente && 'opacity-60')}>
      <Miniatura c={c} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{c.descripcion}</p>
        <p className="cifra mt-0.5 flex gap-2.5 text-xs text-neutral-500 dark:text-neutral-400">
          <span><span className="text-protein">●</span> P {entero(c.proteinas)}</span>
          <span><span className="text-carbs">●</span> C {entero(c.carbohidratos)}</span>
          <span><span className="text-fats">●</span> G {entero(c.grasas)}</span>
        </p>
      </div>
      {confirmar ? (
        <div className="flex animate-fade-in items-center gap-1">
          <button type="button" onClick={() => setConfirmar(false)} className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Cancelar
          </button>
          <button type="button" onClick={() => onBorrar(c)} className="rounded-lg bg-protein/10 px-2.5 py-1.5 text-sm font-medium text-protein hover:bg-protein/15" autoFocus>
            Eliminar
          </button>
        </div>
      ) : (
        <>
          <span className="cifra text-sm font-medium">
            {entero(c.calorias)} <span className="font-normal text-neutral-500 dark:text-neutral-400">kcal</span>
          </span>
          <div className="relative">
            <button
              type="button"
              disabled={c.pendiente}
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-label={`Duplicar ${c.descripcion}`}
              onClick={() => setMenu((v) => !v)}
              className="rounded-full p-1.5 text-neutral-300 transition hover:bg-neutral-100 hover:text-graphite dark:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              <Copy size={16} strokeWidth={1.75} />
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-neutral-200 bg-card p-1 shadow-lift dark:border-neutral-800 dark:bg-card-dark">
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setMenu(false)
                    onRepetir(c)
                  }}
                >
                  Repetir hoy
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setMenu(false)
                    onFrecuente(c)
                  }}
                >
                  Guardar como comida frecuente
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={c.pendiente}
            onClick={() => setConfirmar(true)}
            aria-label={`Eliminar ${c.descripcion}`}
            className="-mr-1.5 rounded-full p-1.5 text-neutral-300 transition hover:bg-neutral-100 hover:text-protein dark:text-neutral-600 dark:hover:bg-neutral-800"
          >
            <Trash2 size={16} strokeWidth={1.75} />
          </button>
        </>
      )}
    </li>
  )
}

/** Sección plegable de un tipo de comida con lista y botón +. */
export function SeccionComida({
  tipo,
  comidas,
  onAnadir,
  onBorrar,
  onRepetir,
  onFrecuente,
}: {
  tipo: TipoComida
  comidas: Comida[]
  onAnadir: (t: TipoComida) => void
  onBorrar: (c: Comida) => void
  onRepetir: (c: Comida) => void
  onFrecuente: (c: Comida) => void
}) {
  const [abierta, setAbierta] = useState(true)
  const id = useId()
  const kcal = comidas.reduce((a, c) => a + c.calorias, 0)
  return (
    <section className="tarjeta">
      <div className="flex items-center gap-2 py-2 pl-5 pr-2.5">
        <button
          type="button"
          onClick={() => setAbierta((a) => !a)}
          aria-expanded={abierta}
          aria-controls={id}
          className="flex flex-1 items-center gap-2 rounded-xl py-2 text-left"
        >
          <span className="font-semibold">{NOMBRE_TIPO[tipo]}</span>
          <span className="cifra text-sm text-neutral-500 dark:text-neutral-400">{comidas.length ? `${entero(kcal)} kcal` : ''}</span>
          <ChevronDown size={16} className={cx('ml-auto text-neutral-500 dark:text-neutral-400 transition-transform duration-200', !abierta && '-rotate-90')} />
        </button>
        <button
          type="button"
          onClick={() => onAnadir(tipo)}
          aria-label={`Añadir a ${NOMBRE_TIPO[tipo].toLowerCase()}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-all hover:border-mint hover:bg-mint hover:text-white active:scale-95 dark:border-neutral-700 dark:text-neutral-300"
        >
          <Plus size={18} strokeWidth={2} />
        </button>
      </div>
      {abierta && (
        <div id={id} className="px-5 pb-2">
          {comidas.length ? (
            <ul className="divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
              {comidas.map((c) => (
                <FilaComida key={c.id} c={c} onBorrar={onBorrar} onRepetir={onRepetir} onFrecuente={onFrecuente} />
              ))}
            </ul>
          ) : (
            <p className="border-t border-neutral-100 py-3.5 text-sm text-neutral-500 dark:text-neutral-400 dark:border-neutral-800">Sin registros todavía</p>
          )}
        </div>
      )}
    </section>
  )
}
