import { useEffect, useState } from 'react'

export function WidgetAyuno() {
  const [ayunoActivo, setAyunoActivo] = useState(false)
  const [tipoAyuno, setTipoAyuno] = useState('16/8')
  const [horaInicio, setHoraInicio] = useState('20:00')
  const [ahora, setAhora] = useState(new Date())
  

  const cargarPreferencias = () => {
    setAyunoActivo(localStorage.getItem('nf:ayunoActivo') === 'true')
    setTipoAyuno(localStorage.getItem('nf:tipoAyuno') || '16/8')
    setHoraInicio(localStorage.getItem('nf:horaInicioAyuno') || '20:00')
    
  }

  useEffect(() => {
    cargarPreferencias()
    window.addEventListener('nf:preferencias_actualizadas', cargarPreferencias)
    const interval = setInterval(() => setAhora(new Date()), 60000)
    return () => {
      window.removeEventListener('nf:preferencias_actualizadas', cargarPreferencias)
      clearInterval(interval)
    }
  }, [])

  if (!ayunoActivo) return null

  // Calcular horas de ayuno basadas en el protocolo
  let horasAyuno = 16
  if (tipoAyuno === '18/6') horasAyuno = 18
  if (tipoAyuno === '20/4') horasAyuno = 20
  if (tipoAyuno === 'OMAD') horasAyuno = 23

  const [inicioH, inicioM] = horaInicio.split(':').map(Number)
  
  // Calcular fecha de inicio de ayuno más reciente
  const fechaInicio = new Date(ahora)
  fechaInicio.setHours(inicioH, inicioM, 0, 0)
  if (ahora < fechaInicio) {
    fechaInicio.setDate(fechaInicio.getDate() - 1)
  }

  // Calcular fecha de fin de ayuno
  const fechaFin = new Date(fechaInicio.getTime() + horasAyuno * 60 * 60 * 1000)
  
  const esFasting = ahora >= fechaInicio && ahora < fechaFin
  
  // Calcular progreso si estamos en ayuno, o tiempo para el próximo si no
  let progreso = 0
  let estadoTexto = ''
  let tiempoTexto = ''

  if (esFasting) {
    const totalAyunoMs = horasAyuno * 60 * 60 * 1000
    const transcurridoMs = ahora.getTime() - fechaInicio.getTime()
    progreso = Math.min(100, Math.max(0, (transcurridoMs / totalAyunoMs) * 100))
    
    const restanteMs = fechaFin.getTime() - ahora.getTime()
    const horasRestantes = Math.floor(restanteMs / (1000 * 60 * 60))
    const minRestantes = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60))
    
    estadoTexto = 'Ayuno activo'
    tiempoTexto = `Quedan ${horasRestantes}h ${minRestantes}m`
  } else {
    estadoTexto = 'Ventana de alimentación'
    
    // El próximo ayuno empieza en la próxima fechaInicio
    const proximoInicio = new Date(fechaInicio)
    proximoInicio.setDate(proximoInicio.getDate() + 1)
    
    const restanteMs = proximoInicio.getTime() - ahora.getTime()
    const horasRestantes = Math.floor(restanteMs / (1000 * 60 * 60))
    const minRestantes = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60))
    
    tiempoTexto = `Ayuno en ${horasRestantes}h ${minRestantes}m`
    progreso = 100 // Lleno cuando puedes comer, o vacío. Pongamos 0
    progreso = 0
  }

  const formatoHora = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="tarjeta flex flex-col gap-3 px-6 py-5 bg-neutral-50 dark:bg-neutral-900/40">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
          {esFasting ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mint-600"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          )}
          {estadoTexto}
        </h3>
        <span className="text-xs font-bold text-mint-600 dark:text-mint-400 bg-mint-50 dark:bg-mint-400/10 px-2 py-0.5 rounded-full">
          {tipoAyuno}
        </span>
      </div>

      <div className="flex justify-between items-end mt-1">
        <div className="text-2xl font-bold text-graphite dark:text-white tracking-tight">
          {tiempoTexto}
        </div>
        <div className="text-xs text-neutral-500 font-medium">
          {esFasting ? `Termina a las ${formatoHora(fechaFin)}` : `Empieza a las ${formatoHora(new Date(fechaInicio.getTime() + 24 * 60 * 60 * 1000))}`}
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden mt-2">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${esFasting ? 'bg-mint-500' : 'bg-emerald-500'}`} 
          style={{ width: `${esFasting ? progreso : 100}%` }}
        />
      </div>
      
      <div className="flex justify-between text-[10px] text-neutral-400 mt-1 uppercase tracking-wider font-semibold">
        <span>{formatoHora(fechaInicio)}</span>
        <span>{formatoHora(fechaFin)}</span>
      </div>
    </div>
  )
}
