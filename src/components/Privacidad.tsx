/**
 * /privacidad — muestra PRIVACIDAD.md (fuente única, importado en build) con
 * un renderizador Markdown mínimo y seguro (solo elementos React, sin HTML).
 */
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import texto from '../../PRIVACIDAD.md?raw'

function enLinea(s: string): ReactNode[] {
  const partes: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*|mailto:[^)\s]+)\)|`([^`]+)`/g
  let ultimo = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > ultimo) partes.push(s.slice(ultimo, m.index))
    if (m[1]) partes.push(<strong key={m.index} className="font-semibold text-graphite dark:text-neutral-100">{m[1]}</strong>)
    else if (m[2]) partes.push(<a key={m.index} href={m[3]} className="text-mint-700 underline underline-offset-2 dark:text-mint-400" {...(m[3]!.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{m[2]}</a>)
    else partes.push(<code key={m.index} className="rounded bg-neutral-100 px-1 py-0.5 text-[0.9em] dark:bg-neutral-800">{m[4]}</code>)
    ultimo = re.lastIndex
  }
  if (ultimo < s.length) partes.push(s.slice(ultimo))
  return partes
}

function renderizar(md: string): ReactNode[] {
  const bloques: ReactNode[] = []
  let lista: string[] = []
  let parrafo: string[] = []
  const cerrar = () => {
    if (parrafo.length) bloques.push(<p key={bloques.length}>{enLinea(parrafo.join(' '))}</p>)
    if (lista.length) bloques.push(<ul key={bloques.length} className="list-disc space-y-1.5 pl-5">{lista.map((l, i) => <li key={i}>{enLinea(l)}</li>)}</ul>)
    parrafo = []
    lista = []
  }
  for (const linea of md.split('\n')) {
    const l = linea.trimEnd()
    const h = /^(#{1,3})\s+(.*)$/.exec(l)
    if (h) {
      cerrar()
      const n = h[1]!.length
      const cls = n === 1 ? 'text-[1.75rem] font-semibold leading-tight tracking-tight text-graphite dark:text-white' : 'pt-2 text-lg font-semibold text-graphite dark:text-white'
      bloques.push(n === 1 ? <h1 key={bloques.length} className={cls}>{enLinea(h[2]!)}</h1> : <h2 key={bloques.length} className={cls}>{enLinea(h[2]!)}</h2>)
    } else if (/^>\s?/.test(l)) {
      cerrar()
      bloques.push(<p key={bloques.length} className="rounded-2xl border border-fats/40 bg-fats/10 px-4 py-3 text-sm text-graphite dark:text-neutral-100">{enLinea(l.replace(/^>\s?/, ''))}</p>)
    } else if (/^[-*]\s+/.test(l)) {
      if (parrafo.length) cerrar()
      lista.push(l.replace(/^[-*]\s+/, ''))
    } else if (!l.trim() || /^---+$/.test(l)) cerrar()
    else {
      if (lista.length) cerrar()
      parrafo.push(l.trim())
    }
  }
  cerrar()
  return bloques
}

export default function Privacidad() {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-5 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <a href="/" className="-ml-2 mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
        <ArrowLeft size={18} /> Volver
      </a>
      <article className="mt-6 space-y-4 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-300">{renderizar(texto)}</article>
    </div>
  )
}
