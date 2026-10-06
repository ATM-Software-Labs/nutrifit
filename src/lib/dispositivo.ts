/** Plataforma del dispositivo (módulo puro, testeable con node --test). */
export type Plataforma = 'android' | 'ios' | 'escritorio'

interface NavegadorMin {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  userAgentData?: { platform?: string; mobile?: boolean }
}

/**
 * android | ios | escritorio. Usa userAgentData (Chromium) si existe y, si no,
 * el userAgent. iPadOS 13+ se anuncia como «Macintosh»: lo delata la pantalla táctil.
 */
export function detectarPlataforma(nav: NavegadorMin = (globalThis as { navigator?: NavegadorMin }).navigator ?? {}): Plataforma {
  const p = nav.userAgentData?.platform
  if (p) {
    if (/android/i.test(p)) return 'android'
    if (/ios|iphone|ipad/i.test(p)) return 'ios'
  }
  const ua = nav.userAgent ?? ''
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1)) return 'ios'
  return 'escritorio'
}
