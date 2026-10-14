/**
 * Cascada silenciosa del escáner. El cliente solo ve el plato unificado:
 * ni cabecera de proveedor ni el 429 crudo de una pasarela.
 *
 *  1. Gemini (GEMINI_MODEL o gemini-flash-latest), abort a los 8 s.
 *  2. Workers AI si Gemini agota el plazo, responde 429/5xx o falla.
 *  3. Groq y, si también falla, Trujillo AI.
 * Una foto ilegible no sigue.
 */
import { z } from 'zod'
import type { Env } from './env.ts'
import { resumirFallos } from './errorVision.ts'
import { ErrorIA, pasoEscaneo, TIMEOUT_ESCANER_GEMINI_MS, TIMEOUT_ESCANER_MS, TIMEOUT_GATEWAY_FOTO_MS, type Imagen } from './ia.ts'
import { FotoIlegible, type ResultadoAnalisis } from './iaParseo.ts'
import { emojiComida, esEmojiValido } from '../../src/lib/miniaturaComida.ts'
import { CATEGORIAS_PLATO, categoriaDe, descripcionPlato, esCategoriaPlato, tituloGastronomico, type CategoriaPlato } from './tituloPlato.ts'

export interface PlatoEscaneo {
  alimento: string
  /** Desglose. Vacío cuando el título ya nombra el alimento. */
  descripcion: string
  categoria: CategoriaPlato
  emoji: string
  peso_aprox_g: number
  calorias: number
  macros: { proteinas: number; carbohidratos: number; grasas: number }
  alternativas: string[]
  /** Desglose con cantidades ("2 rebanadas de pan tostado"); gramos y macros ya suman todas las unidades. */
  items?: ItemPlato[]
}
export interface ItemPlato { nombre: string; gramos: number; calorias: number; proteinas: number; carbohidratos: number; grasas: number }

const itemSchema = z.strictObject({
  nombre: z.string().trim().min(1).max(80),
  gramos: z.number().finite().min(0).max(5000),
  calorias: z.number().finite().min(0).max(5000),
  proteinas: z.number().finite().min(0).max(500),
  carbohidratos: z.number().finite().min(0).max(1000),
  grasas: z.number().finite().min(0).max(500),
})

const platoSchema = z.strictObject({
  alimento: z.string().trim().min(1).max(40),
  descripcion: z.string().trim().max(200),
  categoria: z.enum(CATEGORIAS_PLATO),
  emoji: z.string().min(1).max(16),
  peso_aprox_g: z.number().finite().min(0).max(5000),
  calorias: z.number().finite().min(0).max(5000),
  macros: z.strictObject({
    proteinas: z.number().finite().min(0).max(500),
    carbohidratos: z.number().finite().min(0).max(1000),
    grasas: z.number().finite().min(0).max(500),
  }),
  alternativas: z.array(z.string().trim().min(1).max(80)).max(2),
  items: z.array(itemSchema).max(12).optional(),
})

const redondear = (n: number | undefined, max: number) => {
  if (n === undefined || !Number.isFinite(n) || n < 0) return 0
  return Math.min(max, Math.round(n * 10) / 10)
}

export function aPlato(r: ResultadoAnalisis): PlatoEscaneo {
  const peso = r.ingredientes.reduce((a, i) => a + (Number.isFinite(i.gramos) ? i.gramos : 0), 0)
  const nombres = r.ingredientes.map((i) => (i.display_name || i.nombre).trim()).filter((n) => n.length > 0)
  const crudo = (r.display_name || r.nombre_plato || '').trim()
  const alimento = tituloGastronomico(crudo, nombres)
  const descripcion = descripcionPlato(crudo, nombres, r.descripcion ?? '')
  const categoria = r.categoria && esCategoriaPlato(r.categoria) ? r.categoria : categoriaDe([alimento, descripcion, ...nombres], nombres.length)
  const alternativas = (r.alternativas ?? [])
    .map((a) => tituloGastronomico(a.nombre.trim()))
    .filter((n) => n.length > 0 && n.toLowerCase() !== alimento.toLowerCase())
    .slice(0, 2)
  return platoSchema.parse({
    alimento,
    descripcion,
    categoria,
    emoji: esEmojiValido(r.emoji) ? r.emoji : emojiComida({ descripcion: [alimento, descripcion].join(' '), categoria, ingredientes: nombres.map((nombre) => ({ nombre })), proteinas: r.proteinas, carbohidratos: r.carbohidratos, grasas: r.grasas }),
    peso_aprox_g: redondear(peso, 5000),
    calorias: redondear(r.calorias, 5000),
    macros: {
      proteinas: redondear(r.proteinas, 500),
      carbohidratos: redondear(r.carbohidratos, 1000),
      grasas: redondear(r.grasas, 500),
    },
    alternativas,
    items: r.ingredientes
      .filter((i) => (i.display_name || i.nombre || '').trim())
      .slice(0, 12)
      .map((i) => ({
        nombre: (i.display_name || i.nombre).trim().slice(0, 80),
        gramos: redondear(i.gramos, 5000),
        calorias: redondear(i.calorias, 5000),
        proteinas: redondear(i.proteinas, 500),
        carbohidratos: redondear(i.carbohidratos, 1000),
        grasas: redondear(i.grasas, 500),
      })),
  })
}

