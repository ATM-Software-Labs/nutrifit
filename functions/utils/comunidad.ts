/**
 * Directorio público. El id y el email no salen de aquí.
 * `?1` es el usuario de la sesión y se reutiliza en la exclusión de amigos.
 */

/** Solo esquemas que el navegador puede pedir desde una <img>. */
export function avatarPublico(url: string | null): string | null {
  if (!url) return null
  const valor = url.trim()
  if (!valor) return null
  if (valor.startsWith('/api/archivos/') || valor.startsWith('data:image/')) return valor
  if (valor.startsWith('https://')) {
    try {
      if (new URL(valor).hostname) return valor
    } catch {
      return null
    }
  }
  return null
}

/**
 * Amigos ya aceptados, en las dos direcciones.
 * La tabla es `amistades` (migración 0007), no `friendships`.
 */
export const SQL_EXCLUIR_AMIGOS = `
  AND id NOT IN (
    SELECT receptor_id FROM amistades WHERE solicitante_id = ?1 AND estado = 'aceptada'
    UNION
    SELECT solicitante_id FROM amistades WHERE receptor_id = ?1 AND estado = 'aceptada'
  )`
