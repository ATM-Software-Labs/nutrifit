export interface EjercicioDef {
  id: string
  nombre: string
  categoria: 'fuerza' | 'cardio' | 'deportes' | 'movilidad'
  met: number
}

export const LISTA_EJERCICIOS: EjercicioDef[] = [
  { id: 'pesas_pesado', nombre: 'Gimnasio / Halterofilia / Fuerza intensa', categoria: 'fuerza', met: 6.0 },
  { id: 'pesas_moderado', nombre: 'Musculación moderada / Hipertrofia', categoria: 'fuerza', met: 3.8 },
  { id: 'calistenia', nombre: 'Calistenia / Peso corporal', categoria: 'fuerza', met: 5.5 },
  { id: 'crossfit', nombre: 'CrossFit / Circuit Training', categoria: 'fuerza', met: 8.0 },
  { id: 'caminar_ligero', nombre: 'Caminar suave (4 km/h)', categoria: 'cardio', met: 3.0 },
  { id: 'caminar_rapido', nombre: 'Caminar a paso ligero (6 km/h)', categoria: 'cardio', met: 4.8 },
  { id: 'correr_moderado', nombre: 'Running suave / Rodaje (8-10 km/h)', categoria: 'cardio', met: 8.3 },
  { id: 'correr_rapido', nombre: 'Running intenso / Series (>11 km/h)', categoria: 'cardio', met: 11.5 },
  { id: 'ciclismo_moderado', nombre: 'Ciclismo de carretera / Urbano', categoria: 'cardio', met: 6.8 },
  { id: 'ciclismo_estatica', nombre: 'Bici estática / Spinning', categoria: 'cardio', met: 7.0 },
  { id: 'natacion', nombre: 'Natación (crol / estilo libre)', categoria: 'cardio', met: 7.0 },
  { id: 'eliptica', nombre: 'Elíptica / Remo máquina', categoria: 'cardio', met: 6.5 },
  { id: 'futbol', nombre: 'Fútbol / Fútbol sala', categoria: 'deportes', met: 8.0 },
  { id: 'baloncesto', nombre: 'Baloncesto', categoria: 'deportes', met: 7.5 },
  { id: 'padel', nombre: 'Pádel / Tenis (individual o dobles)', categoria: 'deportes', met: 7.0 },
  { id: 'boxeo', nombre: 'Boxeo / Artes marciales / Saco', categoria: 'deportes', met: 8.5 },
  { id: 'yoga', nombre: 'Yoga / Pilates', categoria: 'movilidad', met: 3.0 },
  { id: 'estiramientos', nombre: 'Movilidad articular / Estiramientos', categoria: 'movilidad', met: 2.3 },
  { id: 'limpieza_casa', nombre: 'Tareas del hogar / Tareas activas', categoria: 'movilidad', met: 2.8 },
]

export function calcularCaloriasQuemadas(met: number, pesoKg: number, minutos: number): number {
  if (!pesoKg || pesoKg <= 0 || !minutos || minutos <= 0) return 0
  return Math.round(met * pesoKg * (minutos / 60))
}
