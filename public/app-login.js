// NutriFit · /app-login — botones "Abrir en la app" / "Entrar en la web".
;(function () {
  var PAQUETE = 'com.trujillomingorance.nutrifit'
  var token = new URLSearchParams(location.search).get('token') || ''
  // Quita el token de la barra de direcciones y del historial.
  try { history.replaceState(null, '', location.pathname) } catch (e) {}

  var $ = function (id) { return document.getElementById(id) }
  if (!/^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/.test(token) || token.length > 1024) {
    $('titulo').textContent = 'Enlace incompleto'
    $('texto').textContent = 'Copia el enlace completo del correo o pide uno nuevo desde la app.'
    $('ayuda').hidden = false
    return
  }
  var t = encodeURIComponent(token)
  var android = /Android/i.test(navigator.userAgent)
  var app = $('abrir-app')
  var web = $('entrar-web')

  // intent:// abre la app si está instalada; si no, Chrome va a la página de descarga.
  var respaldo = encodeURIComponent(location.origin + '/descargar')
  app.href = android
    ? 'intent://login?token=' + t + '#Intent;scheme=' + PAQUETE + ';package=' + PAQUETE + ';S.browser_fallback_url=' + respaldo + ';end'
    : PAQUETE + '://login?token=' + t
  web.href = '/api/auth/verificar?token=' + t

  if (android) {
    app.hidden = false
    web.hidden = false
  } else {
    $('texto').textContent = 'Este enlace se pidió desde la app de Android. Puedes usarlo para entrar en la versión web en este dispositivo.'
    web.hidden = false
    web.className = 'boton primario'
  }
  $('ayuda').hidden = false
})()
