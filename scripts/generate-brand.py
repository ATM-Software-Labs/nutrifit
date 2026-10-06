#!/usr/bin/env python3
"""
NutriFit — generador de la identidad visual (SVG).

Genera todos los SVG de marca a partir de una única geometría (rejilla 48x48,
trazos de 2px, extremos redondeados), para que logo, wordmark, favicon e iconos
compartan exactamente las mismas proporciones.

Uso:  python3 scripts/generate-brand.py
Requisitos: Python 3 + fontTools (pip install fonttools) solo para el wordmark
(convierte "NutriFit" en Outfit a trazados, así no depende de webfonts).
Los SVG resultantes están versionados; solo hace falta re-ejecutarlo si se
cambia el diseño.
"""
import math
import os
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")

MINT = "#10B981"
GRAPHITE = "#111827"
LIGHT = "#F4F4F5"      # sustituye al grafito sobre fondos oscuros
DARK_BG = "#09090B"

# ---------------------------------------------------------------- geometría
CX, CY, R = 24.0, 24.25, 15.0   # anillo de macros (centrado ópticamente)
GAP_TOP = 42                     # semiapertura superior del anillo (grados)
SEG_GAP = 16                     # separación entre segmentos (grados)
# Proporción de cada segmento del anillo, en sentido horario desde arriba a la
# derecha: proteína · carbohidratos (menta) · grasas (grafito). La asimetría
# lo hace leer como un anillo de progreso y no como una "cara".
SEGMENTS = (0.40, 0.35, 0.25)
DY = CY - 27.0                   # desplazamiento del brote respecto al boceto


def f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def pt(a):
    t = math.radians(a)
    return CX + R * math.sin(t), CY - R * math.cos(t)


def arc(a1, a2):
    (x1, y1), (x2, y2) = pt(a1), pt(a2)
    large = 1 if (a2 - a1) % 360 > 180 else 0
    return f"M{f(x1)} {f(y1)}A{f(R)} {f(R)} 0 {large} 1 {f(x2)} {f(y2)}"


def ring_paths(seg_gap=SEG_GAP):
    """Tres segmentos (macros) con apertura superior por donde sale el brote."""
    start, end = GAP_TOP, 360 - GAP_TOP
    total = end - start - 2 * seg_gap
    out, a = [], start
    for p in SEGMENTS:
        out.append(arc(a, a + total * p))
        a += total * p + seg_gap
    return out  # [derecha, base, izquierda]


def y(v):
    return f(v + DY)


def sprout_paths():
    stem = f"M24 {y(31)}V{y(19)}"   # termina justo en la base de la hoja derecha
    leaf_l = (f"M24 {y(22.5)}C24 {y(19)} 21.5 {y(16.5)} 18 {y(16.5)}"
              f"C18 {y(20)} 20.5 {y(22.5)} 24 {y(22.5)}Z")
    leaf_r = (f"M24 {y(19)}C24 {y(14.5)} 27 {y(11.5)} 31.5 {y(11.5)}"
              f"C31.5 {y(16)} 28.5 {y(19)} 24 {y(19)}Z")
    return [stem, leaf_l, leaf_r]


def mark_group(graphite=GRAPHITE, mint=MINT, sw=2, transform=None, cls=False,
               seg_gap=SEG_GAP, filled_leaves=False):
    r = ring_paths(seg_gap)
    s = sprout_paths()
    g_attr = ' class="g"' if cls else f' stroke="{graphite}"'
    leaf_fill = f' fill="{mint}"' if filled_leaves else ""
    parts = [
        f'<path d="{r[0]} {r[1]}" stroke="{mint}"/>',
        f'<path d="{r[2]}"{g_attr}/>',
        f'<path d="{s[0]}" stroke="{mint}"/>',
        f'<path d="{s[1]} {s[2]}" stroke="{mint}"{leaf_fill}/>',
    ]
    t = f' transform="{transform}"' if transform else ""
    return (f'<g{t} fill="none" stroke-width="{f(sw)}" stroke-linecap="round" '
            f'stroke-linejoin="round">' + "".join(parts) + "</g>")


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        fh.write(content + "\n")
    print("  ✓", os.path.relpath(path, ROOT))


