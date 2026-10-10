import re

with open('src/components/SeccionPreferenciasAvanzadas.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_state = """  const [horaInicio, setHoraInicio] = useState(() => localStorage.getItem('nf:horaInicioAyuno') || '20:00')
  const [protPorKg, setProtPorKg] = useState(() => Number(localStorage.getItem('nf:protPorKg')) || 1.8)
  const [notifAyuno, setNotifAyuno] = useState(() => localStorage.getItem('nf:notifAyuno') === 'true')"""

content = content.replace("  const [horaInicio, setHoraInicio] = useState(() => localStorage.getItem('nf:horaInicioAyuno') || '20:00')\n  const [protPorKg, setProtPorKg] = useState(() => Number(localStorage.getItem('nf:protPorKg')) || 1.8)", new_state)

new_effect = """  useEffect(() => {
    localStorage.setItem('nf:ayunoActivo', String(ayunoActivo))
    localStorage.setItem('nf:tipoAyuno', tipoAyuno)
    localStorage.setItem('nf:horaInicioAyuno', horaInicio)
    localStorage.setItem('nf:protPorKg', String(protPorKg))
    localStorage.setItem('nf:notifAyuno', String(notifAyuno))
    window.dispatchEvent(new Event('nf:preferencias_actualizadas'))
  }, [ayunoActivo, tipoAyuno, horaInicio, protPorKg, notifAyuno])

  const toggleNotif = async () => {
    if (!notifAyuno) {
      if (typeof Notification !== 'undefined') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setNotifAyuno(true);
        } else {
          alert('Permiso denegado. Habilítalo en tu navegador.');
        }
      } else {
        alert('Tu navegador no soporta notificaciones.');
      }
    } else {
      setNotifAyuno(false);
    }
  }"""

content = re.sub(r"  useEffect\(\(\) => \{[^}]+\}, \[ayunoActivo, tipoAyuno, horaInicio, protPorKg\]\)", new_effect, content)

new_ui = """            <div className="flex items-center justify-between rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-800/50">
              <span className="text-sm text-neutral-600 dark:text-neutral-300">Hora de inicio de ayuno</span>
              <input 
                type="time" 
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-medium text-graphite dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
            
            <div className="flex items-center justify-between rounded-lg bg-neutral-100 px-3 py-2 mt-2 dark:bg-neutral-800/50">
              <div className="flex flex-col">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Notificaciones Push</span>
                <span className="text-[10px] text-neutral-500">Avisa cuando termine la ventana de ayuno</span>
              </div>
              <button
                onClick={toggleNotif}
                className={`relative h-[22px] w-[40px] rounded-full transition-colors ${
                  notifAyuno ? 'bg-mint-500' : 'bg-neutral-300 dark:bg-neutral-700'
                }`}
              >
                <div
                  className={`absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white transition-all ${
                    notifAyuno ? 'left-[21px]' : 'left-[3px]'
                  }`}
                />
              </button>
            </div>"""

content = content.replace("""            <div className="flex items-center justify-between rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-800/50">
              <span className="text-sm text-neutral-600 dark:text-neutral-300">Hora de inicio de ayuno</span>
              <input 
                type="time" 
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-medium text-graphite dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>""", new_ui)

with open('src/components/SeccionPreferenciasAvanzadas.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
