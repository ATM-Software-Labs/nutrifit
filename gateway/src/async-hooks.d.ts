/** El gateway no carga @types/node entero: solo el módulo que ya usa el proxy de visión. */
declare module 'node:async_hooks' {
  export class AsyncLocalStorage<T> {
    run<R>(store: T, callback: () => R): R
    getStore(): T | undefined
  }
}
