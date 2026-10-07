export interface StravaActivity {
  id: number
  name: string
  distance: number
  moving_time: number
  type: string
  kilojoules?: number
  calories?: number
  start_date: string
}

export const StravaService = {
  getAuthUrl: () => `https://www.strava.com/oauth/authorize?client_id=12345&response_type=code&redirect_uri=${encodeURIComponent(window.location.origin + '/ajustes')}&approval_prompt=auto&scope=read,activity:read_all`,
  isConnected: () => Boolean(localStorage.getItem('nutrifit_strava_token')),
  desconectar: () => {
    localStorage.removeItem('nutrifit_strava_token')
    localStorage.removeItem('nutrifit_strava_athlete')
  },
  obtenerActividadesHoy: async (): Promise<StravaActivity[]> => {
    const token = localStorage.getItem('nutrifit_strava_token')
    if (!token) return []
    const hoyInicio = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000)
    try {
      const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${hoyInicio}&per_page=10`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  },
  calcularCaloriasActividades: (actividades: StravaActivity[]): number => {
    return actividades.reduce((acc, act) => acc + (act.calories || (act.kilojoules ? Math.round(act.kilojoules) : Math.round((act.moving_time / 60) * 8))), 0)
  }
}
