import { Barcode, Beef, CalendarCheck, Camera, Droplet, Flame, Scale, Star, Sunrise, Target, Utensils } from 'lucide-react'

const ICONOS = { utensils: Utensils, camera: Camera, flame: Flame, beef: Beef, droplet: Droplet, scale: Scale, barcode: Barcode, target: Target, sunrise: Sunrise, calendar: CalendarCheck, star: Star }

export function IconoLogro({ icono, size = 22, className }: { icono: string; size?: number; className?: string }) {
  const C = ICONOS[icono as keyof typeof ICONOS] ?? Star
  return <C size={size} strokeWidth={1.75} className={className} aria-hidden="true" />
}
