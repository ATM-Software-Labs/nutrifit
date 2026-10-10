import { useState, useEffect } from 'react'

export function SeccionPreferenciasAvanzadas() {
  const [ayunoActivo, setAyunoActivo] = useState(() => localStorage.getItem('nf:ayunoActivo') === 'true')
  const [tipoAyuno, setTipoAyuno] = useState(() => localStorage.getItem('nf:tipoAyuno') || '16/8')
  const [horaInicio, setHoraInicio] = useState(() => localStorage.getItem('nf:horaInicioAyuno') || '20:00')
  const [protPorKg, setProtPorKg] = useState(() => Number(localStorage.getItem('nf:protPorKg')) || 1.8)
  const [notifAyuno, setNotifAyuno] = useState(() => localStorage.getItem('nf:notifAyuno') === 'true')

  useEffect(() => {
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
  }

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-card p-5 dark:border-neutral-800 dark:bg-card-dark">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-graphite dark:text-neutral-100">
          Estrategia Nutricional y Ayuno
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          Personaliza cómo se calculan tus necesidades y ventanas horarias.
        </p>
      </div>

      {/* Ajuste de Proteínas por Peso */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-graphite dark:text-neutral-100">Cálculo de Proteína</div>
            <div className="text-xs text-neutral-500">Ajusta los gramos por kilogramo de peso corporal</div>
          </div>
          <span className="text-[15px] font-bold text-mint-600 dark:text-mint-400">{protPorKg} g/kg</span>
        </div>
        <input
          type="range"
          min={1.2}
          max={2.6}
          step={0.1}
          value={protPorKg}
          onChange={(e) => setProtPorKg(Number(e.target.value))}
          className="w-full accent-mint-600 dark:accent-mint-500"
        />
        <div className="mt-1 flex justify-between text-[11px] text-neutral-500">
          <span>1.2 g</span>
          <span>1.8 - 2.2 g</span>
          <span>2.6 g</span>
        </div>
      </div>

      {/* Ayuno Intermitente */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-graphite dark:text-neutral-100">Temporizador de Ayuno</div>
            <div className="text-xs text-neutral-500">Muestra tu ventana de alimentación en el dashboard</div>
          </div>
          <button
            onClick={() => setAyunoActivo(!ayunoActivo)}
            className={`relative h-[26px] w-[46px] rounded-full transition-colors ${
              ayunoActivo ? 'bg-mint-500' : 'bg-neutral-200 dark:bg-neutral-800'
            }`}
          >
            <div
              className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white transition-all ${
                ayunoActivo ? 'left-[23px]' : 'left-[3px]'
              }`}
            />
          </button>
        </div>

        {ayunoActivo && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex gap-2">
              {['16/8', '18/6', '20/4', 'OMAD'].map((protocolo) => (
                <button
                  key={protocolo}
                  onClick={() => setTipoAyuno(protocolo)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                    tipoAyuno === protocolo
                      ? 'border-mint-500 bg-mint-50 text-mint-600 dark:border-mint-500/50 dark:bg-mint-500/10 dark:text-mint-400'
                      : 'border-transparent bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800/50 dark:hover:bg-neutral-800'
                  }`}
                >
                  {protocolo}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-800/50">
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
