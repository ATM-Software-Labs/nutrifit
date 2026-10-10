/** Navegación lateral de escritorio (≥ lg). En móvil no se renderiza (hidden). */
import { useState, type ReactNode } from 'react'
import { ChartColumn, Download, Droplet, House, LogOut, Plus, Scale, Settings, User } from 'lucide-react'
import { Logo } from './Logo.tsx'
import { cx } from './ui/cx.ts'
import { BloqueDescarga } from './BloqueDescarga.tsx'
import { ofrecerDescarga } from '../lib/instalacion.ts'
import { useIdioma } from '../hooks/useIdioma.ts'
import type { Usuario } from '../lib/tipos.ts'

const CLASE_ITEM =
  'flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors duration-150 focus-visible:ring-offset-0'

function Item({ icono, children, activo, onClick, href, expandido }: { icono: ReactNode; children: ReactNode; activo?: boolean; onClick?: () => void; href?: string; expandido?: boolean }) {
  const clase = cx(
    CLASE_ITEM,
    activo
      ? 'bg-mint-50 text-mint-800 dark:bg-mint-950 dark:text-mint-300'
      : 'text-neutral-600 hover:bg-neutral-100 hover:text-graphite dark:text-neutral-300 dark:hover:bg-neutral-800/70 dark:hover:text-white',
  )
  const contenido = (
    <>
      <span className={cx('shrink-0', activo ? 'text-mint-700 dark:text-mint-400' : 'text-neutral-400 dark:text-neutral-500')}>{icono}</span>
      {children}
    </>
  )
  return (
    <li>
      {href ? (
        <a href={href} className={clase}>
          {contenido}
        </a>
      ) : (
        <button type="button" onClick={onClick} className={clase} aria-current={activo ? 'page' : undefined} aria-expanded={expandido}>
          {contenido}
        </button>
      )}
    </li>
  )
}

export function BarraLateral({
  usuario,
  vista,
  onHoy,
  onHistorial,
  onAnadir,
  onPeso,
  onAgua,
  onAjustes,
  onPerfil,
  onSalir,
}: {
  usuario: Usuario
  vista: 'hoy' | 'historial' | 'profile' | 'ajustes' | 'peso'
  onHoy: () => void
  onHistorial: () => void
  onAnadir: () => void
  onPeso: () => void
  onAgua: () => void
  onAjustes: () => void
  onPerfil: () => void
  onSalir: () => void
}) {
  const { t } = useIdioma()
  const i = { size: 18, strokeWidth: 1.75 }
  const [qr, setQr] = useState(false)
  const conQr = ofrecerDescarga()
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-neutral-200 bg-card px-4 py-6 dark:border-neutral-800 dark:bg-card-dark lg:flex">
      <div className="flex items-center gap-2.5 px-3">
        <Logo size={30} className="text-graphite dark:text-neutral-100" />
        <span className="text-lg font-semibold tracking-tight">
          Nutri<span className="text-mint-700 dark:text-mint-400">Fit</span>
        </span>
      </div>

      <nav aria-label="Principal" className="mt-8 flex-1">
        <ul className="space-y-1">
          <Item icono={<House {...i} />} activo={vista === 'hoy'} onClick={onHoy}>
            {t('nav.hoy')}
          </Item>
          <Item icono={<ChartColumn {...i} />} activo={vista === 'historial'} onClick={onHistorial}>
            {t('nav.historial')}
          </Item>
        </ul>
        <p className="etiqueta mb-2 mt-7 px-3">Registrar</p>
        <ul className="space-y-1">
          <Item icono={<Plus {...i} />} onClick={onAnadir}>
            {t('nav.anadir')}
          </Item>
          <Item icono={<Scale {...i} />} onClick={onPeso}>
            {t('nav.peso')}
          </Item>
          <Item icono={<Droplet {...i} />} onClick={onAgua}>
            {t('nav.agua')}
          </Item>
        </ul>
        <p className="etiqueta mb-2 mt-7 px-3">Cuenta</p>
        <ul className="space-y-1">
          <Item icono={<User {...i} />} activo={vista === 'profile'} onClick={onPerfil}>
            {t('nav.perfil')}
          </Item>
          <Item icono={<Settings {...i} />} onClick={onAjustes}>
            {t('nav.ajustes')}
          </Item>
          {conQr ? (
            <Item icono={<Download {...i} />} onClick={() => setQr((v) => !v)} expandido={qr}>
              {t('nav.instalar')}
            </Item>
          ) : (
            <Item icono={<Download {...i} />} href="/descargar">
              {t('nav.instalar')}
            </Item>
          )}
        </ul>
        {conQr && qr && <BloqueDescarga variante="lateral" className="mx-1 mt-2 animate-pop-in" />}
      </nav>

      <div className="border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <button
          type="button"
          onClick={onPerfil}
          className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-neutral-100/70 dark:hover:bg-white/10"
        >
          <img
            src={usuario.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((usuario.nombre || usuario.email || '').trim())}&background=064e3b&color=34d399&bold=true`}
            alt=""
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-50 object-cover text-sm font-semibold text-mint-800 dark:bg-mint-950 dark:text-mint-300"
          />
          <span className="min-w-0 flex-1">
            {usuario.nombre && <span className="block truncate text-sm font-medium">{usuario.nombre}</span>}
            <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400" title={usuario.email}>
              {usuario.email}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onSalir}
          className={cx(CLASE_ITEM, 'mt-2 text-neutral-600 hover:bg-neutral-100 hover:text-graphite dark:text-neutral-300 dark:hover:bg-neutral-800/70 dark:hover:text-white')}
        >
          <LogOut size={18} strokeWidth={1.75} className="text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
          {t('nav.salir')}
        </button>
      </div>
    </aside>
  )
}
