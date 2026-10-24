/**
 * «Compartir mi día»: vista previa de la tarjeta (historia 9:16 o cuadrada), opciones de
 * privacidad, hoja nativa de compartir (Web Share con archivos) y alternativas: PNG, PDF,
 * copiar imagen, copiar texto y enlace público /d/<token> con caducidad.
 * La imagen se prepara ANTES de pulsar: iOS exige llamar a share() dentro del gesto.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, FileDown, ImageDown, Link2, Loader2, Share2, Type } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { Button } from './ui/Button.tsx'
import { Segmented } from './ui/Segmented.tsx'
import { useToast } from './ui/Toast.tsx'
import { cx } from './ui/cx.ts'
import { api } from '../lib/api.ts'
import { aplicarPrivacidad, PRIVACIDAD_POR_DEFECTO, textoDia, tituloDia, type Caducidad, type DiaCompartido, type OpcionesPrivacidad } from '../../functions/utils/compartir.ts'
import { aBase64, aBlob, descargar, dibujarTarjeta, nombreArchivo, pdfDelDia, prepararFuentes, type FormatoTarjeta } from '../lib/tarjetaDia.ts'

const CLAVE_OPCIONES = 'nf:compartir:opciones'
const leerOpciones = (): OpcionesPrivacidad => {
  try { return { ...PRIVACIDAD_POR_DEFECTO, ...(JSON.parse(localStorage.getItem(CLAVE_OPCIONES) ?? '{}') as Partial<OpcionesPrivacidad>) } } catch { return PRIVACIDAD_POR_DEFECTO }
}

function Interruptor({ on, onClick, label, detalle }: { on: boolean; onClick: () => void; label: string; detalle?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detalle && <p className="text-xs text-neutral-500 dark:text-neutral-400">{detalle}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${on ? 'bg-mint' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

const puedeCompartirArchivos = (f: File) => {
  try { return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] }) } catch { return false }
}

export function HojaCompartirDia({ abierto, fecha, onClose }: { abierto: boolean; fecha: string; onClose: () => void }) {
  const toast = useToast()
  const [base, setBase] = useState<DiaCompartido | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formato, setFormato] = useState<Exclude<FormatoTarjeta, 'og' | 'pdf'>>('historia')
  const [op, setOp] = useState<OpcionesPrivacidad>(leerOpciones)
  const [png, setPng] = useState<{ blob: Blob; url: string; file: File } | null>(null)
  const [expira, setExpira] = useState<Caducidad>('7d')
  const [enlace, setEnlace] = useState<{ url: string; expira_en: string | null } | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const vivo = useRef(true)

  useEffect(() => () => void (vivo.current = false), [])
  useEffect(() => {
    if (!abierto) return
    setBase(null); setError(null); setEnlace(null)
    let ok = true
    Promise.all([api.diaCompartible(fecha), prepararFuentes()])
      .then(([r]) => ok && setBase(r.dia))
      .catch((e: Error) => ok && setError(e.message || 'No se pudo cargar el día'))
    return () => void (ok = false)
  }, [abierto, fecha])
  useEffect(() => { try { localStorage.setItem(CLAVE_OPCIONES, JSON.stringify(op)) } catch { /* sin storage */ } setEnlace(null) }, [op])

  const dia = useMemo(() => (base ? aplicarPrivacidad(base, op) : null), [base, op])

  useEffect(() => {
    if (!dia) return
    let ok = true
    const cv = dibujarTarjeta(dia, formato)
    void aBlob(cv).then((blob) => {
      if (!ok) return
      const file = new File([blob], nombreArchivo(dia, formato, 'png'), { type: 'image/png' })
      setPng((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { blob, url: URL.createObjectURL(blob), file } })
    })
    return () => void (ok = false)
  }, [dia, formato])

  const marcarCopiado = (k: string) => { setCopiado(k); setTimeout(() => vivo.current && setCopiado(null), 1800) }
  const t = (k: keyof OpcionesPrivacidad) => () => setOp((o) => ({ ...o, [k]: !o[k] }))

  async function compartir() {
    if (!png || !dia) return
    if (puedeCompartirArchivos(png.file)) {
      try {
        await navigator.share({ files: [png.file], title: tituloDia(dia), text: 'Mi día en NutriFit 🌱' })
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { descargar(png.blob, png.file.name); toast({ mensaje: 'No se pudo abrir el menú de compartir. Imagen descargada.' }) }
      }
      return
    }
    // Sin Web Share con archivos (escritorio, Firefox): copiar la imagen o descargarla.
    if (await copiarImagen(true)) return
    descargar(png.blob, png.file.name)
    toast({ mensaje: 'Imagen descargada', tipo: 'exito' })
  }

  async function copiarImagen(silencio = false): Promise<boolean> {
    if (!png) return false
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('sin portapapeles')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png.blob })])
      marcarCopiado('imagen'); toast({ mensaje: 'Imagen copiada. Pégala en el chat.', tipo: 'exito' })
      return true
    } catch {
      if (!silencio) toast({ mensaje: 'Tu navegador no deja copiar imágenes. Descárgala.', tipo: 'error' })
      return false
    }
  }

  async function copiarTexto(texto: string, k: string, aviso: string) {
    try { await navigator.clipboard.writeText(texto); marcarCopiado(k); toast({ mensaje: aviso, tipo: 'exito' }) } catch { toast({ mensaje: 'No se pudo copiar', tipo: 'error' }) }
  }

  async function pdf() {
    if (!dia) return
    setOcupado('pdf')
    try { descargar(await pdfDelDia(dia), nombreArchivo(dia, 'resumen', 'pdf')) } catch { toast({ mensaje: 'No se pudo generar el PDF', tipo: 'error' }) } finally { setOcupado(null) }
  }

  async function crearEnlace() {
    if (!dia) return
    setOcupado('enlace')
    try {
      // Vista previa 1200×630 para WhatsApp, Telegram, X… (si pesa > 300 KB se usa la genérica).
      const og = await aBlob(dibujarTarjeta(dia, 'og'))
      const r = await api.crearEnlaceDia({ fecha, opciones: op, expira, og: og.size <= 300 * 1024 ? await aBase64(og) : undefined })
      if (vivo.current) setEnlace({ url: r.url, expira_en: r.expira_en })
    } catch (e) {
      toast({ mensaje: (e as Error).message || 'No se pudo crear el enlace', tipo: 'error' })
    } finally { if (vivo.current) setOcupado(null) }
  }

  async function compartirEnlace() {
    if (!enlace || !dia) return
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ url: enlace.url, title: tituloDia(dia) }); return } catch (e) { if ((e as Error).name === 'AbortError') return }
    }
    await copiarTexto(enlace.url, 'enlace', 'Enlace copiado')
  }

  const fechaCad = enlace?.expira_en ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(enlace.expira_en)) : null

  return (
    <Sheet abierto={abierto} onClose={onClose} titulo="Compartir mi día" descripcion="Solo emojis y números: nunca se comparten fotos." ancho="lg">
      {error ? (
        <p className="py-8 text-center text-sm text-neutral-500">{error}</p>
      ) : !dia ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-neutral-400" aria-label="Cargando" /></div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[minmax(0,15rem)_1fr]" data-testid="hoja-compartir">
          <div className="flex flex-col items-center gap-3">
            <Segmented label="Formato" valor={formato} onChange={setFormato} className="w-full" opciones={[{ valor: 'historia', etiqueta: 'Historia' }, { valor: 'cuadrado', etiqueta: 'Cuadrado' }]} />
            <div className={cx('w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm dark:border-neutral-800', formato === 'historia' ? 'aspect-[9/16] max-w-[13rem]' : 'aspect-square max-w-[15rem]')}>
              {png ? <img src={png.url} alt={`Tarjeta ${formato === 'historia' ? '1080×1920' : '1080×1080'} de ${tituloDia(dia)}`} className="h-full w-full object-contain" data-testid="vista-tarjeta" /> : <div className="h-full w-full animate-pulse bg-neutral-100 dark:bg-neutral-900" />}
            </div>
          </div>
          <div className="min-w-0">
            <Button block size="lg" icon={<Share2 size={18} />} onClick={() => void compartir()} disabled={!png} data-testid="compartir-imagen">Compartir imagen</Button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" icon={<ImageDown size={16} />} disabled={!png} onClick={() => png && descargar(png.blob, png.file.name)}>PNG</Button>
              <Button variant="outline" size="sm" icon={<FileDown size={16} />} loading={ocupado === 'pdf'} onClick={() => void pdf()}>PDF</Button>
              <Button variant="outline" size="sm" icon={copiado === 'imagen' ? <Check size={16} /> : <Copy size={16} />} disabled={!png} onClick={() => void copiarImagen()}>Copiar imagen</Button>
              <Button variant="outline" size="sm" icon={copiado === 'texto' ? <Check size={16} /> : <Type size={16} />} onClick={() => void copiarTexto(textoDia(dia), 'texto', 'Texto copiado con emojis')}>Copiar texto</Button>
            </div>

            <fieldset className="mt-4 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 px-4 dark:divide-neutral-800 dark:border-neutral-800">
              <legend className="sr-only">Privacidad</legend>
              <Interruptor label="Ocultar calorías" on={op.ocultarKcal} onClick={t('ocultarKcal')} />
              <Interruptor label="Ocultar peso y racha" on={op.ocultarPesoRacha} onClick={t('ocultarPesoRacha')} />
              <Interruptor label="Solo emojis" detalle="Sin nombres de alimentos" on={op.soloEmojis} onClick={t('soloEmojis')} />
              <Interruptor label="Mostrar mi nombre" detalle={base?.nombre ? `Solo el nombre: «${base.nombre}»` : 'No hay nombre en tu perfil'} on={op.mostrarNombre} onClick={t('mostrarNombre')} />
            </fieldset>

            <section className="mt-4 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900" aria-labelledby="titulo-enlace">
              <h3 id="titulo-enlace" className="flex items-center gap-2 text-sm font-semibold"><Link2 size={16} /> Enlace público (opcional)</h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Página de solo lectura con lo mismo que la tarjeta. No sale en buscadores. Puedes revocarlo en Ajustes › Privacidad.</p>
              {enlace ? (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <input readOnly value={enlace.url} aria-label="Enlace público" className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-card px-3 py-2 text-sm dark:border-neutral-700 dark:bg-card-dark" onFocus={(e) => e.currentTarget.select()} data-testid="url-enlace" />
                    <Button variant="outline" size="sm" icon={copiado === 'enlace' ? <Check size={16} /> : <Copy size={16} />} onClick={() => void copiarTexto(enlace.url, 'enlace', 'Enlace copiado')}>Copiar</Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-neutral-500">{fechaCad ? `Caduca el ${fechaCad}` : 'No caduca'}</p>
                    <Button size="sm" variant="ghost" icon={<Share2 size={16} />} onClick={() => void compartirEnlace()}>Compartir enlace</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Segmented label="Caducidad" valor={expira} onChange={setExpira} className="min-w-[12rem] flex-1" opciones={[{ valor: '1d', etiqueta: '1 día' }, { valor: '7d', etiqueta: '7 días' }, { valor: 'nunca', etiqueta: 'Nunca' }]} />
                  <Button size="sm" variant="outline" loading={ocupado === 'enlace'} onClick={() => void crearEnlace()} data-testid="crear-enlace">Crear enlace</Button>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </Sheet>
  )
}
