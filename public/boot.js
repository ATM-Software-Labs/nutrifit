/* NutriFit · vigilante de arranque (script clásico, se carga ANTES que la app).
 *
 * Evita la «pantalla blanca» cuando el HTML apunta a recursos con hash que el
 * navegador no puede usar (despliegue nuevo, Service Worker o caché HTTP con
 * una versión vieja, CSS/JS servido como HTML…):
 *   1. Si falla un <script>/<link> de /assets/ → borra las cachés del SW, vuelve
 *      a pedir esos recursos a la red (cache: 'reload' sobrescribe la caché HTTP)
 *      y recarga la página UNA vez (protección anti-bucle de 30 s).
 *   2. Si la app no llega a arrancar en 10 s → lo mismo.
 *   3. Si ya se recargó y sigue fallando → aviso en español con botón «Recargar».
 * La app usa window.__nf.recuperar() para los chunks diferidos que fallen.
 * Sin dependencias ni estilos externos (estilos por CSSOM: compatible con la CSP).
 */
;(function () {
  'use strict'
  var CLAVE = 'nf:recarga'
  var VENTANA_MS = 30000
  var fallidos = []
  var recargando = false

  function limpiarCaches() {
    var tareas = []
    try {
      if (window.caches) {
        tareas.push(
          caches.keys().then(function (ks) {
            return Promise.all(ks.filter(function (k) { return k.indexOf('nf-estatico') === 0 || k.indexOf('nf-paginas') === 0 }).map(function (k) { return caches.delete(k) }))
          }),
        )
      }
    } catch (e) { /* sin Cache Storage */ }
    return Promise.all(tareas).catch(function () {})
  }

  function refrescar(urls) {
    return Promise.all(
      urls.map(function (u) {
        try { return fetch(u, { cache: 'reload', credentials: 'same-origin' }).catch(function () {}) } catch (e) { return null }
      }),
    ).catch(function () {})
  }

  function recargarYa(urls) {
    if (recargando) return
    recargando = true
    var fin = function () { window.location.reload() }
    var limite = setTimeout(fin, 4000)
    limpiarCaches()
      .then(function () { return refrescar(urls || fallidos) })
      .then(function () { clearTimeout(limite); fin() }, function () { clearTimeout(limite); fin() })
  }

  /** Recarga una sola vez por ventana de 30 s. Devuelve true si va a recargar. */
  function recuperar(urls) {
    if (recargando) return true
    var ahora = Date.now()
    var ultima = 0
    try { ultima = Number(sessionStorage.getItem(CLAVE)) || 0 } catch (e) { return false }
    if (ahora - ultima < VENTANA_MS) return false
    try { sessionStorage.setItem(CLAVE, String(ahora)) } catch (e) { return false }
    recargarYa(urls)
    return true
  }

  function aplicar(el, estilos) { for (var k in estilos) el.style[k] = estilos[k] }

  /** Aviso mínimo (por si ni siquiera ha cargado React ni el CSS). */
  function mostrarFallo() {
    if (document.getElementById('nf-fallo')) return
    var oscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    var caja = document.createElement('div')
    caja.id = 'nf-fallo'
    caja.setAttribute('role', 'alert')
    aplicar(caja, {
      position: 'fixed', inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '16px', padding: '24px', textAlign: 'center', zIndex: '2147483647',
      background: oscuro ? '#09090B' : '#FAFAFA', color: oscuro ? '#F4F4F5' : '#111827',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    })
    var punto = document.createElement('div')
    aplicar(punto, { width: '12px', height: '12px', borderRadius: '9999px', background: '#10B981' })
    var titulo = document.createElement('p')
    titulo.textContent = 'No hemos podido cargar NutriFit'
    aplicar(titulo, { margin: '0', fontSize: '20px', fontWeight: '600' })
    var texto = document.createElement('p')
    texto.textContent = 'Puede que tengas guardada una versión antigua. Recarga para descargar la última.'
    aplicar(texto, { margin: '0', maxWidth: '320px', fontSize: '15px', lineHeight: '1.5', color: oscuro ? '#A1A1AA' : '#6B7280' })
    var boton = document.createElement('button')
    boton.type = 'button'
    boton.textContent = 'Recargar'
    aplicar(boton, {
      marginTop: '8px', height: '44px', padding: '0 20px', border: '0', borderRadius: '16px', cursor: 'pointer',
      background: '#047857', color: '#FFFFFF', fontSize: '15px', fontWeight: '500', fontFamily: 'inherit',
    })
    boton.addEventListener('click', function () { recargarYa(fallidos) })
    caja.appendChild(punto)
    caja.appendChild(titulo)
    caja.appendChild(texto)
    caja.appendChild(boton)
    ;(document.body || document.documentElement).appendChild(caja)
  }

  function alFallar(url, esEstilo) {
    if (url && fallidos.indexOf(url) === -1) fallidos.push(url)
    // Ya se recargó una vez: aviso propio solo si React no ha arrancado (si arrancó,
    // su ErrorBoundary se encarga) o si lo que falta es el CSS.
    if (!recuperar() && (!window.__nfIniciado || esEstilo)) {
      if (document.body) mostrarFallo()
      else document.addEventListener('DOMContentLoaded', mostrarFallo)
    }
  }

  // Errores de carga de recursos (no burbujean: fase de captura).
  window.addEventListener(
    'error',
    function (e) {
      var el = e && e.target
      if (!el || el === window || !el.tagName) return
      var tag = el.tagName
      var url = tag === 'SCRIPT' ? el.src : tag === 'LINK' && /stylesheet|modulepreload/.test(el.rel) ? el.href : ''
      if (url && url.indexOf('/assets/') !== -1) alFallar(url, tag === 'LINK' && el.rel === 'stylesheet')
    },
    true,
  )

  // La app marca window.__nfIniciado al ejecutar su módulo principal.
  window.addEventListener('load', function () {
    setTimeout(function () {
      var raiz = document.getElementById('root')
      if (!window.__nfIniciado && raiz && !raiz.hasChildNodes()) alFallar()
    }, 10000)
  })

  window.__nf = { recuperar: recuperar, recargar: function () { recargarYa(fallidos) }, mostrarFallo: mostrarFallo }
})()
