/**
 * Hash del contenido que se sincroniza. Ignora marcas de tiempo y el resto de
 * columnas que no cambian el significado del registro. El cliente y el Worker
 * usan el mismo canónico para que el ETag coincida.
 */

export type ValorHash = string | number | boolean | null

export function canonico(datos: Record<string, ValorHash>): string {
  const claves = Object.keys(datos).sort()
  return JSON.stringify(claves.map((k) => [k, datos[k]]))
}

export async function hashContenido(datos: Record<string, ValorHash>): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonico(datos)))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** If-None-Match o If-Match con el SHA-256 del contenido (con o sin comillas). */
export function hashEnviado(request: Request): string | null {
  for (const nombre of ['if-none-match', 'if-match']) {
    const raw = request.headers.get(nombre)
    if (!raw) continue
    for (const parte of raw.split(',')) {
      const m = /^(?:W\/)?"?([a-f0-9]{64})"?$/i.exec(parte.trim())
      if (m?.[1]) return m[1].toLowerCase()
    }
  }
  return null
}

export function conEtag(hash: string): HeadersInit {
  return { ETag: `"${hash}"` }
}

/** El registro actual ya es ese contenido: no hay cuerpo y no debe haber UPDATE. */
export function noModificado(hash: string): Response {
  return new Response(null, { status: 304, headers: { ETag: `"${hash}"`, 'Cache-Control': 'no-store' } })
}

export function camposPerfil(p: {
  nombre: string
  edad: number
  sexo: string
  peso: number
  altura: number
  actividad: string
  objetivo: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
}): Record<string, ValorHash> {
  return {
    actividad: p.actividad,
    altura: p.altura,
    calorias: p.calorias,
    carbohidratos: p.carbohidratos,
    edad: p.edad,
    grasas: p.grasas,
    nombre: p.nombre,
    objetivo: p.objetivo,
    peso: p.peso,
    proteinas: p.proteinas,
    sexo: p.sexo,
  }
}