/** true si hay que probar la pasarela siguiente. Un rechazo definitivo se detiene. */
export function debeContinuarCascada(e: unknown): boolean {
  if (e instanceof FotoIlegible) return false
  if (e && typeof e === 'object' && (e as { definitivo?: boolean }).definitivo === true) return false
  return true
}

export async function cascadaEscaneo(pasos: (() => Promise<ResultadoAnalisis>)[]): Promise<ResultadoAnalisis> {
  const vistos: unknown[] = []
  for (const paso of pasos) {
    try {
      return await paso()
    } catch (e) {
      if (!debeContinuarCascada(e)) throw e
      vistos.push(e)
    }
  }
  const resumen = resumirFallos(vistos)
  const err = new ErrorIA(resumen.mensaje)
  err.codigo = resumen.codigo
  err.statusHttp = resumen.statusHttp
  err.latenciaMs = resumen.latenciaMs
  err.proveedor = resumen.proveedor
  throw err
}

/** Gemini 8 s → Workers AI 2 s → Groq → Trujillo. El primero válido gana. */
export function orquestarEscaneo(env: Env, img: Imagen): Promise<PlatoEscaneo> {
  const pasos = [
    () => pasoEscaneo(env, img, 'gemini', TIMEOUT_ESCANER_GEMINI_MS),
    () => pasoEscaneo(env, img, 'workers-ai', TIMEOUT_ESCANER_MS),
    () => pasoEscaneo(env, img, 'groq', TIMEOUT_GATEWAY_FOTO_MS),
    () => pasoEscaneo(env, img, 'trujillo', TIMEOUT_GATEWAY_FOTO_MS),
  ]
  return cascadaEscaneo(pasos).then(aPlato)
}

const TTL_PLATO_S = 30 * 24 * 3600

export async function huellaImagen(bytes: Uint8Array): Promise<string> {
  const copia = new Uint8Array(bytes.byteLength)
  copia.set(bytes)
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', copia))
  return `ia:${Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

export async function leerPlatoCache(env: Env, clave: string): Promise<PlatoEscaneo | null> {
  try {
    const fila = await env.DB.prepare('SELECT datos, expira_en FROM catalogo_alimentos_cache WHERE clave = ?1').bind(clave).first<{ datos: string; expira_en: number }>()
    if (!fila || fila.expira_en <= Math.floor(Date.now() / 1000)) return null
    const parsed = platoSchema.safeParse(JSON.parse(fila.datos))
    // Entradas anteriores al desglose por unidades no sirven: se vuelve a analizar.
    return parsed.success && parsed.data.items?.length ? parsed.data : null
  } catch {
    return null
  }
}

export async function guardarPlatoCache(env: Env, clave: string, plato: PlatoEscaneo): Promise<void> {
  const datos = JSON.stringify(platoSchema.parse(plato))
  if (datos.length > 200_000 || clave.length < 3 || clave.length > 120) return
  const ahora = Math.floor(Date.now() / 1000)
  await env.DB.prepare(
    `INSERT INTO catalogo_alimentos_cache (clave, tipo, datos, expira_en, actualizado)
     VALUES (?1, 'buscar', ?2, ?3, ?4)
     ON CONFLICT (clave) DO UPDATE SET datos = excluded.datos, tipo = excluded.tipo, expira_en = excluded.expira_en, actualizado = excluded.actualizado`,
  )
    .bind(clave, datos, ahora + TTL_PLATO_S, ahora)
    .run()
}
