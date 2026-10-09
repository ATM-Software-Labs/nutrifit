/**
 * Auditoría headless de NutriFit.
 * Fase red: Chromium contra la app real (local si responde, si no producción).
 * Fase interfaz: la misma app con /api simulado en el cliente para pulsar
 * navegación, chips y modales sin cookie. Esas peticiones no salen a la red.
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
    id: 'u-auditoria', email: 'ana@nutrifit.test', nombre: 'Ana', edad: 30, sexo: 'mujer',
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
          { id: 'e2', tipo: 'cardio', nombre: 'Cardio', minutos: 20, duracion_min: 20, intensidad: 'alta', calorias: 240, origen: null, fecha: '2026-10-08' },
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

function rutaDe(url) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '')
    return path || '/'
  } catch {
    return url
  }
}

function severidadHttp(status, url) {
  const yo = url.includes('/api/auth/yo')
  const api = url.includes('/api/')
  if (status === 502 || status === 503) return 'alta'
  if (status >= 500) return 'critica'
  if (status === 401 || status === 403) return yo ? 'info' : 'baja'
  if (status >= 400) return api ? 'media' : 'alta'
  return 'info'
}

function leerCsp(header) {
  if (!header) {
    return {
      presente: false,
      permiteData: null,
      permiteBlob: null,
      nota: 'Esta respuesta no envía Content-Security-Policy.',
    }
  }
  const directiva = (nombre) => header.split(';').map((t) => t.trim()).find((t) => t.startsWith(nombre)) ?? ''
  const img = directiva('img-src')
  const connect = directiva('connect-src')
  const worker = directiva('worker-src')
  return {
    presente: true,
    imgData: img.includes('data:'),
    imgBlob: img.includes('blob:'),
    connectData: connect.includes('data:'),
    connectBlob: connect.includes('blob:'),
    workerBlob: worker.includes('blob:'),
    nota: 'Cabecera leída de la respuesta del documento.',
  }
}

async function baseDisponible() {
  const candidatos = [process.env.AUDITORIA_URL, 'http://127.0.0.1:5173', PRODUCCION].filter(Boolean)
  for (const url of candidatos) {
    try {
      const respuesta = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (respuesta.status < 500) return url.replace(/\/$/, '')
    } catch {
      /* siguiente */
    }
  }
  throw new Error('Ni el servidor local ni la producción responden')
}

function hayBucle(caminos) {
  const ultimos = caminos.slice(-6)
  if (ultimos.length < 6) return false
  const [a, b] = ultimos
  if (!a || !b || a === b) return false
  return ultimos.every((path, i) => path === (i % 2 === 0 ? a : b))
}

async function preparar(page, destino) {
  await page.addInitScript(() => {
    window.__csp = []
    document.addEventListener('securitypolicyviolation', (evento) => {
      window.__csp.push({
        blockedURI: evento.blockedURI,
        violatedDirective: evento.violatedDirective,
        effectiveDirective: evento.effectiveDirective,
      })
    })
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') destino.consola.push({ texto: msg.text().slice(0, 400), tipo: 'console.error' })
  })
  page.on('pageerror', (error) => {
    destino.consola.push({ texto: String(error).slice(0, 400), tipo: 'pageerror' })
  })
  page.on('response', (res) => {
    if (res.status() < 400) return
    const url = res.url()
    destino.http.push({
      url: url.slice(0, 200),
      status: res.status(),
      tipo: res.request().resourceType(),
      severidad: severidadHttp(res.status(), url),
      authYo: url.includes('/api/auth/yo'),
    })
  })
  page.on('requestfailed', (req) => {
    const url = req.url()
    if (!url.includes('/api/')) return
    destino.http.push({
      url: url.slice(0, 200),
      status: 0,
      tipo: req.resourceType(),
      severidad: 'alta',
      authYo: url.includes('/api/auth/yo'),
      fallo: req.failure()?.errorText?.slice(0, 180) ?? 'request failed',
    })
  })
}

async function cerrarDialogo(page) {
  const dialogo = page.getByRole('dialog')
  if (!(await dialogo.first().isVisible().catch(() => false))) return false
  const cerrar = dialogo.first().getByRole('button', { name: 'Cerrar' })
  if (await cerrar.isVisible().catch(() => false)) await cerrar.click({ timeout: 4000 })
  else await page.keyboard.press('Escape')
  await dialogo.first().waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {})
  return await dialogo.first().isVisible().catch(() => false)
}

