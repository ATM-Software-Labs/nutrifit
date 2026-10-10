const fs = require('fs');
const lines = fs.readFileSync('src/lib/localDb.ts', 'utf8').split('\n');
const goodLines = lines.slice(0, 111);
const code = `
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
`;
fs.writeFileSync('src/lib/localDb.ts', goodLines.join('\n') + code);
console.log('Fixed');
