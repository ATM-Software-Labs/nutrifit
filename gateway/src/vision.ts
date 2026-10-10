/**
 * POST /nutrifit/vision.
 * El prompt es el de orquestarEscaneo (capa clínica ya fija). Aquí no se
 * concatena EXIF, nombre de archivo ni texto del cliente.
 */
import type { Env } from '../../functions/utils/env.ts'
import { conContextoVision, MENSAJE_PESO, respuestaFalloVision, TITULO_PESO } from '../../functions/utils/errorVision.ts'
import { contieneScriptPoliglota, detectarMime } from '../../functions/utils/ia.ts'
import { quitarMetadatosImagen } from '../../functions/utils/metadatosImagen.ts'
import { guardarPlatoCache, huellaImagen, orquestarEscaneo } from '../../functions/utils/orquestadorVision.ts'
import { HttpError, json } from '../../functions/utils/response.ts'
import type { ContextoGateway, GatewayEnv } from './env.ts'
import { MAX_VISION_BYTES } from './politica.ts'
import { falloFormato, falloTicket, falloUpstream, jsonFallo } from './respuesta.ts'

export type LlamadaVision = { tipo: 'servicio' } | { tipo: 'ticket'; sub: string; img: string }

function comoEnv(env: GatewayEnv): Env {
  return env as unknown as Env
}

async function leerBytes(request: Request): Promise<Uint8Array> {
  const declarado = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declarado) && declarado > MAX_VISION_BYTES) throw new HttpError(413, 'payload')
  if (!request.body) throw new HttpError(400, 'vacio')
  const reader = request.body.getReader()
  const trozos: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_VISION_BYTES) {
      await reader.cancel()
      throw new HttpError(413, 'payload')
    }
    trozos.push(value)
  }
  if (total === 0) throw new HttpError(400, 'vacio')
  const buf = new Uint8Array(total)
  let off = 0
  for (const t of trozos) {
    buf.set(t, off)
    off += t.byteLength
  }
  return buf
}

function traducir(e: unknown): Response {
  if (e instanceof HttpError && e.status === 413) return jsonFallo(413, {
    code: 'PAYLOAD_TOO_LARGE',
    status: 413,
    user_title: TITULO_PESO,
    user_message: MENSAJE_PESO,
    retry_after_seconds: 0,
  }, 'payload_too_large')
  if (e instanceof HttpError && e.status === 400) return falloFormato()
  const res = respuestaFalloVision(e)
  if (res) return res
  console.error('[gateway] error no controlado')
  return falloUpstream(500)
}

export async function analizarVision(request: Request, env: GatewayEnv, ctx: ContextoGateway, quien: LlamadaVision): Promise<Response> {
  let bytes: Uint8Array
  try {
    bytes = await leerBytes(request)
  } catch (e) {
    return traducir(e)
  }
  const clave = await huellaImagen(bytes)
  if (quien.tipo === 'ticket' && clave !== `ia:${quien.img}`) return falloTicket()
  return conContextoVision(request, bytes.byteLength, async () => {
    try {
      const mime = detectarMime(bytes)
      if (!mime || contieneScriptPoliglota(bytes)) return falloFormato()
      const limpio = quitarMetadatosImagen(bytes, mime)
      const mimeLimpio = limpio ? detectarMime(limpio) : null
      if (!limpio || !mimeLimpio || contieneScriptPoliglota(limpio)) return falloFormato()
      const plato = await orquestarEscaneo(comoEnv(env), { bytes: limpio, mime: mimeLimpio })
      if (env.DB) ctx.waitUntil(guardarPlatoCache(comoEnv(env), clave, plato).catch(() => undefined))
      return json(plato)
    } catch (e) {
      return traducir(e)
    }
  })
}
