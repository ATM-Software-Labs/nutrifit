/** Privacidad: ninguna ruta que recibe imágenes de comida puede persistirlas. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { guardarArchivo } from '../functions/utils/archivos.ts'

test('guardarArchivo rechaza fotos de comida', async () => {
  let llamado = false
  const env = { DB: { prepare: () => { llamado = true; return { bind: () => ({ run: async () => ({}) }) } } } }
  await assert.rejects(guardarArchivo(env as never, 'u1', 'plato' as never, { mime: 'image/jpeg', bytes: new Uint8Array([1]) } as never))
  assert.equal(llamado, false)
})

test('/api/comidas/foto devuelve 410 y no guarda', async () => {
  const { onRequestPost } = await import('../functions/api/comidas/foto.ts')
  const r = await (onRequestPost as unknown as () => Promise<Response>)()
  assert.equal(r.status, 410)
})

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? archivos(p) : p.endsWith('.ts') ? [p] : [] })
}

test('ningún endpoint guarda imágenes (INSERT en archivos_usuario solo en utils/archivos, sin R2)', () => {
  for (const f of [...archivos('functions'), ...archivos('gateway/src')]) {
    const s = readFileSync(f, 'utf8')
    if (!f.endsWith(join('utils', 'archivos.ts'))) assert.ok(!/INSERT INTO archivos_usuario/i.test(s), `${f} inserta en archivos_usuario`)
    assert.ok(!/R2Bucket|\.put\([^)]*(imagen|bytes|foto)/i.test(s), `${f} guarda una imagen en R2/KV`)
    assert.ok(!/guardarArchivo\([^)]*'plato'/.test(s), `${f} guarda una foto de plato`)
  }
  const guardar = readFileSync('functions/api/comidas/guardar.ts', 'utf8')
  assert.ok(/c\.imagen_url = null/.test(guardar), 'guardar debe descartar imagen_url')
})
