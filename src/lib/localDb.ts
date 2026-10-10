/**
 * Copia local de lo que aún no está en D1. Agua, peso y el historial de
 * alimentos comparten la base `nutrifit-local` para no abrir dos versiones.
 */
const NOMBRE = 'nutrifit-local'
const VERSION = 3
const TIENDA_ALIMENTOS = 'alimentos'
const CLAVE_ALIMENTOS = 'lista'

export type AlmacenLocal = 'agua' | 'peso'

let dbProm: Promise<IDBDatabase> | null = null

export function abrirLocalDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('sin IndexedDB'))
  if (!dbProm) {
    dbProm = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOMBRE, VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('agua')) db.createObjectStore('agua')
        if (!db.objectStoreNames.contains('peso')) db.createObjectStore('peso')
        if (!db.objectStoreNames.contains(TIENDA_ALIMENTOS)) db.createObjectStore(TIENDA_ALIMENTOS)
        if (!db.objectStoreNames.contains('imagenes')) db.createObjectStore('imagenes')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    dbProm.catch(() => {
      dbProm = null
    })
  }
  return dbProm
}

export function idbPut(store: AlmacenLocal, clave: string, valor: number) {
  return abrirLocalDb()
    .then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite')
          tx.objectStore(store).put(valor, clave)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }),
    )
    .catch(() => {})
}

export function idbDelete(store: AlmacenLocal, clave: string) {
  return abrirLocalDb()
    .then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite')
          tx.objectStore(store).delete(clave)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }),
    )
    .catch(() => {})
}

/** Historial de alimentos (un array JSON). No pasa por idbPut, que solo guarda números. */
export function idbGuardarAlimentos(valor: unknown) {
  return abrirLocalDb()
    .then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(TIENDA_ALIMENTOS, 'readwrite')
          tx.objectStore(TIENDA_ALIMENTOS).put(valor, CLAVE_ALIMENTOS)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }),
    )
    .catch(() => {})
}

export function idbLeerAlimentos(): Promise<unknown> {
  return abrirLocalDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(TIENDA_ALIMENTOS)) {
          resolve(undefined)
          return
        }
        const req = db.transaction(TIENDA_ALIMENTOS, 'readonly').objectStore(TIENDA_ALIMENTOS).get(CLAVE_ALIMENTOS)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function idbLeerTodo(store: AlmacenLocal): Promise<Record<string, number>> {
  const db = await abrirLocalDb()
  return new Promise((resolve, reject) => {
    const caja: Record<string, number> = {}
    const req = db.transaction(store, 'readonly').objectStore(store).openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve(caja)
        return
      }
      if (typeof cursor.key === 'string' && typeof cursor.value === 'number') caja[cursor.key] = cursor.value
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

export function idbGuardarImagen(clave: string, valor: string) {
  return abrirLocalDb()
    .then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction('imagenes', 'readwrite')
          tx.objectStore('imagenes').put(valor, clave)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }),
    )
    .catch(() => {})
}

export function idbLeerImagen(clave: string): Promise<string | undefined> {
  return abrirLocalDb()
    .then(
      (db) =>
        new Promise<string | undefined>((resolve, reject) => {
          if (!db.objectStoreNames.contains('imagenes')) {
            resolve(undefined)
            return
          }
          const req = db.transaction('imagenes', 'readonly').objectStore('imagenes').get(clave)
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        }),
    )
    .catch(() => undefined)
}
