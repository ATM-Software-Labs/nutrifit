import { useEffect, useState } from 'react'
import { useEstadoArchivo } from '../../lib/archivoSrc.ts'
import { avatarGenerado } from '../../lib/avatar.ts'

export function FotoAvatar({ url, nombre, grande = false, className }: { url: string | null; nombre: string; grande?: boolean; className?: string }) {
  const { src: remoto, pendiente } = useEstadoArchivo(url)
  const [fotoRota, setFotoRota] = useState(false)
  const [generadoRoto, setGeneradoRoto] = useState(false)
  useEffect(() => {
    setFotoRota(false)
    setGeneradoRoto(false)
  }, [url])

  const baseCaja = grande ? 'h-full w-full text-2xl' : 'h-9 w-9 shrink-0 text-sm'
  const caja = className ? `${baseCaja} ${className}` : baseCaja
  const lado = grande ? 96 : 36
  const letra = nombre.replace(/^@/, '').trim().charAt(0).toUpperCase()
  
  const uiAvatarSrc = avatarGenerado(nombre)

  const usarFoto = Boolean(remoto) && !fotoRota
  const src = usarFoto ? remoto : generadoRoto ? null : uiAvatarSrc
  
  if (!src || pendiente) {
     return (
        <span aria-hidden="true" className={`flex items-center justify-center rounded-full bg-[#064e3b] font-semibold text-[#34d399] ${caja}`}>
          {letra || '?'}
        </span>
     )
  }
  return (
    <img
      src={src}
      alt=""
      width={lado}
      height={lado}
      referrerPolicy="no-referrer"
      loading={grande ? 'eager' : 'lazy'}
      onError={(evento) => {
        evento.currentTarget.onerror = null
        if (usarFoto) setFotoRota(true)
        else setGeneradoRoto(true)
      }}
      className={`rounded-full object-cover ${caja}`}
    />
  )
}
