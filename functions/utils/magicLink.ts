/**
 * Magic links de un solo uso:
 *   token = base64url({e: email, j: jti, x: exp}) . HMAC-SHA256
 * En D1 solo se guarda SHA-256(jti). El consumo es atómico (UPDATE … RETURNING),
 * así que un enlace no puede usarse dos veces ni en carrera.
 */
import type { Env } from './env.ts'
import { base64urlEncode, bytesAleatorios, firmar, sha256Hex, verificarFirma } from './crypto.ts'
import { authSecret } from './session.ts'

export const DURACION_MAGIC = 4 * 3600 // 4 horas de validez

interface PayloadMagic {
  e: string
  j: string
  x: number
}

export async function crearMagicToken(env: Env, email: string): Promise<string> {
  const jti = base64urlEncode(bytesAleatorios(18))
  const exp = Math.floor(Date.now() / 1000) + DURACION_MAGIC
  await env.DB.prepare('INSERT INTO magic_tokens (jti_hash, email, expira_en) VALUES (?1, ?2, ?3)')
    .bind(await sha256Hex(jti), email, exp)
    .run()
  return firmar(authSecret(env), 'magic', { e: email, j: jti, x: exp } satisfies PayloadMagic)
}

export type ResultadoMagic = { ok: true; email: string } | { ok: false; motivo: 'invalido' | 'caducado' | 'usado' }

/** Verifica firma + caducidad y marca el token como usado (una sola vez). */
export async function consumirMagicToken(env: Env, token: string): Promise<ResultadoMagic> {
  const p = await verificarFirma<PayloadMagic>(authSecret(env), 'magic', token)
  if (!p || typeof p.e !== 'string' || typeof p.j !== 'string' || typeof p.x !== 'number') {
    return { ok: false, motivo: 'invalido' }
  }
  const ahora = Math.floor(Date.now() / 1000)
  if (p.x <= ahora) return { ok: false, motivo: 'caducado' }

  const fila = await env.DB.prepare(
    `UPDATE magic_tokens SET usado_en = ?1
       WHERE jti_hash = ?2 AND usado_en IS NULL AND expira_en > ?1 AND email = ?3
     RETURNING email`,
  )
    .bind(ahora, await sha256Hex(p.j), p.e)
    .first<{ email: string }>()
  if (!fila) return { ok: false, motivo: 'usado' }
  return { ok: true, email: p.e }
}

