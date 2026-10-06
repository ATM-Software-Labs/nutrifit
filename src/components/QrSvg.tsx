/** Código QR en SVG puro (codificador uqr, MIT). Siempre negro sobre blanco para que se lea bien. */
import { useMemo } from 'react'
import { encode } from 'uqr'

export function QrSvg({ texto, tamano = 216, titulo }: { texto: string; tamano?: number; titulo: string }) {
  const { d, n } = useMemo(() => {
    const qr = encode(texto, { ecc: 'M', border: 0 })
    let camino = ''
    qr.data.forEach((fila, y) => {
      // Une módulos negros consecutivos de cada fila en un solo rectángulo.
      for (let x = 0; x < fila.length; x++) {
        if (!fila[x]) continue
        let fin = x
        while (fin + 1 < fila.length && fila[fin + 1]) fin++
        camino += `M${x} ${y}h${fin - x + 1}v1h-${fin - x + 1}z`
        x = fin
      }
    })
    return { d: camino, n: qr.size }
  }, [texto])
  const margen = 3
  return (
    <svg
      role="img"
      aria-label={titulo}
      viewBox={`${-margen} ${-margen} ${n + margen * 2} ${n + margen * 2}`}
      width={tamano}
      height={tamano}
      shapeRendering="crispEdges"
      className="rounded-2xl bg-white"
    >
      <rect x={-margen} y={-margen} width={n + margen * 2} height={n + margen * 2} fill="#fff" />
      <path d={d} fill="#111827" />
    </svg>
  )
}
