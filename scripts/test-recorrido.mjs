/**
 * Recorrido headless de NutriFit.
 * Prueba la URL local si responde y, si no, https://nutri.trujillomingorance.com.
 * La sesión se simula en el cliente para poder abrir el panel, el buscador y el perfil
 * sin cookie. Las peticiones /api/ no salen a la red.
 */
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PRODUCCION = 'https://nutri.trujillomingorance.com'
const RUTAS = ['/', '/privacidad', '/profile', '/historial']

const PRELOAD = `(() => {
  const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }))
  const orig = window.fetch.bind(window)
  const usuario = {
    id: 'u-recorrido', email: 'ana@nutrifit.test', nombre: 'Ana', edad: 30, sexo: 'mujer',
    peso_kg: 62, altura_cm: 165, nivel_actividad: 'moderado', objetivo: 'mantener',
    meta_calorias: 2000, meta_proteinas: 120, meta_carbs: 220, meta_grasas: 65,
    username: 'ana', bio: 'Entreno por la mañana', avatar_url: null, banner_url: null,
    es_publico: 1, creado_en: '2026-01-01T00:00:00.000Z',
  }
  const totales = { calorias: 820, proteinas: 90, carbohidratos: 70, grasas: 28 }
  const metas = { calorias: 2000, proteinas: 120, carbohidratos: 220, grasas: 65 }
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.includes('/api/')) return orig(input, init)
    if (url.includes('/api/auth/yo')) return json({ ok: true, perfilCompleto: true, usuario })
    if (url.includes('/api/config')) return json({ turnstileSiteKey: null })
    if (url.includes('/api/comidas/resumen')) {
      return json({
        ok: true, fecha: '2026-10-09',
        comidas: { desayuno: [], comida: [], cena: [], snack: [] },
        totales, metas,
        restante: { calorias: 1180, proteinas: 30, carbohidratos: 150, grasas: 37 },
        porcentaje: { calorias: 41, proteinas: 75, carbohidratos: 32, grasas: 43 },
        agua_ml: 0, num_comidas: 1,
      })
    }
    if (url.includes('/api/historial')) {
      return json({
        ok: true, desde: '2026-08-10', hasta: '2026-10-09',
        dias: [{ fecha: '2026-10-08', ...totales, num_comidas: 3, agua_ml: 500, peso: 62 }, { fecha: '2026-10-09', ...totales, num_comidas: 2, agua_ml: 0, peso: null }],
        metas, medias: null, dias_con_registro: 2, dias_en_objetivo: 0, peso: null,
      })
    }
    if (url.includes('/api/usuarios/social')) {
      return json({ ok: true, perfil: { username: 'ana', nombre: 'Ana', bio: 'Entreno por la mañana', avatar_url: null, banner_url: null, es_publico: 1, meta_agua_base_ml: 2170 } })
    }
    if (url.includes('/api/entrenamientos')) {
      return json({
        ok: true, fecha: '2026-10-09', entrenamientos: [
          { id: 'e1', tipo: 'fuerza', nombre: 'Fuerza', minutos: 28, duracion_min: 28, intensidad: 'media', calorias: 182, origen: null, fecha: '2026-10-09' },
          { id: 'e2', tipo: 'cardio', nombre: 'Carrera', minutos: 20, duracion_min: 20, intensidad: 'alta', calorias: 240, origen: null, fecha: '2026-10-08' },
        ],
      })
    }
    if (url.includes('/api/amistades')) return json({ ok: true, amistades: [] })
    if (url.includes('/api/usuarios/publico')) {
      return json({ ok: true, comunidad: [{ username: 'leo', nombre: 'Leo', avatar_url: null }], pagina: 1, hay_mas: false, perfil: { username: 'leo', nombre: 'Leo', bio: null, avatar_url: null } })
    }
    return json({ ok: true, registros: [], entrenamientos: [], amistades: [], comunidad: [], hay_mas: false, pagina: 1, dias: [] })
  }
})()`

async function baseDisponible() {
  const candidatos = [process.env.RECORRIDO_URL, 'http://127.0.0.1:5173', PRODUCCION].filter(Boolean)
  for (const url of candidatos) {
    try {
      const respuesta = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (respuesta.status < 500) return url.replace(/\/$/, '')
    } catch {
      /* el siguiente candidato */
    }
  }
  throw new Error('Ni el servidor local ni la producción responden')
}

function rutaDe(url) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '')
    return path || '/'
  } catch {
    return url
  }
}

