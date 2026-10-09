/**
 * Peso en local-first. El registro se apunta al momento y los cambios seguidos
 * del mismo día se funden en un solo POST, dentro de la ventana diaria:
 *   · 30 s después del último cambio, en un requestIdleCallback;
 *   · al pasar la pestaña a segundo plano (visibilitychange);
 *   · al salir (sendBeacon en la web, fetch keepalive en la app).
 */
import { api, ApiError } from './api.ts'
import { hashContenido } from '../../functions/utils/contenidoHash.ts'
import { leerHashSincronizado } from './hashSync.ts'
import { idbLeerTodo } from './localDb.ts'
import { esNativa } from './plataforma.ts'
import { apiMismoOrigen, urlApi } from './config.ts'
import { guardarPesoLocal, leerPesosLocales, olvidarPesoLocal } from './pesoLocal.ts'
import { alAbrirVentana, debeVolcar, enVentanaCacheada, programarDespertador } from './ventanaCliente.ts'

export const DEBOUNCE_PESO_MS = 30_000

const timers = new Map<string, number>()
const enVuelo = new Map<string, number>()
const hashListo = new Map<string, { peso: number; hash: string }>()
let alFallar: (mensaje: string) => void = () => {}
let ultimoAviso = 0
let listo = false

export function alFallarSyncPeso(fn: (mensaje: string) => void) {
  alFallar = fn
}

/** Apunta el peso del día y rearma el debounce de 30 s. */
export function anotarPeso(fecha: string, peso: number) {
  guardarPesoLocal(fecha, peso)
  programar(fecha)
  void hashContenido({ fecha, peso }).then((hash) => {
    if (leerPesosLocales()[fecha] !== peso) return
    hashListo.set(fecha, { peso, hash })
    if (leerHashSincronizado(`peso:${fecha}`) !== hash) return
    const pendiente = timers.get(fecha)
    if (pendiente) clearTimeout(pendiente)
    timers.delete(fecha)
    olvidarPesoLocal(fecha)
  })
}

export function iniciarSyncPeso() {
  if (listo || typeof window === 'undefined') return
  listo = true
  void hidratarDesdeIdb()
  alAbrirVentana(() => {
    if (Object.keys(leerPesosLocales()).length) vaciarAhora(false)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && enVentanaCacheada()) vaciarAhora(true)
  })
  window.addEventListener('pagehide', () => salir())
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return
    enVuelo.clear()
    if (Object.keys(leerPesosLocales()).length) void enviarSiToca(false)
  })
  if (Object.keys(leerPesosLocales()).length) void enviarSiToca(false)
}

function programar(fecha: string) {
  const previo = timers.get(fecha)
  if (previo) clearTimeout(previo)
  if (!enVentanaCacheada()) {
    timers.delete(fecha)
    void programarDespertador()
    return
  }
  timers.set(
    fecha,
    window.setTimeout(() => {
      timers.delete(fecha)
      void enviarSiToca(false, fecha)
    }, DEBOUNCE_PESO_MS),
  )
}

async function enviarSiToca(keepalive: boolean, soloFecha?: string) {
  if (!(await debeVolcar('normal'))) {
    void programarDespertador()
    return
  }
  if (soloFecha) cuandoElHiloEsteLibre(() => void enviar(soloFecha, keepalive))
  else vaciarAhora(keepalive)
}

function cuandoElHiloEsteLibre(fn: () => void) {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => fn(), { timeout: 2000 })
  else window.setTimeout(fn, 0)
}

function vaciarAhora(keepalive: boolean) {
  for (const fecha of timers.keys()) {
    clearTimeout(timers.get(fecha))
    timers.delete(fecha)
  }
  for (const fecha of Object.keys(leerPesosLocales())) void enviar(fecha, keepalive)
}

function salir() {
  if (!enVentanaCacheada()) return
  for (const fecha of [...timers.keys()]) {
    clearTimeout(timers.get(fecha))
    timers.delete(fecha)
  }
  for (const [fecha, peso] of Object.entries(leerPesosLocales())) {
    if (enVuelo.get(fecha) === peso) continue
    if (enviarAlSalir(fecha, peso)) enVuelo.set(fecha, peso)
  }
}

function enviarAlSalir(fecha: string, peso: number): boolean {
  const preparado = hashListo.get(fecha)
  if (preparado && preparado.peso === peso && leerHashSincronizado(`peso:${fecha}`) === preparado.hash) {
    olvidarPesoLocal(fecha)
    return false
  }
  const cuerpo = JSON.stringify({ peso, fecha })
  if (!esNativa && apiMismoOrigen() && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([cuerpo], { type: 'application/json' })
    if (navigator.sendBeacon(urlApi('/api/peso'), blob)) return true
  }
  void enviar(fecha, true)
  return true
}

async function enviar(fecha: string, keepalive: boolean) {
  const peso = leerPesosLocales()[fecha]
  if (peso === undefined) return
  if (enVuelo.get(fecha) === peso) return
  enVuelo.set(fecha, peso)
  try {
    const res = await api.registrarPeso(peso, fecha, keepalive)
    if ('aplazado' in res && res.aplazado) {
      void programarDespertador()
      return
    }
    if (leerPesosLocales()[fecha] === peso) olvidarPesoLocal(fecha)
    else if (leerPesosLocales()[fecha] !== undefined && !timers.has(fecha)) programar(fecha)
  } catch (e) {
    const estado = e instanceof ApiError ? e.status : 0
    if (estado === 0 || estado === 429 || estado >= 500) programar(fecha)
    const ahora = Date.now()
    if (ahora - ultimoAviso > 60_000) {
      ultimoAviso = ahora
      alFallar(e instanceof Error ? e.message : 'No se pudo guardar el peso. Sigue en este dispositivo.')
    }
  } finally {
    if (enVuelo.get(fecha) === peso) enVuelo.delete(fecha)
  }
}

async function hidratarDesdeIdb() {
  try {
    const remoto = await idbLeerTodo('peso')
    let cambio = false
    const local = leerPesosLocales()
    for (const [fecha, peso] of Object.entries(remoto)) {
      if (local[fecha] !== undefined) continue
      if (!(peso >= 30 && peso <= 300)) continue
      guardarPesoLocal(fecha, peso)
      cambio = true
    }
    if (cambio) void enviarSiToca(false)
  } catch {
    /* sin IndexedDB se sigue con localStorage */
  }
}
