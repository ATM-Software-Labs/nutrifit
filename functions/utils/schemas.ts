/**
 * Esquemas Zod de TODAS las entradas de la API. Nada llega a D1 ni a la IA sin
 * pasar por aquí. Reglas generales:
 *   · strings recortados, con longitud máxima y sin HTML (< >);
 *   · saltos y controles se aplastan a espacio (no hay shell: esto corta CRLF,
 *     caracteres de control e inyección de cabeceras si un texto se reutiliza);
 *   · números finitos dentro de rangos fisiológicamente coherentes;
 *   · fechas 'YYYY-MM-DD' reales;
 *   · objetos JSON con tope de profundidad y sin claves de prototipo.
 */
import { z } from 'zod'
import { NIVELES_ACTIVIDAD, OBJETIVOS, SEXOS } from '../../src/lib/macros.ts'
import { sanitizarTextoLibre } from './sanitizar.ts'

// ------------------------------------------------------------------ primitivas
const SIN_HTML = /^[^<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/

/**
 * Texto 1..max. Controles y saltos pasan a un espacio (mitiga CRLF y metacaracteres
 * de control). Sigue sin HTML. `&` y comillas se quedan: son comida, no un shell.
 */
export const texto = (max: number, min = 1) =>
  z
    .string({ error: 'Debe ser un texto.' })
    .transform((s) => s.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/[ \t\f\v]+/g, ' ').trim())
    .pipe(
      z
        .string()
        .min(min, { error: min === 1 ? 'No puede estar vacío.' : `Mínimo ${min} caracteres.` })
        .max(max, { error: `Máximo ${max} caracteres.` })
        .regex(SIN_HTML, { error: 'Contiene caracteres no permitidos.' }),
    )

/**
 * Bio, nombres y comentarios. Quita etiquetas y `<>` antes de guardar.
 * La respuesta de la API vuelve a pasar por `escaparHtml`.
 */
export const textoLibre = (max: number, min = 0) =>
  z
    .string({ error: 'Debe ser un texto.' })
    .transform((s) => sanitizarTextoLibre(s))
    .pipe(
      z
        .string()
        .min(min, { error: min === 0 ? 'Texto no válido.' : min === 1 ? 'No puede estar vacío.' : `Mínimo ${min} caracteres.` })
        .max(max, { error: `Máximo ${max} caracteres.` }),
    )

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
export const solicitarSchema = z.object({
  email,
  turnstileToken,
  /** 'app' → el enlace apunta a /app-login (App Link de Android) en vez de a la web. */
  cliente: z.enum(['web', 'app']).default('web'),
})

const tokenFirmado = z
  .string()
  .trim()
  .min(20, { error: 'Enlace no válido.' })
  .max(2048, { error: 'Enlace no válido.' })
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, { error: 'Enlace no válido.' })

/** Canje del token del magic link por un token Bearer (app Android). */
export const canjeTokenSchema = z.object({
  token: tokenFirmado,
})

/** GET /api/auth/verificar?token= — misma forma que el canje, sin ejecutar nada si no cuadra. */
export const verificarQuery = z.object({ token: tokenFirmado })

/** Código de 6 cifras del email (se aceptan espacios: «123 456»). */
export const codigoSchema = z.object({
  email,
  codigo: z
    .string({ error: 'Escribe el código.' })
    .transform((c) => c.replace(/\s+/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, { error: 'El código tiene 6 cifras.' })),
  cliente: z.enum(['web', 'app']).default('web'),
})

// ------------------------------------------------------------ login por QR
const base64url43 = z.string().regex(/^[A-Za-z0-9_-]{43}$/, { error: 'Identificador inválido.' }) // 32 bytes
export const qrCrearSchema = z.object({ secretoHash: z.string().regex(/^[a-f0-9]{64}$/, { error: 'Secreto inválido.' }) })
export const qrEstadoSchema = z.object({ id: base64url43, secreto: base64url43 })
export const qrIdQuery = z.object({ id: base64url43 })
export const qrDecidirSchema = z.object({ id: base64url43, aprobar: z.boolean({ error: 'Falta la decisión.' }) })

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
  input_query: texto(200).optional(),
  display_name: texto(80).optional(),
  serving_description: texto(80).optional(),
  gramos: numero(0, MAX.gramos, 'Los gramos'),
  min_gramos: numero(0, MAX.gramos, 'Los gramos').optional(),
  max_gramos: numero(0, MAX.gramos, 'Los gramos').optional(),
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
      .union([
        z.string().regex(/^\/api\/archivos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
          error: 'La foto del plato no es válida.',
        }),
        z.url({ protocol: /^https$/, error: 'La URL de imagen debe ser https.' }).max(500),
      ])
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