async function main() {
  const base = await baseDisponible()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const http = []
  const consola = []
  page.on('response', (res) => {
    if (res.status() < 400) return
    http.push({ url: res.url().slice(0, 180), status: res.status(), tipo: res.request().resourceType() })
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') consola.push(msg.text().slice(0, 400))
  })
  page.on('pageerror', (error) => consola.push(String(error).slice(0, 400)))
  await page.addInitScript(PRELOAD)

  const rutas = []
  for (const path of RUTAS) {
    const desde = http.length
    const desdeConsola = consola.length
    let statusDocumento = 0
    try {
      const respuesta = await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 25000 })
      statusDocumento = respuesta?.status() ?? 0
      await page.waitForTimeout(600)
    } catch (error) {
      rutas.push({ path, error: String(error).slice(0, 300), rebote: true })
      continue
    }
    const final = rutaDe(page.url())
    const titulo = await page.locator('h1').first().textContent().catch(() => '')
    rutas.push({
      path,
      urlFinal: final,
      statusDocumento,
      rebote: final !== path,
      titulo: (titulo ?? '').trim().slice(0, 120),
      http: http.slice(desde),
      consola: consola.slice(desdeConsola),
    })
  }

  await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 25000 })
  const interacciones = []

  async function clic(nombre, localizar) {
    const objetivo = localizar()
    const visible = await objetivo.first().isVisible().catch(() => false)
    if (!visible) {
      interacciones.push({ nombre, hecho: false, detalle: 'No está visible' })
      return false
    }
    try {
      await objetivo.first().click({ timeout: 8000 })
      interacciones.push({ nombre, hecho: true, detalle: 'Clic hecho' })
      return true
    } catch (error) {
      interacciones.push({ nombre, hecho: false, detalle: String(error).split('\n')[0].slice(0, 220) })
      return false
    }
  }

  const abrioBuscar = await clic('Buscar alimento', () => page.getByRole('button', { name: 'Buscar alimento' }))
  if (abrioBuscar) {
    const dialogo = page.getByRole('dialog', { name: 'Buscar alimento' })
    const abierto = await dialogo.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
    interacciones.push({ nombre: 'Modal de búsqueda', hecho: abierto, detalle: abierto ? 'Diálogo abierto' : 'El diálogo no apareció' })
    if (abierto) {
      const cerrar = dialogo.getByRole('button', { name: 'Cerrar' })
      if (await cerrar.isVisible().catch(() => false)) await cerrar.click({ timeout: 4000 })
      else await page.keyboard.press('Escape')
      await dialogo.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {})
    }
    if (await dialogo.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape')
      interacciones.push({ nombre: 'Cerrar búsqueda', hecho: false, detalle: 'El diálogo sigue abierto' })
    }
  }

  const fuerza = await clic('Selector fuerza', () => page.getByRole('button', { name: 'Fuerza', exact: true }))
  if (fuerza) {
    const pulsado = await page.getByRole('button', { name: 'Fuerza', exact: true }).getAttribute('aria-pressed')
    interacciones.push({ nombre: 'Fuerza activa', hecho: pulsado === 'true', detalle: `aria-pressed=${pulsado}` })
  }
  await clic('Selector cardio', () => page.getByRole('button', { name: 'Cardio', exact: true }))

  const abrioPerfil = await clic('Mi perfil', () => page.getByRole('button', { name: 'Mi perfil' }))
  if (abrioPerfil) await page.waitForTimeout(400)
  const amigos = await clic('Pestaña Amigos', () => page.getByRole('tab', { name: 'Amigos' }))
  if (amigos) {
    const anadir = await page.getByRole('button', { name: '+ Añadir' }).first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
    interacciones.push({ nombre: 'Botón + Añadir', hecho: anadir, detalle: anadir ? 'Visible en sugeridos' : 'No hay sugerido con botón' })
  }
  if (rutaDe(page.url()) !== '/profile') {
    await page.goto(`${base}/profile`, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {})
  }
  await clic('Pestaña Feed', () => page.getByRole('tab', { name: 'Feed' }))
  const hidratos = await page.getByText('Hidratos', { exact: true }).first().isVisible().catch(() => false)
  interacciones.push({ nombre: 'Barras de macros', hecho: hidratos, detalle: hidratos ? 'Hidratos visible' : 'No se ve Hidratos' })

  const captura = join(tmpdir(), 'nf-recorrido-perfil.png')
  await page.screenshot({ path: captura, fullPage: true }).catch((error) => {
    interacciones.push({ nombre: 'Captura', hecho: false, detalle: String(error).split('\n')[0].slice(0, 220) })
  })
  const editar = await clic('Editar perfil', () => page.getByRole('button', { name: 'Editar perfil' }))
  if (editar) {
    const formulario = await page.getByRole('textbox', { name: 'Usuario' }).isVisible().catch(() => false)
    interacciones.push({ nombre: 'Formulario de perfil', hecho: formulario, detalle: formulario ? 'Usuario y biografía' : 'No se abrió el formulario' })
    await page.getByRole('button', { name: 'Cancelar' }).click().catch(() => {})
  }
  if (await page.getByRole('tab', { name: 'Amigos' }).isVisible().catch(() => false)) {
    await page.getByRole('tab', { name: 'Amigos' }).click().catch(() => {})
    await page.getByRole('button', { name: '+ Añadir' }).first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    await page.screenshot({ path: join(tmpdir(), 'nf-recorrido-amigos.png'), fullPage: true }).catch(() => {})
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tab', { name: 'Feed' }).click().catch(() => {})
  await page.screenshot({ path: join(tmpdir(), 'nf-recorrido-movil.png'), fullPage: true }).catch(() => {})

  const fallos = [
    ...rutas.filter((r) => r.rebote || r.error || (r.http ?? []).length || (r.consola ?? []).length).map((r) => ({
      ruta: r.path,
      rebote: Boolean(r.rebote),
      urlFinal: r.urlFinal,
      error: r.error,
      http: r.http ?? [],
      consola: r.consola ?? [],
    })),
    ...interacciones.filter((i) => !i.hecho),
  ]

  const informe = {
    generado: new Date().toISOString(),
    base,
    sesion: 'simulada en el cliente; /api no sale a la red',
    captura,
    rutas,
    interacciones,
    fallos,
    resumen: fallos.length ? `${fallos.length} hallazgos` : 'Sin rebotes, sin HTTP 4xx/5xx y sin console.error',
  }
  writeFileSync(new URL('../test-report.json', import.meta.url), `${JSON.stringify(informe, null, 2)}\n`)
  console.log(JSON.stringify({ base, resumen: informe.resumen, captura, interacciones }, null, 2))
  await browser.close()
  process.exitCode = fallos.length ? 1 : 0
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})