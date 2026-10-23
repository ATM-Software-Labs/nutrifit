// Fuera de línea por la CSP (script-src 'self'): un script inline no se ejecutaría.
(function () {
  var peso = document.getElementById('peso')
  function calcular() {
    var p = parseFloat(peso.value) || 0
    document.getElementById('creatina').textContent = (p * 0.1).toFixed(1).replace('.', ',') + ' g'
    document.getElementById('agua').textContent = ((p * 35) / 1000).toFixed(1).replace('.', ',') + ' L'
  }
  peso.addEventListener('input', calcular)
  calcular()
})()
