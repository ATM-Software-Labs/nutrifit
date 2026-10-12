/**
 * Rellena `emoji` en diario_comidas, productos_usuario y comidas_frecuentes
 * con el mapeo determinista (sin IA). Idempotente: solo toca filas con emoji NULL.
 * Uso: node scripts/backfill-emoji.ts [--remote]
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { emojiComida, emojiPorTexto } from '../src/lib/miniaturaComida.ts'

const remoto = process.argv.includes('--remote') ? ['--remote'] : ['--local']
const d1 = (args: string[]) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'nutrifit-db', ...remoto, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
const consulta = <T,>(sql: string): T[] => (JSON.parse(d1(['--json', '--command', sql])) as { results: T[] }[])[0]!.results
const q = (s: string) => `'${s.replace(/'/g, "''")}'`

type FC = { id: string; descripcion: string; ingredientes_json: string | null; proteinas: number; carbohidratos: number; grasas: number }
const sql: string[] = []
for (const f of consulta<FC>('SELECT id, descripcion, ingredientes_json, proteinas, carbohidratos, grasas FROM diario_comidas WHERE emoji IS NULL')) {
  let ingredientes: { nombre?: string }[] = []
  try { ingredientes = f.ingredientes_json ? JSON.parse(f.ingredientes_json) : [] } catch { /* json roto */ }
  sql.push(`UPDATE diario_comidas SET emoji = ${q(emojiComida({ ...f, ingredientes }))} WHERE id = ${q(f.id)} AND emoji IS NULL;`)
}
const nComidas = sql.length
for (const f of consulta<{ id: string; nombre: string }>('SELECT id, nombre FROM productos_usuario WHERE emoji IS NULL'))
  sql.push(`UPDATE productos_usuario SET emoji = ${q(emojiPorTexto(f.nombre))} WHERE id = ${q(f.id)} AND emoji IS NULL;`)
const nProductos = sql.length - nComidas
for (const f of consulta<{ id: string; nombre: string }>('SELECT id, nombre FROM comidas_frecuentes WHERE emoji IS NULL'))
  sql.push(`UPDATE comidas_frecuentes SET emoji = ${q(emojiPorTexto(f.nombre))} WHERE id = ${q(f.id)} AND emoji IS NULL;`)
console.log(`pendientes: comidas ${nComidas}, productos ${nProductos}, frecuentes ${sql.length - nComidas - nProductos}`)
if (sql.length) {
  const ruta = '/tmp/backfill-emoji.sql'
  writeFileSync(ruta, sql.join('\n'))
  d1(['--file', ruta, '--yes'])
}
const cuenta = consulta<Record<string, number>>(`SELECT
  (SELECT COUNT(*) FROM diario_comidas) AS comidas, (SELECT COUNT(*) FROM diario_comidas WHERE emoji IS NULL) AS comidas_sin,
  (SELECT COUNT(*) FROM productos_usuario) AS productos, (SELECT COUNT(*) FROM productos_usuario WHERE emoji IS NULL) AS productos_sin,
  (SELECT COUNT(*) FROM comidas_frecuentes) AS frecuentes, (SELECT COUNT(*) FROM comidas_frecuentes WHERE emoji IS NULL) AS frecuentes_sin`)[0]
console.log(JSON.stringify(cuenta))