// ------------------------------------------------------- historial y CSV
const rango = (maxDias: number) =>
  z
    .object({ desde: fecha, hasta: fecha })
    .refine((r) => r.desde <= r.hasta, { error: '«desde» no puede ser posterior a «hasta».', path: ['hasta'] })
    .refine((r) => (Date.parse(r.hasta) - Date.parse(r.desde)) / 86_400_000 < maxDias, { error: `El rango máximo es de ${maxDias} días.`, path: ['hasta'] })

export const historialQuery = rango(93)
export const exportarQuery = z.intersection(rango(366), z.object({ tipo: z.enum(['comidas', 'peso', 'agua'], { error: 'Tipo de exportación inválido.' }) }))
/** El cliente tiene que repetir esta palabra. Un POST vacío no borra la cuenta. */
export const eliminarCuentaSchema = z.strictObject({
  confirmar: z.literal('ELIMINAR', { error: 'Escribe ELIMINAR para confirmar el borrado.' }),
})

// ------------------------------------------------------------ análisis IA
export const MIME_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'] as const
export const analizarJsonSchema = z.object({
  /** base64 puro o data URL (data:image/jpeg;base64,…) */
  imagen: z.string().min(16).max(2_200_000),
  mime: z.enum(MIME_IMAGEN).optional(),
  turnstileToken,
})

export const analizarTextoSchema = z.object({
  descripcion: texto(300, 3),
  turnstileToken,
})

/** JSON de avatar, banner o foto. Rechaza usuario_id u otras claves coladas. */
export const subirImagenSchema = z.strictObject({
  imagen: z.string().min(16).max(2_600_000),
  mime: z.enum(MIME_IMAGEN).optional(),
})

// --------------------------------------------------------------- perfil social
export const RE_USERNAME = /^[a-zA-Z0-9_]{3,20}$/
export const usernameSchema = z
  .string({ error: 'El nombre de usuario es obligatorio.' })
  .trim()
  .regex(RE_USERNAME, { error: 'El usuario debe tener de 3 a 20 caracteres: letras, números o _.' })

const enteroOBool = z.union([z.literal(0), z.literal(1), z.boolean()]).transform((v) => (v === true || v === 1 ? 1 : 0))

export const socialSchema = z
  .strictObject({
    username: z.union([z.null(), usernameSchema]).optional(),
    bio: z.union([z.null(), textoLibre(160, 0)]).optional(),
    es_publico: enteroOBool.optional(),
    meta_agua_base_ml: entero(250, 10000, 'La meta de agua').optional(),
  })
  .refine((c) => Object.keys(c).length > 0, { error: 'No hay nada que guardar.' })

export const usernameQuery = z.strictObject({ username: usernameSchema })

/** Directorio público. La página la fija el servidor en 5 filas; aquí solo el índice. */
export const comunidadQuery = z.strictObject({
  pagina: z.coerce.number({ error: 'La página no es válida.' }).int().min(1).max(40).optional(),
})

// ------------------------------------------------------------ entrenamientos
/** 'deportes' y 'movilidad' se mantienen: el registro de ejercicios ya los envía. */
export const TIPOS_ENTRENO = ['fuerza', 'cardio', 'deportes', 'movilidad'] as const
export const INTENSIDADES = ['baja', 'media', 'alta'] as const

export const entrenamientoSchema = z
  .strictObject({
    tipo: z.enum(TIPOS_ENTRENO, { error: 'Tipo de entrenamiento inválido.' }),
    nombre: textoLibre(80, 1),
    minutos: entero(1, 600, 'La duración').optional(),
    duracion_min: entero(1, 600, 'La duración').optional(),
    intensidad: z.union([z.null(), z.enum(INTENSIDADES)]).optional(),
    calorias: entero(0, 5000, 'Las calorías'),
    origen: z.enum(['manual', 'salud', 'app']).optional(),
    fecha: fecha.optional(),
    comentario: textoLibre(200, 0).optional(),
  })
  .refine((e) => e.minutos != null || e.duracion_min != null, { error: 'Indica la duración.', path: ['duracion_min'] })
  .refine((e) => e.minutos == null || e.duracion_min == null || e.minutos === e.duracion_min, {
    error: 'La duración no cuadra.',
    path: ['duracion_min'],
  })

