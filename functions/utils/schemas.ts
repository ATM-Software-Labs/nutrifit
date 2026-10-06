/**
 * Esquemas Zod de TODAS las entradas de la API. Nada llega a D1 ni a la IA sin
 * pasar por aquí. Reglas generales:
 *   · strings recortados, con longitud máxima y sin HTML (< >) ni caracteres de control;
 *   · números finitos dentro de rangos fisiológicamente coherentes;
 *   · fechas 'YYYY-MM-DD' reales.
 */
import { z } from 'zod'
import { NIVELES_ACTIVIDAD, OBJETIVOS, SEXOS } from '../../src/lib/macros.ts'

// ------------------------------------------------------------------ primitivas
const SIN_HTML = /^[^<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/

/** Texto recortado, 1..max caracteres, sin HTML. */
export const texto = (max: number, min = 1) =>
  z
    .string({ error: 'Debe ser un texto.' })
    .trim()
    .min(min, { error: min === 1 ? 'No puede estar vacío.' : `Mínimo ${min} caracteres.` })
    .max(max, { error: `Máximo ${max} caracteres.` })
    .regex(SIN_HTML, { error: 'Contiene caracteres no permitidos.' })

/** Número finito en [min, max]; acepta strings numéricos ("72.5"). */
export const numero = (min: number, max: number, nombre = 'El valor') =>
  z.coerce
    .number({ error: `${nombre} debe ser un número.` })
    .refine(Number.isFinite, { error: `${nombre} debe ser un número.` })
    .min(min, { error: `${nombre} debe ser ≥ ${min}.` })
    .max(max, { error: `${nombre} debe ser ≤ ${max}.` })

export const entero = (min: number, max: number, nombre = 'El valor') =>
  numero(min, max, nombre).int({ error: `${nombre} debe ser un número entero.` })

function esFechaReal(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 2020 && y <= 2100
}

export const fecha = z
  .string({ error: 'La fecha es obligatoria.' })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Formato de fecha inválido (YYYY-MM-DD).', abort: true })
  .refine(esFechaReal, { error: 'La fecha no existe.' })

export const uuid = z.uuid({ error: 'Identificador inválido.' })

export const email = z
  .string({ error: 'El email es obligatorio.' })
  .trim()
  .toLowerCase()
  .max(254, { error: 'Email demasiado largo.' })
  .pipe(z.email({ error: 'Email inválido.' }))

const turnstileToken = z.string().trim().max(4096).optional()

// --------------------------------------------------------------------- auth
export const solicitarSchema = z.object({ email, turnstileToken })

// ---------------------------------------------------------------- macros
export const calcularSchema = z.object({
  edad: entero(14, 100, 'La edad'),
  sexo: z.enum(SEXOS, { error: "Sexo debe ser 'hombre' o 'mujer'." }),
  peso: numero(30, 300, 'El peso'),
  altura: numero(120, 230, 'La altura'),
  actividad: z.enum(NIVELES_ACTIVIDAD, { error: 'Nivel de actividad inválido.' }),
  objetivo: z.enum(OBJETIVOS, { error: 'Objetivo inválido.' }),
})

export const perfilSchema = calcularSchema.extend({
  nombre: texto(60),
  turnstileToken,
})

// --------------------------------------------------------------- comidas
export const TIPOS_COMIDA = ['desayuno', 'comida', 'cena', 'snack'] as const

export const MAX = { calorias: 5000, proteinas: 500, carbohidratos: 1000, grasas: 500, gramos: 5000 } as const

export const ingredienteSchema = z.object({
  nombre: texto(80),
  gramos: numero(0, MAX.gramos, 'Los gramos'),
  calorias: numero(0, MAX.calorias, 'Las calorías').optional(),
  proteinas: numero(0, MAX.proteinas, 'Las proteínas').optional(),
  carbohidratos: numero(0, MAX.carbohidratos, 'Los carbohidratos').optional(),
  grasas: numero(0, MAX.grasas, 'Las grasas').optional(),
})

export const comidaGuardarSchema = z
  .object({
    tipo_comida: z.enum(TIPOS_COMIDA, { error: 'Tipo de comida inválido.' }),
    descripcion: texto(200),
    calorias: numero(0, MAX.calorias, 'Las calorías'),
    proteinas: numero(0, MAX.proteinas, 'Las proteínas'),
    carbohidratos: numero(0, MAX.carbohidratos, 'Los carbohidratos'),
    grasas: numero(0, MAX.grasas, 'Las grasas'),
    ingredientes: z.array(ingredienteSchema).max(30, { error: 'Máximo 30 ingredientes.' }).optional(),
    imagen_url: z
      .url({ protocol: /^https$/, error: 'La URL de imagen debe ser https.' })
      .max(500)
      .nullish(),
    fecha,
  })
  // Coherencia: los macros no pueden aportar MUCHAS más kcal que las declaradas
  // (se tolera lo contrario: alcohol, fibra, redondeos…).
  .refine((c) => c.proteinas * 4 + c.carbohidratos * 4 + c.grasas * 9 <= c.calorias * 1.4 + 50, {
    error: 'Los macros no cuadran con las calorías indicadas.',
    path: ['calorias'],
  })

export const resumenQuery = z.object({ fecha })

// ------------------------------------------------------------- peso y agua
export const pesoSchema = z.object({ peso: numero(30, 300, 'El peso'), fecha: fecha.optional() })
export const pesoQuery = z.object({ dias: entero(1, 365, 'Los días').default(30) })

export const aguaSchema = z.object({
  fecha,
  ml: entero(-5000, 10000, 'Los ml'),
  /** 'sumar' añade ml al total del día (widget +250 ml); 'fijar' lo sustituye. */
  modo: z.enum(['sumar', 'fijar']).default('sumar'),
})
export const aguaQuery = z.object({ fecha })

// ------------------------------------------------------------ análisis IA
export const MIME_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'] as const
export const analizarJsonSchema = z.object({
  /** base64 puro o data URL (data:image/jpeg;base64,…) */
  imagen: z.string().min(16).max(2_200_000),
  mime: z.enum(MIME_IMAGEN).optional(),
  turnstileToken,
})

// ------------------------------------------------------------------ helpers
export type Issue = { campo: string; mensaje: string }

export function formatearErrores(err: z.ZodError): Issue[] {
  return err.issues.slice(0, 10).map((i) => ({ campo: i.path.join('.') || '(raíz)', mensaje: i.message }))
}
