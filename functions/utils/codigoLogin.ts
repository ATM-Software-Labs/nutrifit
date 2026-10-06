/**
 * Código de 6 cifras para iniciar sesión (va en el mismo email que el magic link).
 *
 *  · Generación uniforme 000000–999999 con WebCrypto (muestreo por rechazo).
 *  · En D1 solo HMAC-SHA256(AUTH_SECRET, propósito "codigo", "id:email:código").
 *  · 15 min (como el enlace), un solo uso, máx. 5 intentos fallidos: el intento
 *    se cuenta ANTES de comparar (UPDATE atómico) y al 5.º fallo se invalida.
 *  · Comparación en tiempo constante.
 *  · Pedir un código nuevo invalida los anteriores de ese email.
 */
import type { Env } from './env.ts'
import { base64urlEncode, bytesAleatorios, hmacSha256, timingSafeEqual } from './crypto.ts'
import { authSecret } from './session.ts'
import { DURACION_MAGIC } from './magicLink.ts'

export const MAX_INTENTOS_CODIGO = 5

export function generarCodigo(): string {
  const limite = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000 // evita el sesgo del módulo
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0]!
    if (n < limite) return String(n % 1_000_000).padStart(6, '0')
  }
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

async function hashCodigo(env: Env, id: string, email: string, codigo: string): Promise<string> {
  return hex(await hmacSha256(authSecret(env), 'codigo', `${id}:${email.toLowerCase()}:${codigo}`))
}

/** Crea un código nuevo para `email` (invalidando los anteriores) y lo devuelve en claro. */
export async function crearCodigoLogin(env: Env, email: string, ahora = Math.floor(Date.now() / 1000)): Promise<string> {
  const codigo = generarCodigo()
  const id = base64urlEncode(bytesAleatorios(16))
  await env.DB.batch([
    env.DB.prepare('UPDATE codigos_login SET usado_en = ?1 WHERE email = ?2 AND usado_en IS NULL').bind(ahora, email),
    env.DB.prepare('INSERT INTO codigos_login (id, email, codigo_hash, expira_en) VALUES (?1, ?2, ?3, ?4)').bind(
      id,
      email,
      await hashCodigo(env, id, email, codigo),
      ahora + DURACION_MAGIC,
    ),
  ])
  return codigo
}

export type ResultadoCodigo = { ok: true; email: string } | { ok: false; motivo: 'invalido' | 'agotado' }

/**
 * Comprueba el código. Respuestas indistinguibles para "no hay código", "caducado"
 * o "incorrecto" (motivo 'invalido'), salvo cuando se agotan los intentos.
 */
export async function verificarCodigoLogin(env: Env, email: string, codigo: string, ahora = Math.floor(Date.now() / 1000)): Promise<ResultadoCodigo> {
  if (!/^\d{6}$/.test(codigo)) return { ok: false, motivo: 'invalido' }
  // Cuenta el intento sobre el código vigente más reciente (atómico).
  const fila = await env.DB.prepare(
    `UPDATE codigos_login SET intentos = intentos + 1
      WHERE id = (SELECT id FROM codigos_login
                   WHERE email = ?1 AND usado_en IS NULL AND expira_en > ?2
                   ORDER BY creado_en DESC, rowid DESC LIMIT 1)
        AND intentos < ?3
      RETURNING id, codigo_hash, intentos`,
  )
    .bind(email, ahora, MAX_INTENTOS_CODIGO)
    .first<{ id: string; codigo_hash: string; intentos: number }>()
  if (!fila) return { ok: false, motivo: 'invalido' }

  const esperado = await hashCodigo(env, fila.id, email, codigo)
  if (!timingSafeEqual(esperado, fila.codigo_hash)) {
    if (fila.intentos >= MAX_INTENTOS_CODIGO) {
      await env.DB.prepare('UPDATE codigos_login SET usado_en = ?1 WHERE id = ?2 AND usado_en IS NULL').bind(ahora, fila.id).run()
      return { ok: false, motivo: 'agotado' }
    }
    return { ok: false, motivo: 'invalido' }
  }
  // Consumo de un solo uso (en carrera, solo una petición gana).
  const usado = await env.DB.prepare('UPDATE codigos_login SET usado_en = ?1 WHERE id = ?2 AND usado_en IS NULL AND expira_en > ?1 RETURNING email')
    .bind(ahora, fila.id)
    .first<{ email: string }>()
  if (!usado) return { ok: false, motivo: 'invalido' }
  return { ok: true, email: email.toLowerCase() }
}

/** Tras entrar por enlace o por código, invalida lo pendiente de esa petición (ambos canales). */
export async function cerrarSolicitudesLogin(env: Env, email: string, ahora = Math.floor(Date.now() / 1000)): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('UPDATE codigos_login SET usado_en = ?1 WHERE email = ?2 AND usado_en IS NULL').bind(ahora, email),
    env.DB.prepare('UPDATE magic_tokens SET usado_en = ?1 WHERE email = ?2 AND usado_en IS NULL').bind(ahora, email),
  ])
}
