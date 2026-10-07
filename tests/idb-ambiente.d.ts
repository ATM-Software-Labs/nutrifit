/** Tipos mínimos para comprobar src/lib/localDb.ts desde los tests, que no cargan la lib DOM. */
interface IDBRequest {
  result: any
  error: unknown
  onsuccess: (() => void) | null
  onerror: (() => void) | null
  onupgradeneeded: (() => void) | null
}

interface IDBDatabase {
  objectStoreNames: { contains(name: string): boolean }
  createObjectStore(name: string): unknown
  transaction(
    store: string,
    mode: 'readonly' | 'readwrite',
  ): {
    objectStore(name: string): {
      put(valor: unknown, clave: string): unknown
      delete(clave: string): unknown
      get(clave: string): IDBRequest
      openCursor(): IDBRequest
    }
    oncomplete: (() => void) | null
    onerror: (() => void) | null
    error: unknown
  }
}

declare const indexedDB: { open(name: string, version?: number): IDBRequest }
