/**
 * Reloj — Durable Object (SQLite, plan gratuito) que sustituye al Cron Trigger.
 * La cuenta ya usa sus 5 Cron Triggers gratuitos y el cron de GitHub Actions llega con
 * horas de retraso, así que una alarma de DO dispara la ronda cada 5 minutos:
 * primero se rearma (para que un fallo no la detenga) y después llama a
 * POST {APP_URL}/api/interno/cron con x-cron-secret. Toda la lógica vive en Pages.
 */
import { DurableObject } from 'cloudflare:workers'
import { siguienteAlarma } from './reloj-calc.ts'

export interface EnvReloj {
  APP_URL: string
  CRON_SECRET?: string
}

export class Reloj extends DurableObject<EnvReloj> {
  async armar(): Promise<{ siguiente: number; ultima: string | null }> {
    let siguiente = await this.ctx.storage.getAlarm()
    if (siguiente === null) {
      siguiente = siguienteAlarma(Date.now())
      await this.ctx.storage.setAlarm(siguiente)
    }
    const ultima = await this.ctx.storage.get('ultima')
    return { siguiente, ultima: ultima ? JSON.stringify(ultima) : null }
  }

  override async alarm(): Promise<void> {
    await this.ctx.storage.setAlarm(siguienteAlarma(Date.now()))
    const inicio = Date.now()
    let estado: number | string
    try {
      if (!this.env.CRON_SECRET) throw new Error('falta CRON_SECRET')
      const r = await fetch(`${this.env.APP_URL}/api/interno/cron`, {
        method: 'POST',
        headers: { 'x-cron-secret': this.env.CRON_SECRET, 'content-type': 'application/json', 'user-agent': 'nutrifit-reloj' },
        body: '{}',
        signal: AbortSignal.timeout(50_000),
      })
      estado = r.status
      const txt = (await r.text()).slice(0, 300)
      console.log('[reloj]', r.status, txt)
    } catch (e) {
      estado = e instanceof Error ? e.message : String(e)
      console.log('[reloj] error', estado)
    }
    await this.ctx.storage.put('ultima', { en: new Date(inicio).toISOString(), estado, ms: Date.now() - inicio })
  }
}
