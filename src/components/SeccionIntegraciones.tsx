import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Integracion {
  proveedor: string
  estado: string | null
}

export function SeccionIntegraciones() {
  const [integraciones, setIntegraciones] = useState<Integracion[]>([])
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('nf:webhook_url') || '')
  const [webhookActivo, setWebhookActivo] = useState(() => localStorage.getItem('nf:webhook_activo') === 'true')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  useEffect(() => {
    let vivo = true
    api
      .integraciones()
      .then((r) => {
        if (vivo) setIntegraciones(r.integraciones.filter((i) => i.proveedor.toLowerCase() !== 'strava'))
      })
      .catch(() => {
        if (vivo) setIntegraciones([])
      })
    return () => {
      vivo = false
    }
  }, [])

  const handleWebhookToggle = () => {
    const nextState = !webhookActivo;
    setWebhookActivo(nextState)
    localStorage.setItem('nf:webhook_activo', String(nextState))
  }

  const handleWebhookChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setWebhookUrl(val)
    localStorage.setItem('nf:webhook_url', val)
  }

  const testWebhook = async () => {
    if (!webhookUrl) return
    setTestStatus('testing')
    try {
      // Intentamos hacer un ping real (modo no-cors o cors si es n8n/home assistant)
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ event: 'ping', app: 'NutriFit', timestamp: new Date().toISOString() })
      })
      setTestStatus('success')
      setTimeout(() => setTestStatus('idle'), 3000)
    } catch {
      setTestStatus('error')
      setTimeout(() => setTestStatus('idle'), 3000)
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-card p-5 dark:border-neutral-800 dark:bg-card-dark">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-graphite dark:text-neutral-100">Integraciones y Wearables</h3>
        <p className="mt-1 text-sm text-neutral-500">Servicios conectados a tu cuenta.</p>
      </div>
      
      {/* Integraciones Nativas del Servidor */}
      {integraciones.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          {integraciones.map((i) => (
            <div key={i.proveedor} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-sm font-semibold text-graphite dark:text-neutral-100">{i.proveedor}</div>
              <span className="text-xs text-neutral-500 capitalize">{i.estado ?? 'Conectado'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Webhook Open Source (n8n / Home Assistant) */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-graphite dark:text-neutral-100">Webhook Personal (Open Source)</div>
            <div className="text-xs text-neutral-500">Exporta tu nutrición a n8n, Home Assistant o similares.</div>
          </div>
          <button
            onClick={handleWebhookToggle}
            className={`relative h-[26px] w-[46px] rounded-full transition-colors shrink-0 ml-3 ${
              webhookActivo ? 'bg-mint-500' : 'bg-neutral-200 dark:bg-neutral-800'
            }`}
          >
            <div
              className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white transition-all ${
                webhookActivo ? 'left-[23px]' : 'left-[3px]'
              }`}
            />
          </button>
        </div>

        {webhookActivo && (
          <div className="mt-3 flex flex-col gap-3">
            <input 
              type="url" 
              placeholder="https://tu-n8n.com/webhook/nutrifit" 
              value={webhookUrl}
              onChange={handleWebhookChange}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-graphite focus:border-mint-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-mint-500"
            />
            <div className="flex justify-end">
              <button 
                onClick={testWebhook}
                disabled={!webhookUrl || testStatus === 'testing'}
                className="rounded-lg bg-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-300 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                {testStatus === 'testing' ? 'Enviando...' : testStatus === 'success' ? '¡Conectado!' : testStatus === 'error' ? 'Error de red' : 'Probar conexión'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