HDR = '<svg xmlns="http://www.w3.org/2000/svg"'


def logo(graphite):
    return (f'{HDR} width="48" height="48" viewBox="0 0 48 48" role="img" aria-label="NutriFit">'
            f"<title>NutriFit</title>{mark_group(graphite)}</svg>")


def favicon():
    # Recorte más ajustado + trazo 3 para que se lea a 16–32 px.
    # Cambia el grafito a claro si el navegador está en modo oscuro.
    css = (f"<style>.g{{stroke:{GRAPHITE}}}@media (prefers-color-scheme:dark)"
           f"{{.g{{stroke:{LIGHT}}}}}</style>")
    return (f'{HDR} viewBox="6.5 6.5 35 35">{css}'
            f"{mark_group(sw=3.25, cls=True, seg_gap=22, filled_leaves=True)}</svg>")


def icon(size, rounded=True, bg="#FFFFFF", scale=0.70, sw=2.5):
    # viewBox 48; la marca escala alrededor del centro y queda dentro de la
    # zona segura maskable (círculo de radio 40%).
    rx = ' rx="10.56"' if rounded else ""
    tr = f"translate(24 24) scale({scale}) translate(-24 -24)"
    return (f'{HDR} width="{size}" height="{size}" viewBox="0 0 48 48">'
            f'<rect width="48" height="48"{rx} fill="{bg}"/>'
            f"{mark_group(sw=sw, transform=tr)}</svg>")


# ---------------------------------------------------------------- wordmark
def text_paths(text_runs, x0, baseline, size):
    """Convierte texto Outfit (variable) a trazados SVG con fontTools."""
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen

    cands = glob.glob("/usr/share/fonts/**/Outfit*VariableFont*.ttf", recursive=True)
    if not cands:
        raise SystemExit("No se encontró Outfit (Google Fonts, OFL).")
    base = TTFont(cands[0])
    upm = base["head"].unitsPerEm
    k = size / upm
    out, x = [], x0
    for text, weight, color, tracking in text_runs:
        font = instancer.instantiateVariableFont(TTFont(cands[0]), {"wght": weight})
        gs = font.getGlyphSet()
        cmap = font.getBestCmap()
        hmtx = font["hmtx"]
        d = []
        for ch in text:
            gname = cmap[ord(ch)]
            pen = SVGPathPen(gs, ntos=lambda v: f(v))
            tpen = TransformPen(pen, (k, 0, 0, -k, x, baseline))
            gs[gname].draw(tpen)
            d.append(pen.getCommands())
            x += hmtx[gname][0] * k + tracking
        out.append(f'<path fill="{color}" d="{"".join(d)}"/>')
    return out, x


def wordmark(graphite):
    size = 26.0                       # altura de mayúscula ≈ 17.6
    baseline = 24 + 0.676 * size / 2  # mayúsculas centradas en la marca
    paths, xend = text_paths(
        [("Nutri", 500, graphite, 0.0), ("Fit", 600, MINT, 0.0)],
        x0=50, baseline=baseline, size=size)
    w = math.ceil(xend + 2)
    return (f'{HDR} width="{w}" height="48" viewBox="0 0 {w} 48" role="img" aria-label="NutriFit">'
            f"<title>NutriFit</title>{mark_group(graphite)}{''.join(paths)}</svg>")


if __name__ == "__main__":
    print("Generando SVG de marca NutriFit…")
    write(os.path.join(PUB, "logo.svg"), logo(GRAPHITE))
    write(os.path.join(PUB, "logo-dark.svg"), logo(LIGHT))
    write(os.path.join(PUB, "favicon.svg"), favicon())
    for s in (192, 512):
        write(os.path.join(PUB, "icons", f"icon-{s}.svg"), icon(s, rounded=True))
        write(os.path.join(PUB, "icons", f"icon-maskable-{s}.svg"),
              icon(s, rounded=False, scale=0.64))
    try:
        write(os.path.join(PUB, "logo-wordmark.svg"), wordmark(GRAPHITE))
        write(os.path.join(PUB, "logo-wordmark-dark.svg"), wordmark(LIGHT))
    except ImportError:
        print("  ! fontTools no instalado: se omite el wordmark")
