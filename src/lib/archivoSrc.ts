/**
 * Las fotos guardadas siguen en `/api/archivos/:id`.
 * En pantalla apuntan al gateway. En el APK un <img> no puede mandar el Bearer,
 * así que la miniatura se pide con fetch y se muestra como blob.
 */
import { useEffect, useState } from 'react'
import { archivoRechazado } from './avatar.ts'
import { urlDeArchivo } from './config.ts'
import { esNativa } from './plataforma.ts'
import { obtenerTokenApp } from './tokenApp.ts'

export function srcMostrable(url: string | null | undefined): string | null {
  const valor = url?.trim() ?? ''
  if (!valor) return null
  if (archivoRechazado(valor)) return null
  if (valor.startsWith('data:image/') || valor.startsWith('blob:')) return valor
  if (valor.startsWith('/api/archivos/')) return urlDeArchivo(valor)
  if (!valor.startsWith('https://')) return null
  try {
    return new URL(valor).hostname ? valor : null
  } catch {
    return null
  }
}

function esArchivoGateway(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'api.trujillomingorance.com' && u.pathname.startsWith('/v1/archivos/')
  } catch {
    return false
  }
}

export interface EstadoArchivo {
  src: string | null
  /** Hay una foto real y el APK todavía no ha terminado de pedirla. */
  pendiente: boolean
}

export function useSrcArchivo(url: string | null | undefined): string | null {
  return useEstadoArchivo(url).src
}

export function useEstadoArchivo(url: string | null | undefined): EstadoArchivo {
  const directo = srcMostrable(url)
  const pedir = !!directo && esArchivoGateway(directo)
  const [blob, setBlob] = useState<string | null>(null)
  const [fase, setFase] = useState<'idle' | 'carga' | 'listo' | 'fallo'>('idle')

  useEffect(() => {
    if (!pedir || !directo) {
      setBlob(null)
      setFase('idle')
      return
    }
    let vivo = true
    const creado = { url: '' }
    setFase('carga')
    setBlob(null)
    void (async () => {
      try {
        const token = await obtenerTokenApp()
        const headers: Record<string, string> = {}
        if (token) headers.authorization = `Bearer ${token}`
        const res = await fetch(directo, { credentials: esNativa ? 'omit' : 'include', mode: 'cors', headers })
        if (!res.ok || !vivo) {
          if (vivo) setFase('fallo')
          return
        }
        creado.url = URL.createObjectURL(await res.blob())
        if (!vivo) return
        setBlob(creado.url)
        setFase('listo')
      } catch {
        if (vivo) setFase('fallo')
      }
    })()
    return () => {
      vivo = false
      if (creado.url) URL.revokeObjectURL(creado.url)
    }
  }, [directo, pedir])

  if (!directo) return { src: null, pendiente: false }
  if (!pedir) return { src: directo, pendiente: false }
  if (fase === 'listo' && blob) return { src: blob, pendiente: false }
  if (fase === 'fallo') return { src: null, pendiente: false }
  return { src: null, pendiente: true }
}
