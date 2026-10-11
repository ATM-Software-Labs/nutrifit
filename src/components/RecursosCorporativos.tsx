import { useState, type ReactNode } from 'react'
import { Logo } from './Logo.tsx'
import { Button } from './ui/Button.tsx'

import dossierMd from '../../docs/legal/01_DOSSIER_CORPORATIVO_NUTRIFIT.md?raw'
import terminosMd from '../../docs/legal/02_TERMINOS_Y_CONDICIONES_SERVICIO.md?raw'
import privacidadMd from '../../docs/legal/03_POLITICA_PRIVACIDAD_Y_RGPD.md?raw'
import dpaMd from '../../docs/legal/04_ACUERDO_PROCESAMIENTO_DATOS_DPA.md?raw'
import seguridadMd from '../../docs/legal/05_SEGURIDAD_CIFRADO_ARQUITECTURA_LOCAL_FIRST.md?raw'
import slaMd from '../../docs/legal/06_ACUERDO_NIVEL_SERVICIO_SLA.md?raw'
import marcaMd from '../../docs/legal/07_DIRECTRICES_MARCA_Y_RECURSOS.md?raw'

interface DocumentoLegal {
  id: string
  titulo: string
  categoria: string
  contenido: string
  nombreArchivo: string
}

const DOCUMENTOS: DocumentoLegal[] = [
  {
    id: 'dossier',
    titulo: 'Dossier Corporativo y Arquitectura',
    categoria: 'Corporativo',
    contenido: dossierMd,
    nombreArchivo: 'NutriFit_Dossier_Corporativo.md',
  },
  {
    id: 'terminos',
    titulo: 'Términos de Servicio',
    categoria: 'Legal',
    contenido: terminosMd,
    nombreArchivo: 'NutriFit_Terminos_Servicio.md',
  },
  {
    id: 'privacidad',
    titulo: 'Política de Privacidad RGPD',
    categoria: 'Privacidad',
    contenido: privacidadMd,
    nombreArchivo: 'NutriFit_Politica_Privacidad_RGPD.md',
  },
  {
    id: 'dpa',
    titulo: 'Acuerdo Procesamiento de Datos (DPA)',
    categoria: 'Cumplimiento',
    contenido: dpaMd,
    nombreArchivo: 'NutriFit_DPA_Art28_RGPD.md',
  },
  {
    id: 'seguridad',
    titulo: 'Seguridad y Cifrado Local-First',
    categoria: 'Seguridad',
    contenido: seguridadMd,
    nombreArchivo: 'NutriFit_Seguridad_Cifrado.md',
  },
  {
    id: 'sla',
    titulo: 'Acuerdo de Nivel de Servicio (SLA 99.9%)',
    categoria: 'Garantías',
    contenido: slaMd,
    nombreArchivo: 'NutriFit_SLA_Acuerdo_Servicio.md',
  },
  {
    id: 'marca',
    titulo: 'Recursos de Marca y Assets',
    categoria: 'Branding',
    contenido: marcaMd,
    nombreArchivo: 'NutriFit_Directrices_Marca.md',
  },
]

function enLinea(s: string): ReactNode[] {
  const partes: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*|mailto:[^)\s]+)\)|`([^`]+)`/g
  let ultimo = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > ultimo) partes.push(s.slice(ultimo, m.index))
    if (m[1]) partes.push(<strong key={m.index} className="font-semibold text-graphite dark:text-neutral-100">{m[1]}</strong>)
    else if (m[2]) partes.push(<a key={m.index} href={m[3]} className="text-mint-700 underline underline-offset-2 dark:text-mint-400" {...(m[3]!.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{m[2]}</a>)
    else partes.push(<code key={m.index} className="rounded bg-neutral-100 px-1 py-0.5 text-[0.85em] dark:bg-neutral-800">{m[4]}</code>)
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
      const cls = n === 1 ? 'text-2xl font-bold tracking-tight text-graphite dark:text-white mt-2 mb-4' : n === 2 ? 'text-lg font-semibold text-graphite dark:text-white mt-6 mb-2 border-b border-neutral-200 dark:border-neutral-800 pb-1' : 'text-base font-semibold text-graphite dark:text-white mt-4 mb-1'
      bloques.push(n === 1 ? <h1 key={bloques.length} className={cls}>{enLinea(h[2]!)}</h1> : n === 2 ? <h2 key={bloques.length} className={cls}>{enLinea(h[2]!)}</h2> : <h3 key={bloques.length} className={cls}>{enLinea(h[2]!)}</h3>)
    } else if (/^>\s?/.test(l)) {
      cerrar()
      bloques.push(<p key={bloques.length} className="rounded-xl border border-mint/30 bg-mint/5 px-4 py-3 text-sm text-graphite dark:text-neutral-100">{enLinea(l.replace(/^>\s?/, ''))}</p>)
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

export default function RecursosCorporativos() {
  const [docActivo, setDocActivo] = useState<DocumentoLegal>(DOCUMENTOS[0])

  const descargarDoc = () => {
    const blob = new Blob([docActivo.contenido], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = docActivo.nombreArchivo
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <Logo size={36} className="text-graphite dark:text-neutral-100" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-graphite dark:text-white">Recursos Corporativos & Legal</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">NutriFit Enterprise · Repositorio y Google Drive: <code className="text-mint font-mono">nutrifit@trujillomingorance.com</code></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={descargarDoc}>
            Descargar Markdown ↓
          </Button>
          <a
            href="/"
            className="inline-flex items-center rounded-xl bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            ← Volver a la App
          </a>
        </div>
      </div>

      {/* Grid: Menú Lateral + Visor */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Selector de Documentos */}
        <nav className="flex flex-row overflow-x-auto gap-1.5 pb-2 lg:flex-col lg:overflow-visible lg:col-span-4" aria-label="Lista de documentos">
          {DOCUMENTOS.map((doc) => {
            const activo = doc.id === docActivo.id
            return (
              <button
                key={doc.id}
                onClick={() => setDocActivo(doc)}
                className={`flex flex-col text-left rounded-xl p-3 transition-colors ${
                  activo
                    ? 'bg-mint/10 border border-mint text-mint-900 dark:bg-mint/15 dark:text-mint-300 dark:border-mint/60'
                    : 'bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:border-neutral-800 dark:hover:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{doc.categoria}</span>
                  {activo && <span className="h-2 w-2 rounded-full bg-mint"></span>}
                </div>
                <span className="text-sm font-semibold mt-1 leading-snug">{doc.titulo}</span>
              </button>
            )
          })}

          {/* Tarjeta de Contacto Directo */}
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60 hidden lg:block">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">Canal Institucional</h4>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Para consultas corporativas, DPA o acuerdos SLA:</p>
            <a
              href="mailto:nutrifit@trujillomingorance.com"
              className="mt-2 block text-xs font-semibold text-mint hover:underline break-all"
            >
              nutrifit@trujillomingorance.com
            </a>
          </div>
        </nav>

        {/* Visor de Contenido */}
        <main className="lg:col-span-8 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-5 dark:border-neutral-800">
            <span className="text-xs font-medium text-neutral-400">Archivo: {docActivo.nombreArchivo}</span>
            <span className="text-xs rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">Oficial 2026</span>
          </div>
          <article className="space-y-4 text-[14.5px] leading-relaxed text-neutral-600 dark:text-neutral-300">
            {renderizar(docActivo.contenido)}
          </article>
        </main>
      </div>
    </div>
  )
}