async function main() {
  const base = await baseDisponible()
  let cspProduccion = null
  try {
    const respuesta = await fetch(PRODUCCION, { signal: AbortSignal.timeout(8000) })
    cspProduccion = { status: respuesta.status, ...leerCsp(respuesta.headers.get('content-security-policy')) }
  } catch (error) {
    cspProduccion = { presente: false, nota: String(error).slice(0, 180) }
  }
  const hallazgos = []
  const red = { http: [], consola: [], rutas: [], cspDocumento: null, violaciones: [], sonda: null }
  const interfaz = { clics: [], botonesBloqueados: [], caminos: [], consola: [] }
  const browser = await chromium.launch({ headless: true })

  const paginaRed = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await preparar(paginaRed, red)
  for (const path of RUTAS) {
    const desdeHttp = red.http.length
    const desdeConsola = red.consola.length
    const caminos = []
    const onNav = (frame) => {
      if (frame === paginaRed.mainFrame()) caminos.push(rutaDe(frame.url()))
    }
    paginaRed.on('framenavigated', onNav)
    let statusDocumento = 0
    let csp = null
    try {
      const respuesta = await paginaRed.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 25000 })
      statusDocumento = respuesta?.status() ?? 0
      csp = respuesta?.headers()['content-security-policy'] ?? null
      if (!red.cspDocumento) red.cspDocumento = leerCsp(csp)
      await paginaRed.waitForTimeout(400)
    } catch (error) {
      red.rutas.push({ path, error: String(error).slice(0, 300), rebote: true })
      paginaRed.off('framenavigated', onNav)
      continue
    }
    paginaRed.off('framenavigated', onNav)
    const final = rutaDe(paginaRed.url())
    const rebote = final !== path
    const bucle = hayBucle(caminos)
    red.rutas.push({
      path,
      urlFinal: final,
      statusDocumento,
      rebote,
      bucle,
      caminos: caminos.slice(0, 12),
      http: red.http.slice(desdeHttp),
      consola: red.consola.slice(desdeConsola),
    })
    if (rebote) hallazgos.push({ severidad: 'media', tipo: 'rebote', ruta: path, detalle: `Terminó en ${final}` })
    if (bucle) hallazgos.push({ severidad: 'alta', tipo: 'bucle-redireccion', ruta: path, detalle: caminos.slice(-6).join(' → ') })
    if (statusDocumento >= 500) hallazgos.push({ severidad: 'critica', tipo: 'http', ruta: path, detalle: `Documento ${statusDocumento}` })
    else if (statusDocumento >= 400) hallazgos.push({ severidad: 'alta', tipo: 'http', ruta: path, detalle: `Documento ${statusDocumento}` })
  }

  red.violaciones = await paginaRed.evaluate(async () => {
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    await new Promise((resolver) => {
      img.onload = () => resolver('img')
      img.onerror = () => resolver('img-error')
    })
    const blob = new Blob(['nutrifit'], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    let blobOk = false
    try {
      blobOk = (await fetch(url)).ok
    } catch {
      blobOk = false
    }
    URL.revokeObjectURL(url)
    return { imgOk: img.complete && img.naturalWidth > 0, blobOk, eventos: window.__csp ?? [] }
  })
  const csp = red.cspDocumento
  if (csp?.presente && (!csp.imgData || !csp.imgBlob || !csp.connectData || !csp.connectBlob)) {
    hallazgos.push({
      severidad: 'alta',
      tipo: 'csp',
      ruta: '/',
      detalle: 'La CSP del documento no permite data: o blob: en img-src o connect-src.',
    })
  }
  for (const evento of red.violaciones?.eventos ?? []) {
    const uri = String(evento.blockedURI ?? '')
    if (uri.startsWith('data:') || uri.startsWith('blob:')) {
      hallazgos.push({ severidad: 'alta', tipo: 'csp', ruta: '/', detalle: `${evento.violatedDirective} bloqueó ${uri.slice(0, 80)}` })
    }
  }
  if (!red.violaciones?.imgOk || !red.violaciones?.blobOk) {
    hallazgos.push({ severidad: 'alta', tipo: 'csp', ruta: '/', detalle: 'La sonda data: o blob: no cargó en el documento.' })
  }
  if (!csp?.presente && red.violaciones?.imgOk && red.violaciones?.blobOk) {
    hallazgos.push({
      severidad: 'info',
      tipo: 'csp',
      ruta: '/',
      detalle: 'El documento local no envía CSP y la sonda data:/blob: cargó. En producción img-src permite data: y blob:; connect-src no los incluye.',
    })
  }
  if (cspProduccion?.presente && (!cspProduccion.imgData || !cspProduccion.imgBlob)) {
    hallazgos.push({ severidad: 'alta', tipo: 'csp', ruta: PRODUCCION, detalle: 'La CSP pública bloquea data: o blob: en img-src.' })
  } else if (cspProduccion?.presente && (!cspProduccion.connectData || !cspProduccion.connectBlob)) {
    hallazgos.push({
      severidad: 'media',
      tipo: 'csp',
      ruta: PRODUCCION,
      detalle: 'connect-src de producción no incluye data: ni blob:. img-src sí. Las miniaturas van en <img>, no en fetch().',
    })
  }

  await paginaRed.close()

  const pagina = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await preparar(pagina, { http: [], consola: interfaz.consola })
  await pagina.addInitScript(PRELOAD)
  await pagina.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 25000 })

  async function clic(nombre, localizar, opciones = {}) {
    const objetivo = localizar()
    const visible = await objetivo.first().isVisible().catch(() => false)
    if (!visible) {
      interfaz.clics.push({ nombre, hecho: false, detalle: 'No está visible' })
      return false
    }
    const colgadosAntes = await pagina.locator('button[disabled]').count()
    try {
      await objetivo.first().click({ timeout: 8000 })
      interfaz.caminos.push(rutaDe(pagina.url()))
      await pagina.waitForTimeout(250)
      if (opciones.cerrar !== false) {
        const sigueAbierto = await cerrarDialogo(pagina)
        if (sigueAbierto) {
          interfaz.clics.push({ nombre, hecho: false, detalle: 'El modal no se cerró' })
          return false
        }
      }
      const colgados = await pagina.locator('button[disabled]').evaluateAll((els) =>
        els
          .map((el) => ({
            nombre: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80),
            busy: el.getAttribute('aria-busy'),
          }))
          .filter((b) => b.busy !== 'true' && !/cargando|guardando|enviando/i.test(b.nombre)),
      )
      if (colgados.length > colgadosAntes) {
        interfaz.botonesBloqueados.push(...colgados)
      }
      if (hayBucle(interfaz.caminos)) {
        hallazgos.push({ severidad: 'alta', tipo: 'bucle-redireccion', ruta: rutaDe(pagina.url()), detalle: `Tras pulsar ${nombre}` })
      }
      interfaz.clics.push({ nombre, hecho: true, detalle: 'Clic hecho' })
      return true
    } catch (error) {
      interfaz.clics.push({ nombre, hecho: false, detalle: String(error).split('\n')[0].slice(0, 220) })
      return false
    }
  }

  const nav = pagina.getByRole('navigation', { name: 'Principal' })
  const nombresNav = await nav.getByRole('button').allInnerTexts()
  for (const nombre of nombresNav.map((t) => t.trim()).filter(Boolean)) {
    if (/instalar|salir/i.test(nombre)) {
      interfaz.clics.push({ nombre, hecho: true, detalle: 'Omitido: no cierra sesión ni abre el instalador' })
      continue
    }
    await clic(nombre, () => nav.getByRole('button', { name: nombre, exact: true }))
    if (rutaDe(pagina.url()) !== '/') await pagina.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {})
  }

  const abrioBuscar = await clic('Buscar alimento', () => pagina.getByRole('button', { name: 'Buscar alimento' }), { cerrar: false })
  if (abrioBuscar) {
    const dialogo = pagina.getByRole('dialog', { name: 'Buscar alimento' })
    const abierto = await dialogo.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
    interfaz.clics.push({ nombre: 'Modal de búsqueda', hecho: abierto, detalle: abierto ? 'Diálogo abierto' : 'No apareció' })
    if (abierto) {
      const chips = dialogo.getByRole('group', { name: 'Categorías' }).getByRole('button')
      const total = await chips.count()
      let pulsados = 0
      for (let i = 0; i < total; i += 1) {
        const chip = chips.nth(i)
        const etiqueta = (await chip.innerText()).trim().slice(0, 40)
        await chip.click({ timeout: 4000 }).catch(() => {})
        await pagina.waitForTimeout(80)
        const activo = await chip.getAttribute('aria-pressed')
        if (activo === 'true') pulsados += 1
        else interfaz.clics.push({ nombre: `Chip ${etiqueta}`, hecho: false, detalle: `aria-pressed=${activo}` })
      }
      interfaz.clics.push({ nombre: 'Chips de categorías', hecho: pulsados === total && total > 0, detalle: `${pulsados}/${total} quedaron pulsados` })
      const cerrar = dialogo.getByRole('button', { name: 'Cerrar' })
      if (await cerrar.isVisible().catch(() => false)) await cerrar.click()
      await dialogo.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {})
    }
  }

  await clic('Fuerza', () => pagina.getByRole('button', { name: 'Fuerza', exact: true }))
  await clic('Cardio', () => pagina.getByRole('button', { name: 'Cardio', exact: true }))
  await clic('Mi perfil', () => pagina.getByRole('button', { name: 'Mi perfil' }))
  if (rutaDe(pagina.url()) !== '/profile') await pagina.goto(`${base}/profile`, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {})
  await clic('Pestaña Amigos', () => pagina.getByRole('tab', { name: 'Amigos' }))
  const anadir = await pagina.getByRole('button', { name: '+ Añadir' }).first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
  interfaz.clics.push({ nombre: 'Botón + Añadir', hecho: anadir, detalle: anadir ? 'Visible sin búsqueda' : 'No apareció la comunidad' })
  await clic('Pestaña Feed', () => pagina.getByRole('tab', { name: 'Feed' }))
  const calorias = await pagina.getByText(/\/\s*[\d.]+\s*kcal/).first().isVisible().catch(() => false)
  const carbos = await pagina.getByText('Carbohidratos', { exact: true }).first().isVisible().catch(() => false)
  interfaz.clics.push({ nombre: 'Calorías frente a meta', hecho: calorias && carbos, detalle: calorias && carbos ? 'kcal y Carbohidratos visibles' : 'Falta el contexto de la meta' })
  await pagina.screenshot({ path: join(tmpdir(), 'nf-auditoria-perfil.png'), fullPage: true }).catch(() => {})
  await pagina.setViewportSize({ width: 390, height: 844 })
  await pagina.getByRole('tab', { name: 'Feed' }).click().catch(() => {})
  await pagina.screenshot({ path: join(tmpdir(), 'nf-auditoria-movil.png'), fullPage: true }).catch(() => {})

  for (const item of red.http) {
    if (item.severidad === 'info') {
      hallazgos.push({ severidad: 'info', tipo: 'http', ruta: item.url, detalle: item.authYo ? `GET /api/auth/yo → ${item.status || item.fallo}. Sin sesión es la respuesta esperada.` : `HTTP ${item.status}` })
    } else if (item.severidad === 'baja' || item.severidad === 'media' || item.severidad === 'alta' || item.severidad === 'critica') {
      hallazgos.push({
        severidad: item.severidad,
        tipo: 'http',
        ruta: item.url,
        detalle: item.fallo
        ? item.fallo
        : item.status === 502 || item.status === 503
          ? `HTTP ${item.status}${item.authYo ? ' en /api/auth/yo' : ''}. El proxy de Vite no tiene Pages Functions en el puerto 8788, así que no hay sesión.`
          : `HTTP ${item.status}${item.authYo ? ' en /api/auth/yo' : ''}`,
      })
    }
  }
  for (const item of [...red.consola, ...interfaz.consola]) {
    const texto = item.texto ?? ''
    const cspMsg = /content security policy/i.test(texto)
    const dataBlob = /data:|blob:/i.test(texto)
    hallazgos.push({
      severidad: cspMsg && dataBlob ? 'alta' : cspMsg ? 'media' : 'media',
      tipo: item.tipo,
      ruta: '/',
      detalle: texto,
    })
  }
  for (const clicFallido of interfaz.clics.filter((c) => !c.hecho)) {
    hallazgos.push({ severidad: 'media', tipo: 'clic', ruta: '/', detalle: `${clicFallido.nombre}: ${clicFallido.detalle}` })
  }
  for (const boton of interfaz.botonesBloqueados) {
    hallazgos.push({ severidad: 'media', tipo: 'boton-bloqueado', ruta: '/', detalle: `${boton.nombre || 'botón'} está disabled sin aria-busy ni texto de carga` })
  }

  const orden = { critica: 0, alta: 1, media: 2, baja: 3, info: 4 }
  hallazgos.sort((a, b) => (orden[a.severidad] ?? 9) - (orden[b.severidad] ?? 9))
  const vistos = new Set()
  const unicos = []
  for (const hallazgo of hallazgos) {
    const clave = `${hallazgo.severidad}|${hallazgo.tipo}|${hallazgo.detalle}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    unicos.push(hallazgo)
  }
  hallazgos.length = 0
  hallazgos.push(...unicos)
  const graves = hallazgos.filter((h) => h.severidad === 'critica' || h.severidad === 'alta')
  const informe = {
    generado: new Date().toISOString(),
    base,
    sesionInterfaz: 'simulada en el cliente; los clics no autentican y /api no sale a la red',
    cspProduccion,
    resumen: graves.length
      ? `${graves.length} ${graves.length === 1 ? 'hallazgo alto o crítico' : 'hallazgos altos o críticos'}`
      : 'Sin hallazgos altos ni críticos',
    hallazgos,
    red,
    interfaz: { clics: interfaz.clics, botonesBloqueados: interfaz.botonesBloqueados, caminos: interfaz.caminos },
  }
  writeFileSync(new URL('../auditoria-reporte.json', import.meta.url), `${JSON.stringify(informe, null, 2)}\n`)
  console.log(JSON.stringify({ base, resumen: informe.resumen, hallazgos: hallazgos.length, graves: graves.length }, null, 2))
  await browser.close()
  process.exitCode = graves.length ? 1 : 0
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
