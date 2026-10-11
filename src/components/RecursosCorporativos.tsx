import { useState, type ReactNode } from 'react'
import { Logo } from './Logo.tsx'
import { Button } from './ui/Button.tsx'
import { ArrowLeft, Check, Copy, Download, ExternalLink, FileText, ShieldCheck } from 'lucide-react'

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
  descripcion: string
}

const DOCUMENTOS: DocumentoLegal[] = [
  {
    id: 'dossier',
    titulo: 'Dossier Corporativo y Arquitectura',
    categoria: 'Corporativo',
    contenido: dossierMd,
    nombreArchivo: 'NutriFit_Dossier_Corporativo.md',
    descripcion: 'Visión de empresa, arquitectura Edge y soberanía de datos.',
  },
  {
    id: 'terminos',
    titulo: 'Términos de Servicio',
    categoria: 'Legal',
    contenido: terminosMd,
    nombreArchivo: 'NutriFit_Terminos_Servicio.md',
    descripcion: 'Condiciones de uso, licencias y alcance del servicio.',
  },
  {
    id: 'privacidad',
    titulo: 'Política de Privacidad RGPD',
    categoria: 'Privacidad',
    contenido: privacidadMd,
    nombreArchivo: 'NutriFit_Politica_Privacidad_RGPD.md',
    descripcion: 'Cumplimiento del RGPD, derechos ARCO y retención cero.',
  },
  {
    id: 'dpa',
    titulo: 'Acuerdo Procesamiento de Datos (DPA)',
    categoria: 'Cumplimiento',
    contenido: dpaMd,
    nombreArchivo: 'NutriFit_DPA_Art28_RGPD.md',
    descripcion: 'Contrato Art. 28 RGPD para empresas y nutricionistas.',
  },
  {
    id: 'seguridad',
    titulo: 'Seguridad y Cifrado Local-First',
    categoria: 'Seguridad',
    contenido: seguridadMd,
    nombreArchivo: 'NutriFit_Seguridad_Cifrado.md',
    descripcion: 'Arquitectura criptográfica, tokens HMAC y modelo Zero-Trust.',
  },
  {
    id: 'sla',
    titulo: 'Acuerdo de Nivel de Servicio (SLA 99.9%)',
    categoria: 'Garantías',
    contenido: slaMd,
    nombreArchivo: 'NutriFit_SLA_Acuerdo_Servicio.md',
    descripcion: 'Métricas de disponibilidad, tiempos de respuesta y soporte.',
  },
  {
    id: 'marca',
    titulo: 'Recursos de Marca y Assets',
    categoria: 'Branding',
    contenido: marcaMd,
    nombreArchivo: 'NutriFit_Directrices_Marca.md',
    descripcion: 'Logotipos vectoriales, paleta cromática y guía de estilo.',
  },
]

