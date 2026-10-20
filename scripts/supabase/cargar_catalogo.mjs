#!/usr/bin/env node
/**
 * Carga los JSONL de generar_catalogo.py en Supabase por la API REST (clave service_role).
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/supabase/cargar_catalogo.mjs <dir>
 * Por lotes de 1000, reanudable (guarda el progreso en <dir>/.progreso.json) e idempotente
 * (upsert por clave / nombre_norm). No imprime la clave.
 */
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const dir = process.argv[2]
const URL_BASE = process.env.SUPABASE_URL?.replace(/\/+$/, '')
const REST = process.env.SUPABASE_REST_URL?.replace(/\/+$/, '') ?? `${URL_BASE}/rest/v1` // solo para pruebas locales con PostgREST
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!dir || !URL_BASE || !CLAVE) {
  console.error('Uso: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node cargar_catalogo.mjs <dir>')
  process.exit(2)
}
const LOTE = 1000
const ficheroProgreso = `${dir}/.progreso.json`
const progreso = existsSync(ficheroProgreso) ? JSON.parse(readFileSync(ficheroProgreso, 'utf8')) : {}
const TRABAJOS = [
  { fichero: 'comidas.jsonl', tabla: 'catalogo_comidas', conflicto: 'nombre_norm' },
  { fichero: 'alimentos_genericos.jsonl', tabla: 'catalogo_alimentos', conflicto: 'clave' },
  { fichero: 'alimentos_off.jsonl', tabla: 'catalogo_alimentos', conflicto: 'clave' },
]

async function enviar(tabla, conflicto, filas) {
  for (let intento = 1; ; intento++) {
    const res = await fetch(`${REST}/${tabla}?on_conflict=${conflicto}`, {
      method: 'POST',
      headers: { apikey: CLAVE, authorization: `Bearer ${CLAVE}`, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(filas),
      signal: AbortSignal.timeout(60_000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }))
    if (res.ok) return
    const txt = (await res.text()).slice(0, 300)
    if (intento >= 5 || (res.status >= 400 && res.status < 500 && res.status !== 429)) throw new Error(`${tabla} ${res.status}: ${txt}`)
    await new Promise((ok) => setTimeout(ok, 2000 * intento))
  }
}

for (const t of TRABAJOS) {
  const hechas = progreso[t.fichero] ?? 0
  let n = 0
  let lote = []
  const rl = createInterface({ input: createReadStream(`${dir}/${t.fichero}`, 'utf8'), crlfDelay: Infinity })
  for await (const linea of rl) {
    if (!linea.trim()) continue
    n++
    if (n <= hechas) continue
    lote.push(JSON.parse(linea))
    if (lote.length >= LOTE) {
      await enviar(t.tabla, t.conflicto, lote)
      progreso[t.fichero] = n
      writeFileSync(ficheroProgreso, JSON.stringify(progreso))
      lote = []
      if (n % 20000 === 0) console.log(`${t.fichero}: ${n}`)
    }
  }
  if (lote.length) await enviar(t.tabla, t.conflicto, lote)
  progreso[t.fichero] = n
  writeFileSync(ficheroProgreso, JSON.stringify(progreso))
  console.log(`${t.fichero}: ${n} filas → ${t.tabla}`)
}
