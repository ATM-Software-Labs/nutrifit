import re

with open('src/components/WidgetAyuno.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_state = """  const [ahora, setAhora] = useState(new Date())
  const [notifAyuno, setNotifAyuno] = useState(false)

  const cargarPreferencias = () => {
    setAyunoActivo(localStorage.getItem('nf:ayunoActivo') === 'true')
    setTipoAyuno(localStorage.getItem('nf:tipoAyuno') || '16/8')
    setHoraInicio(localStorage.getItem('nf:horaInicioAyuno') || '20:00')
    setNotifAyuno(localStorage.getItem('nf:notifAyuno') === 'true')
  }"""

content = content.replace("""  const [ahora, setAhora] = useState(new Date())

  const cargarPreferencias = () => {
    setAyunoActivo(localStorage.getItem('nf:ayunoActivo') === 'true')
    setTipoAyuno(localStorage.getItem('nf:tipoAyuno') || '16/8')
    setHoraInicio(localStorage.getItem('nf:horaInicioAyuno') || '20:00')
  }""", new_state)

new_effect = """  useEffect(() => {
    cargarPreferencias()
    window.addEventListener('nf:preferencias_actualizadas', cargarPreferencias)
    const interval = setInterval(() => {
      const now = new Date()
      setAhora(now)
      
      // Chequear notificaciones
      if (localStorage.getItem('nf:notifAyuno') === 'true') {
        const lastNotif = localStorage.getItem('nf:lastNotifTime')
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
           const horasAyuno = parseInt((localStorage.getItem('nf:tipoAyuno') || '16').split('/')[0])
           const [h, m] = (localStorage.getItem('nf:horaInicioAyuno') || '20:00').split(':').map(Number)
           const inicio = new Date(now)
           inicio.setHours(h, m, 0, 0)
           if (now < inicio) inicio.setDate(inicio.getDate() - 1)
           const fin = new Date(inicio.getTime() + horasAyuno * 3600000)
           
           if (now >= fin && now.getTime() - fin.getTime() < 60000) {
             if (lastNotif !== fin.getTime().toString()) {
               try {
                 if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                   navigator.serviceWorker.ready.then(sw => {
                     sw.showNotification('¡Ayuno completado!', {
                       body: 'Tu ventana de alimentación ha comenzado.',
                       icon: '/icon-192x192.png'
                     })
                   })
                 } else {
                   new Notification('¡Ayuno completado!', {
                     body: 'Tu ventana de alimentación ha comenzado.',
                     icon: '/icon-192x192.png'
                   });
                 }
                 localStorage.setItem('nf:lastNotifTime', fin.getTime().toString())
               } catch (e) {}
             }
           }
        }
      }
    }, 60000)
    return () => {
      window.removeEventListener('nf:preferencias_actualizadas', cargarPreferencias)
      clearInterval(interval)
    }
  }, [])"""

content = re.sub(r"  useEffect\(\(\) => \{[^}]+\}, \[\]\)", new_effect, content)

with open('src/components/WidgetAyuno.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