function enLinea(s: string): ReactNode[] {
  const partes: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*|mailto:[^)\s]+)\)|`([^`]+)`/g
  let ultimo = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > ultimo) partes.push(s.slice(ultimo, m.index))
    if (m[1]) {
      partes.push(<strong key={m.index} className="font-semibold text-graphite dark:text-neutral-100">{m[1]}</strong>)
    } else if (m[2]) {
      partes.push(<em key={m.index} className="italic text-neutral-800 dark:text-neutral-200">{m[2]}</em>)
    } else if (m[3]) {
      partes.push(
        <a
          key={m.index}
          href={m[4]}
          className="font-medium text-mint underline underline-offset-2 hover:text-mint-700 dark:hover:text-mint-300 transition-colors"
          {...(m[4]!.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {m[3]}
        </a>
      )
    } else if (m[5]) {
      partes.push(
        <code key={m.index} className="rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[0.85em] text-mint-800 dark:text-mint-300 border border-neutral-200/60 dark:border-neutral-700/60">
          {m[5]}
        </code>
      )
    }
    ultimo = re.lastIndex
  }
  if (ultimo < s.length) partes.push(s.slice(ultimo))
  return partes
}

function esFilaTabla(linea: string): boolean {
  const l = linea.trim()
  return l.startsWith('|') && l.endsWith('|') && l.length > 2
}

function esSeparadorTabla(linea: string): boolean {
  const l = linea.trim()
  return /^\|(?:\s*:?-+:?\s*\|)+$/.test(l)
}

function parsearCeldas(linea: string): string[] {
  const l = linea.trim()
  return l.slice(1, -1).split('|').map((c) => c.trim())
}

function parsearAlineacion(separador: string): ('left' | 'center' | 'right')[] {
  const celdas = separador.slice(1, -1).split('|').map((c) => c.trim())
  return celdas.map((c) => {
    const inicia = c.startsWith(':')
    const termina = c.endsWith(':')
    if (inicia && termina) return 'center'
    if (termina) return 'right'
    return 'left'
  })
}

function claseAlineacion(align?: 'left' | 'center' | 'right'): string {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

function renderizar(md: string): ReactNode[] {
  const bloques: ReactNode[] = []
  let listaUnord: string[] = []
  let listaOrd: string[] = []
  let cita: string[] = []
  let parrafo: string[] = []
  let tabla: string[] = []
  let enCodigo = false
  let codigoLineas: string[] = []

  const vaciar = () => {
    if (parrafo.length) {
      bloques.push(<p key={bloques.length} className="leading-relaxed text-neutral-700 dark:text-neutral-300">{enLinea(parrafo.join(' '))}</p>)
      parrafo = []
    }
    if (listaUnord.length) {
      bloques.push(
        <ul key={bloques.length} className="my-3 list-disc space-y-1.5 pl-5 text-neutral-700 dark:text-neutral-300">
          {listaUnord.map((l, i) => <li key={i} className="pl-1 leading-relaxed">{enLinea(l)}</li>)}
        </ul>
      )
      listaUnord = []
    }
    if (listaOrd.length) {
      bloques.push(
        <ol key={bloques.length} className="my-3 list-decimal space-y-1.5 pl-5 text-neutral-700 dark:text-neutral-300">
          {listaOrd.map((l, i) => <li key={i} className="pl-1 leading-relaxed">{enLinea(l)}</li>)}
        </ol>
      )
      listaOrd = []
    }
    if (cita.length) {
      bloques.push(
        <div key={bloques.length} className="my-4 rounded-xl border border-mint/25 bg-mint/5 p-4 text-sm text-graphite dark:text-neutral-200 leading-relaxed shadow-sm">
          {enLinea(cita.join(' '))}
        </div>
      )
      cita = []
    }
    if (tabla.length >= 2 && esSeparadorTabla(tabla[1])) {
      const headers = parsearCeldas(tabla[0])
      const align = parsearAlineacion(tabla[1])
      const filas = tabla.slice(2).map(parsearCeldas)
      bloques.push(
        <div key={bloques.length} className="my-5 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700/80 text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className={`px-4 py-3 ${claseAlineacion(align[i])}`}>
                    {enLinea(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300">
              {filas.map((f, rIdx) => (
                <tr key={rIdx} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors">
                  {f.map((c, cIdx) => (
                    <td key={cIdx} className={`px-4 py-3 leading-relaxed ${claseAlineacion(align[cIdx])}`}>
                      {enLinea(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      tabla = []
    } else if (tabla.length > 0) {
      for (const t of tabla) bloques.push(<p key={bloques.length}>{enLinea(t)}</p>)
      tabla = []
    }
    if (codigoLineas.length) {
      bloques.push(
        <pre key={bloques.length} className="my-4 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900 p-4 font-mono text-xs text-neutral-200">
          <code>{codigoLineas.join('\n')}</code>
        </pre>
      )
      codigoLineas = []
    }
  }

  for (const rawLinea of md.split('\n')) {
    const l = rawLinea.trimEnd()

    // Bloques de código ```
    if (/^```/.test(l)) {
      if (enCodigo) {
        enCodigo = false
        vaciar()
      } else {
        vaciar()
        enCodigo = true
      }
      continue
    }
    if (enCodigo) {
      codigoLineas.push(rawLinea)
      continue
    }

    // Tablas Markdown | ... |
    if (esFilaTabla(l)) {
      if (parrafo.length || listaUnord.length || listaOrd.length || cita.length) vaciar()
      tabla.push(l)
      continue
    }
    if (tabla.length > 0) {
      vaciar()
    }

    // Encabezados
    const h = /^(#{1,4})\s+(.*)$/.exec(l)
    if (h) {
      vaciar()
      const n = h[1]!.length
      const texto = h[2]!
      if (n === 1) {
        bloques.push(
          <h1 key={bloques.length} className="mt-2 mb-4 text-2xl font-bold tracking-tight text-graphite dark:text-white">
            {enLinea(texto)}
          </h1>
        )
      } else if (n === 2) {
        bloques.push(
          <h2 key={bloques.length} className="mt-8 mb-3 border-b border-neutral-200 pb-2 text-lg font-bold text-graphite dark:border-neutral-800 dark:text-white">
            {enLinea(texto)}
          </h2>
        )
      } else if (n === 3) {
        bloques.push(
          <h3 key={bloques.length} className="mt-5 mb-2 text-base font-semibold text-graphite dark:text-white">
            {enLinea(texto)}
          </h3>
        )
      } else {
        bloques.push(
          <h4 key={bloques.length} className="mt-4 mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {enLinea(texto)}
          </h4>
        )
      }
      continue
    }

    // Línea horizontal
    if (/^---+$/.test(l)) {
      vaciar()
      bloques.push(<hr key={bloques.length} className="my-6 border-t border-neutral-200 dark:border-neutral-800" />)
      continue
    }

    // Cita / Callout
    if (/^>\s?/.test(l)) {
      if (parrafo.length || listaUnord.length || listaOrd.length) vaciar()
      cita.push(l.replace(/^>\s?/, ''))
      continue
    }

    // Lista ordenada (1. , 2. )
    const ordMatch = /^(\d+)\.\s+(.*)$/.exec(l)
    if (ordMatch) {
      if (parrafo.length || listaUnord.length || cita.length) vaciar()
      listaOrd.push(ordMatch[2]!)
      continue
    }

    // Lista desordenada (- , * )
    if (/^[-*]\s+/.test(l)) {
      if (parrafo.length || listaOrd.length || cita.length) vaciar()
      listaUnord.push(l.replace(/^[-*]\s+/, ''))
      continue
    }

    // Línea vacía
    if (!l.trim()) {
      vaciar()
      continue
    }

    // Texto de párrafo ordinario
    parrafo.push(l.trim())
  }

  vaciar()
  return bloques
}

export default function RecursosCorporativos() {
  const [docActivo, setDocActivo] = useState<DocumentoLegal>(DOCUMENTOS[0])
  const [copiado, setCopiado] = useState(false)

  const descargarDoc = () => {
    const blob = new Blob([docActivo.contenido], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = docActivo.nombreArchivo
    a.click()
    URL.revokeObjectURL(url)
  }

  const copiarEmail = () => {
    navigator.clipboard.writeText('nutrifit@trujillomingorance.com')
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 pb-20 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* Cabecera Principal */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div className="flex items-center gap-3.5">
          <Logo size={40} className="text-graphite dark:text-neutral-100" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-graphite dark:text-white">Recursos Corporativos & Legal</h1>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-mint/10 px-2 py-0.5 text-[11px] font-semibold text-mint-900 dark:text-mint-300">
                <ShieldCheck size={12} className="text-mint" />
                Empresas & DPA
              </span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              Repositorio oficial sincronizado en Google Drive: <code className="font-mono text-mint font-semibold">nutrifit@trujillomingorance.com</code>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={descargarDoc} className="gap-1.5 text-xs">
            <Download size={14} />
            Descargar .md
          </Button>
          <button
            type="button"
            onClick={copiarEmail}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
          >
            {copiado ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
            {copiado ? 'Email Copiado' : 'Copiar Email'}
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-1 rounded-xl bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <ArrowLeft size={14} />
            Volver a la App
          </a>
        </div>
      </header>

      {/* Grid: Menú Lateral + Visor */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Selector de Documentos */}
        <aside className="lg:col-span-4 flex flex-row overflow-x-auto gap-2 pb-2 lg:flex-col lg:overflow-visible" aria-label="Lista de documentos">
          {DOCUMENTOS.map((doc) => {
            const activo = doc.id === docActivo.id
            return (
              <button
                key={doc.id}
                onClick={() => setDocActivo(doc)}
                className={`flex flex-col text-left rounded-2xl p-3.5 transition-all shrink-0 w-64 lg:w-full ${
                  activo
                    ? 'bg-mint/10 border-2 border-mint text-mint-950 dark:bg-mint/15 dark:text-mint-200 dark:border-mint shadow-sm'
                    : 'bg-white border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/70 text-neutral-700 dark:bg-neutral-900 dark:border-neutral-800 dark:hover:bg-neutral-800/80 dark:text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    {doc.categoria}
                  </span>
                  {activo ? (
                    <span className="h-2 w-2 rounded-full bg-mint" />
                  ) : (
                    <FileText size={14} className="text-neutral-400" />
                  )}
                </div>
                <span className="text-sm font-semibold mt-1.5 leading-snug text-graphite dark:text-white">
                  {doc.titulo}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1">
                  {doc.descripcion}
                </span>
              </button>
            )
          })}

          {/* Tarjeta de Contacto Institucional */}
          <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60 hidden lg:block">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-mint" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                Canal Oficial NutriFit
              </h4>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Para formalizaciones corporativas, firma de acuerdos DPA (Art. 28 RGPD) o acuerdos SLA garantizados:
            </p>
            <a
              href="mailto:nutrifit@trujillomingorance.com"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-mint hover:underline break-all"
            >
              nutrifit@trujillomingorance.com
              <ExternalLink size={12} />
            </a>
          </div>
        </aside>

        {/* Visor de Contenido Principal */}
        <main className="lg:col-span-8 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-10 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4 mb-6 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/10 px-2.5 py-1 text-xs font-semibold text-mint-900 dark:text-mint-300">
                <span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" />
                Documento Corporativo Verificado
              </span>
              <span className="hidden sm:inline text-xs font-mono text-neutral-400 dark:text-neutral-500">
                {docActivo.nombreArchivo}
              </span>
            </div>
            <span className="text-xs rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 font-medium">
              Vigencia 2026
            </span>
          </div>

          <article className="space-y-4 text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">
            {renderizar(docActivo.contenido)}
          </article>
        </main>
      </div>
    </div>
  )
}
