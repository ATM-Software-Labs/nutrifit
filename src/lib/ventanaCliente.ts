/**
 * En el cliente, las acciones normales esperan la ventana del usuario.
 * La prioridad alta sube al momento.
 */
import { dentroDeVentana, msHastaFinVentana, msHastaVentana } from '../../functions/utils/ventanaSync.ts'

type Prioridad = 'alta' | 'normal'

let usuarioId: string | null = null
let despertador: number | null = null
let dentroCache = false
let avisadoDentro = false
const alAbrir: Array<() => void> = []

export function fijarUsuarioSync(id: string | null) {
  if (id === usuarioId) {
    if (id) void programarDespertador()
    return
  }
  usuarioId = id
  avisadoDentro = false
  dentroCache = false
  if (despertador !== null) {
    clearTimeout(despertador)
    despertador = null
  }
  if (id) void programarDespertador()
}

export function alAbrirVentana(fn: () => void) {
  alAbrir.push(fn)
}

/** Lectura síncrona para pagehide, donde un await perdería el sendBeacon. */
export function enVentanaCacheada(): boolean {
  return dentroCache
}

export async function debeVolcar(prioridad: Prioridad): Promise<boolean> {
  if (prioridad === 'alta') return true
  if (!usuarioId) return false
  dentroCache = await dentroDeVentana(usuarioId)
  return dentroCache
}

export async function programarDespertador() {
  if (!usuarioId || typeof window === 'undefined') return
  const id = usuarioId
  const espera = await msHastaVentana(id)
  if (id !== usuarioId) return
  if (despertador !== null) clearTimeout(despertador)
  if (espera === 0) {
    dentroCache = true
    const fin = await msHastaFinVentana(id)
    if (id !== usuarioId) return
    despertador = window.setTimeout(() => {
      despertador = null
      dentroCache = false
      avisadoDentro = false
      void programarDespertador()
    }, fin)
    if (avisadoDentro) return
    avisadoDentro = true
    for (const fn of alAbrir) fn()
    return
  }
  dentroCache = false
  avisadoDentro = false
  despertador = window.setTimeout(() => {
    despertador = null
    void programarDespertador()
  }, espera)
}