export const entrenamientosQuery = z.object({
  fecha: fecha.optional(),
  recientes: z.preprocess((v) => (v === undefined || v === '' ? undefined : Number(v)), z.number().int().min(1).max(30).optional()),
})

// ------------------------------------------------------- comidas frecuentes
const itemFrecuenteSchema = z.strictObject({
  nombre: textoLibre(80, 1),
  gramos: numero(0, MAX.gramos, 'Los gramos').optional(),
  calorias: numero(0, MAX.calorias, 'Las calorías').optional(),
  proteinas: numero(0, MAX.proteinas, 'Las proteínas').optional(),
  carbohidratos: numero(0, MAX.carbohidratos, 'Los carbohidratos').optional(),
  grasas: numero(0, MAX.grasas, 'Las grasas').optional(),
  comentario: textoLibre(200, 0).optional(),
})

export const comidaFrecuenteSchema = z.strictObject({
  tipo_comida: z.enum(TIPOS_COMIDA, { error: 'Tipo de comida inválido.' }),
  nombre: textoLibre(80, 1),
  items: z.array(itemFrecuenteSchema).max(30, { error: 'Máximo 30 ingredientes.' }).optional(),
  comentario: textoLibre(280, 0).optional(),
})

// ----------------------------------------------------------------- amistades
export const amistadSolicitudSchema = z.strictObject({ username: usernameSchema })
export const amistadEstadoSchema = z.strictObject({
  estado: z.enum(['aceptada', 'rechazada'], { error: 'Estado inválido.' }),
})

export const dispositivoSchema = z.strictObject({
  sesionId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,80}$/, { error: 'Sesión inválida.' }),
})

// ------------------------------------------------------- Open Food Facts
export const offQuery = z.union([
  z.object({ codigo: z.string().trim().regex(/^\d{8,14}$/, { error: 'El código de barras tiene de 8 a 14 cifras.' }) }),
  z.object({ q: texto(60, 2) }),
])

export const buscarQuery = z.object({ q: texto(60, 2) })

/** GET /api/alimentos/barcode?codigo= — EAN-8, EAN-13 o UPC. */
export const barcodeQuery = z.object({
  codigo: z.string().trim().regex(/^\d{8,14}$/, { error: 'El código de barras tiene de 8 a 14 cifras.' }),
})

const g100 = (nombre: string) => numero(0, 100, nombre)
const g100Opcional = (nombre: string) => z.union([z.null(), g100(nombre)]).optional().default(null)

/** Producto propio (p. ej. creado desde la foto de la etiqueta). Valores por 100 g/ml. */
export const productoSchema = z
  .object({
    codigo: z
      .union([z.null(), z.literal(''), z.string().trim().regex(/^\d{8,14}$/, { error: 'El código de barras tiene de 8 a 14 cifras.' })])
      .optional()
      .transform((v) => v || null),
    nombre: texto(100),
    marca: z.union([z.null(), z.literal(''), texto(60)]).optional().transform((v) => v || null),
    calorias: numero(0, 950, 'Las calorías'),
    proteinas: g100('Las proteínas'),
    carbohidratos: g100('Los hidratos'),
    grasas: g100('Las grasas'),
    azucares: g100Opcional('Los azúcares'),
    saturadas: g100Opcional('Las grasas saturadas'),
    fibra: g100Opcional('La fibra'),
    sal: g100Opcional('La sal'),
    racion: z.union([z.null(), numero(1, 2000, 'La ración')]).optional().default(null),
    envase: z.union([z.null(), numero(1, 10000, 'El envase')]).optional().default(null),
    unidad: z.enum(['g', 'ml']).default('g'),
  })
  .refine((p) => p.proteinas + p.carbohidratos + p.grasas <= 105, { error: 'Los macros suman más de 100 g por 100 g.', path: ['carbohidratos'] })
  .refine((p) => p.azucares === null || p.azucares <= p.carbohidratos + 0.5, { error: 'Los azúcares no pueden superar a los hidratos.', path: ['azucares'] })
  .refine((p) => p.saturadas === null || p.saturadas <= p.grasas + 0.5, { error: 'Las saturadas no pueden superar a las grasas.', path: ['saturadas'] })
export type ProductoEntrada = z.infer<typeof productoSchema>

// ------------------------------------------------------------------ helpers
export type Issue = { campo: string; mensaje: string }

export function formatearErrores(err: z.ZodError): Issue[] {
  return err.issues.slice(0, 10).map((i) => ({ campo: i.path.join('.') || '(raíz)', mensaje: i.message }))
}
