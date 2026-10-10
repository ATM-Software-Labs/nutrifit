/**
 * Agua en local-first. Cada toque se apunta al momento en localStorage e
 * IndexedDB (la UI no espera a D1). Los toques seguidos se funden en un solo
 * total y se envían con modo "fijar" solo dentro de la ventana diaria:
 *   · 30 s después del último cambio, en un requestIdleCallback;
 *   · al pasar la pestaña a segundo plano (visibilitychange);
 *   · al salir (sendBeacon en la web, fetch keepalive en la app).
 * Fuera de esa ventana el total sigue en local hasta el despertador.
 */
import { api, ApiError } from './api.ts'
import { hashContenido } from '../../functions/utils/contenidoHash.ts'
import { leerHashSincronizado } from './hashSync.ts'
import { esNativa } from './plataforma.ts'
import { apiMismoOrigen, urlApi } from './config.ts'
import { idbDelete, idbLeerTodo, idbPut } from './localDb.ts'
import { alAbrirVentana, debeVolcar, enVentanaCacheada, programarDespertador } from './ventanaCliente.ts'

export const DEBOUNCE_AGUA_MS = 5_000
const MAX_ML = 10_000
const CLAVE = 'nf:agua:outbox'

export function mlAguaAcotado(ml: number): number {
  if (!Number.isFinite(ml)) return 0
  return Math.max(0, Math.min(MAX_ML, Math.round(ml)))
}

type Caja = Record<string, number>

const timers = new Map<string, number>()
const enVuelo = new Map<string, number>()
const hashListo = new Map<string, { ml: number; hash: string }>()
let alFallar: (mensaje: string) => void = () => {}
let ultimoAviso = 0
let listo = false

export function leerAguaLocal(fecha: string): number | null {
  const ml = leerCaja()[fecha]
  return ml === undefined ? null : ml
}

/** Registra el aviso si un envío falla. El total local no se revierte. */
export function alFallarSyncAgua(fn: (mensaje: string) => void) {
  alFallar = fn
}

/** Arranca los listeners una sola vez y reintenta lo que quedó sin enviar. */
export function iniciarSyncAgua() {
  if (listo || typeof window === 'undefined') return
  listo = true
  void hidratarDesdeIdb()
  alAbrirVentana(() => {
    if (Object.keys(leerCaja()).length) vaciarAhora(false)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && enVentanaCacheada()) vaciarAhora(true)
  })
  window.addEventListener('pagehide', () => salir())
  // Al volver de la bfcache el total local sigue pendiente: se reintenta una vez.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return
    enVuelo.clear()
    if (Object.keys(leerCaja()).length) void enviarSiToca(false)
  })
  if (Object.keys(leerCaja()).length) void enviarSiToca(false)
}

/** Apunta el total del día y rearma el debounce de 30 s. */
export function anotarAgua(fecha: string, ml: number) {
  const n = mlAguaAcotado(ml)
  guardarLocal(fecha, n)
  programar(fecha)
  void hashContenido({ fecha, ml: n }).then((hash) => {
    if (leerCaja()[fecha] !== n) return
    hashListo.set(fecha, { ml: n, hash })
    if (leerHashSincronizado(`agua:${fecha}`) !== hash) return
    const pendiente = timers.get(fecha)
    if (pendiente) clearTimeout(pendiente)
    timers.delete(fecha)
    quitar(fecha)
  })
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
    }, DEBOUNCE_AGUA_MS),
  )
}

/** Fuera de la ventana el total se queda en local y espera al despertador. */
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
  for (const fecha of Object.keys(leerCaja())) void enviar(fecha, keepalive)
}

function salir() {
  if (!enVentanaCacheada()) return
  for (const fecha of [...timers.keys()]) {
    clearTimeout(timers.get(fecha))
    timers.delete(fecha)
  }
  for (const [fecha, ml] of Object.entries(leerCaja())) {
    if (enVuelo.get(fecha) === ml) continue
    if (enviarAlSalir(fecha, ml)) enVuelo.set(fecha, ml)
  }
}

/** sendBeacon no puede llevar Authorization: en la app se usa fetch keepalive. */
function enviarAlSalir(fecha: string, ml: number): boolean {
  const listo = hashListo.get(fecha)
  if (listo && listo.ml === ml && leerHashSincronizado(`agua:${fecha}`) === listo.hash) {
    quitar(fecha)
    return false
  }
  const cuerpo = JSON.stringify({ fecha, ml, modo: 'fijar' })
  if (!esNativa && apiMismoOrigen() && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([cuerpo], { type: 'application/json' })
    if (navigator.sendBeacon(urlApi('/api/agua'), blob)) return true
  }
  void enviar(fecha, true)
  return true
}

async function enviar(fecha: string, keepalive: boolean) {
  const ml = leerCaja()[fecha]
  if (ml === undefined) return
  if (enVuelo.get(fecha) === ml) return
  enVuelo.set(fecha, ml)
  try {
    const res = await api.agua(fecha, ml, 'fijar', keepalive)
    if ('aplazado' in res && res.aplazado) {
      void programarDespertador()
      return
    }
    if (leerCaja()[fecha] === ml) quitar(fecha)
    else if (leerCaja()[fecha] !== undefined && !timers.has(fecha)) programar(fecha)
  } catch (e) {
    const estado = e instanceof ApiError ? e.status : 0
    if (estado === 0 || estado === 429 || estado >= 500) programar(fecha)
    const ahora = Date.now()
    if (ahora - ultimoAviso > 60_000) {
      ultimoAviso = ahora
      alFallar(e instanceof Error ? e.message : 'No se pudo guardar el agua. Sigue en este dispositivo.')
    }
  } finally {
    if (enVuelo.get(fecha) === ml) enVuelo.delete(fecha)
  }
}

function guardarLocal(fecha: string, ml: number) {
  const caja = leerCaja()
  caja[fecha] = ml
  escribirCaja(caja)
  void idbPut('agua', fecha, ml)
}

function quitar(fecha: string) {
  const caja = leerCaja()
  if (caja[fecha] === undefined) return
  delete caja[fecha]
  escribirCaja(caja)
  void idbDelete('agua', fecha)
}

function leerCaja(): Caja {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return {}
    const datos = JSON.parse(raw) as unknown
    if (!datos || typeof datos !== 'object') return {}
    const caja: Caja = {}
    for (const [fecha, ml] of Object.entries(datos)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha) && typeof ml === 'number') caja[fecha] = mlAguaAcotado(ml)
    }
    return caja
  } catch {
    return {}
  }
}

function escribirCaja(caja: Caja) {
  try {
    if (Object.keys(caja).length === 0) localStorage.removeItem(CLAVE)
    else localStorage.setItem(CLAVE, JSON.stringify(caja))
  } catch {
    /* modo privado o cuota: IndexedDB sigue siendo la copia */
  }
}

async function hidratarDesdeIdb() {
  try {
    const remoto = await idbLeerTodo('agua')
    const local = leerCaja()
    let cambio = false
    for (const [fecha, ml] of Object.entries(remoto)) {
      if (local[fecha] === undefined) {
        local[fecha] = mlAguaAcotado(ml)
        cambio = true
      }
    }
    if (cambio) {
      escribirCaja(local)
      void enviarSiToca(false)
    }
  } catch {
    /* sin IndexedDB se sigue con localStorage */
  }
}
