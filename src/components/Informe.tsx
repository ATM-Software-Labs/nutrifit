/**
 * Informe imprimible (PDF vía «Guardar como PDF»). En pantalla no se ve: solo
 * existe mientras dura la impresión; las reglas @media print de index.css
 * ocultan el resto de la app y muestran únicamente .nf-informe.
 */
import { useEffect } from 'react'
import { GraficaBarras, GraficaLinea } from './Graficas.tsx'
import { claseCalorias } from './Historial.tsx'
import { Logo } from './Logo.tsx'
import { META_AGUA_ML } from '../lib/config.ts'
import { decimal, entero, litros } from '../lib/formato.ts'
import { fechaCorta, fechaLarga } from '../lib/fechas.ts'
import type { Historial, Usuario } from '../lib/tipos.ts'

export default function Informe({ datos, usuario, onTerminar }: { datos: Historial; usuario: Usuario; onTerminar: () => void }) {
  useEffect(() => {
    const fin = () => onTerminar()
    window.addEventListener('afterprint', fin)
    // Dejamos un fotograma para que el navegador pinte el informe antes de imprimir.
    const t = window.setTimeout(() => {
      window.print()
    }, 150)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', fin)
    }
  }, [onTerminar])

  const fechas = datos.dias.map((d) => d.fecha)
  const metas = datos.metas
  const conDatos = datos.dias.filter((d) => d.num_comidas || d.agua_ml || d.peso !== null)
  const generado = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())

  return (
    <div className="nf-informe hidden bg-white text-graphite print:block" aria-hidden="true">
      <header className="flex items-start justify-between border-b border-neutral-200 pb-4">
        <div className="flex items-center gap-3">
          <Logo size={32} className="text-graphite" />
          <div>
            <p className="text-xl font-semibold tracking-tight">
              Informe NutriFit
            </p>
            <p className="text-sm text-neutral-500">
              {usuario.nombre ? `${usuario.nombre} · ` : ''}
              {usuario.email}
            </p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">
            {fechaCorta(datos.desde)} – {fechaCorta(datos.hasta)} {datos.hasta.slice(0, 4)}
          </p>
          <p className="text-xs text-neutral-500">Generado el {generado}</p>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-4 gap-3 text-sm">
        {[
          ['Media diaria', datos.medias ? `${entero(datos.medias.calorias)} kcal` : '—', metas ? `Objetivo ${entero(metas.calorias)} kcal` : ''],
          ['Días en objetivo', `${datos.dias_en_objetivo} / ${datos.dias_con_registro}`, '±10 % de las calorías'],
          ['Peso', datos.peso ? `${datos.peso.cambio > 0 ? '+' : ''}${decimal(datos.peso.cambio)} kg` : '—', datos.peso ? `${decimal(datos.peso.inicio)} → ${decimal(datos.peso.fin)} kg` : 'Sin registros'],
          ['Agua media', datos.medias?.agua_ml ? litros(datos.medias.agua_ml) : '—', `Meta ${litros(META_AGUA_ML)}`],
        ].map(([e, v, d]) => (
          <div key={e} className="rounded-xl border border-neutral-200 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">{e}</p>
            <p className="cifra mt-1 text-lg font-semibold">{v}</p>
            <p className="text-[11px] text-neutral-500">{d}</p>
          </div>
        ))}
      </section>

      {datos.medias && (
        <p className="cifra mt-3 text-sm text-neutral-600">
          Macros medios: proteínas {entero(datos.medias.proteinas)} g{metas ? ` (objetivo ${entero(metas.proteinas)} g)` : ''} · carbohidratos {entero(datos.medias.carbohidratos)} g
          {metas ? ` (${entero(metas.carbohidratos)} g)` : ''} · grasas {entero(datos.medias.grasas)} g{metas ? ` (${entero(metas.grasas)} g)` : ''}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <figure className="nf-evitar-corte rounded-xl border border-neutral-200 p-3">
          <figcaption className="mb-1 text-sm font-semibold">Calorías</figcaption>
          <GraficaBarras fechas={fechas} titulo="Calorías" unidad="kcal" alto={180} series={[{ nombre: 'Calorías', clase: 'fill-mint', valores: datos.dias.map((d) => d.calorias) }]} meta={metas?.calorias} claseBarra={(v) => claseCalorias(v, metas?.calorias)} />
        </figure>
        <figure className="nf-evitar-corte rounded-xl border border-neutral-200 p-3">
          <figcaption className="mb-1 text-sm font-semibold">Macros (g) · <span className="text-protein">P</span> <span className="text-carbs">C</span> <span className="text-fats">G</span></figcaption>
          <GraficaBarras
            fechas={fechas}
            titulo="Macros"
            unidad="g"
            alto={180}
            series={[
              { nombre: 'Proteínas', clase: 'fill-protein', valores: datos.dias.map((d) => d.proteinas) },
              { nombre: 'Carbohidratos', clase: 'fill-carbs', valores: datos.dias.map((d) => d.carbohidratos) },
              { nombre: 'Grasas', clase: 'fill-fats', valores: datos.dias.map((d) => d.grasas) },
            ]}
          />
        </figure>
        <figure className="nf-evitar-corte rounded-xl border border-neutral-200 p-3">
          <figcaption className="mb-1 text-sm font-semibold">Peso (kg)</figcaption>
          <GraficaLinea fechas={fechas} titulo="Peso" unidad="kg" alto={180} valores={datos.dias.map((d) => d.peso)} />
        </figure>
        <figure className="nf-evitar-corte rounded-xl border border-neutral-200 p-3">
          <figcaption className="mb-1 text-sm font-semibold">Agua</figcaption>
          <GraficaBarras fechas={fechas} titulo="Agua" unidad="ml" alto={180} series={[{ nombre: 'Agua', clase: 'fill-water', valores: datos.dias.map((d) => d.agua_ml) }]} meta={META_AGUA_ML} etiquetaMeta={`Meta ${litros(META_AGUA_ML)}`} />
        </figure>
      </div>

      <table className="cifra mt-5 w-full text-[11px]">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-neutral-500">
            <th className="py-1.5 font-medium">Fecha</th>
            <th className="py-1.5 text-right font-medium">kcal</th>
            <th className="py-1.5 text-right font-medium">Proteínas</th>
            <th className="py-1.5 text-right font-medium">Carbohidratos</th>
            <th className="py-1.5 text-right font-medium">Grasas</th>
            <th className="py-1.5 text-right font-medium">Agua</th>
            <th className="py-1.5 text-right font-medium">Peso</th>
          </tr>
        </thead>
        <tbody>
          {conDatos.map((d) => (
            <tr key={d.fecha} className="border-b border-neutral-100">
              <td className="py-1 first-letter:uppercase">{fechaLarga(d.fecha)}</td>
              <td className="py-1 text-right">{d.num_comidas ? entero(d.calorias) : '—'}</td>
              <td className="py-1 text-right">{d.num_comidas ? `${entero(d.proteinas)} g` : ''}</td>
              <td className="py-1 text-right">{d.num_comidas ? `${entero(d.carbohidratos)} g` : ''}</td>
              <td className="py-1 text-right">{d.num_comidas ? `${entero(d.grasas)} g` : ''}</td>
              <td className="py-1 text-right">{d.agua_ml ? litros(d.agua_ml) : ''}</td>
              <td className="py-1 text-right">{d.peso !== null ? `${decimal(d.peso)} kg` : ''}</td>
            </tr>
          ))}
          {!conDatos.length && (
            <tr>
              <td colSpan={7} className="py-3 text-center text-neutral-500">
                Sin registros en este periodo.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="mt-4 text-[10px] text-neutral-400">NutriFit · Estimaciones orientativas, no sustituyen el consejo de un profesional sanitario.</p>
    </div>
  )
}
