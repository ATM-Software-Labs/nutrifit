#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# NutriFit · Conversión SVG -> PNG (iconos PWA, Apple, Capacitor y splash)
#
# Uso:   bash scripts/svg-to-png.sh            (desde la raíz del repo)
#
# Renderizador SVG (se usa el primero disponible):
#   1. rsvg-convert  (librsvg)  -> el más fiel con trazos/arcos.  apt install librsvg2-bin
#                                                                  brew install librsvg
#   2. inkscape      (>= 1.0)   -> inkscape in.svg -w 512 -h 512 -o out.png
#   3. ImageMagick   (magick/convert) -> magick -background none -density 384 in.svg -resize 512x512 out.png
# La composición (lienzos de splash, favicon.ico) siempre usa ImageMagick
# (apt install imagemagick / brew install imagemagick).
#
# Salidas:
#   public/icons/icon-192.png, icon-512.png            (azulejo redondeado, esquinas transparentes; purpose "any")
#   public/icons/icon-maskable-192.png, -512.png       (fondo a sangre; purpose "maskable")
#   public/icons/apple-touch-icon.png  180x180         (opaco: iOS pinta de negro la transparencia)
#   public/icons/favicon-32.png, favicon-16.png, public/favicon.ico
#   public/icons/logo-512.png                          (marca sola, transparente)
#   resources/icon.png 1024, icon-foreground.png 1024, icon-background.png 1024   (Capacitor / @capacitor/assets)
#   resources/splash.png 2732 (#FFFFFF), splash-dark.png 2732 (#09090B), splash-transparent.png 2732
#   previews/*.png  (vistas previas sobre blanco y sobre #09090B)
# -----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

PUB=public; ICONS=public/icons; RES=resources; PREV=previews
mkdir -p "$ICONS" "$RES" "$PREV"

if command -v magick >/dev/null 2>&1; then IM=magick; elif command -v convert >/dev/null 2>&1; then IM=convert
else echo "✗ Falta ImageMagick (apt install imagemagick)"; exit 1; fi

# render <in.svg> <out.png> <ancho> [alto]  -> PNG transparente
render() {
  local in=$1 out=$2 w=$3 h=${4:-$3}
  if command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w "$w" -h "$h" -a "$in" -o "$out"
  elif command -v inkscape >/dev/null 2>&1; then
    inkscape "$in" -w "$w" -h "$h" -o "$out" >/dev/null 2>&1
  else
    $IM -background none -density 1200 "$in" -resize "${w}x${h}" "$out"
  fi
}

# canvas <in.png> <out.png> <tamaño> <fondo|none>  -> centra el PNG en un lienzo
canvas() { $IM -size "$3x$3" "xc:$4" "$1" -gravity center -compose over -composite -depth 8 "$2"; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
echo "→ Renderizando con $(command -v rsvg-convert || command -v inkscape || echo "$IM")"

# --- PWA ---------------------------------------------------------------------
for s in 192 512; do
  render "$ICONS/icon-$s.svg"          "$ICONS/icon-$s.png" "$s"
  render "$ICONS/icon-maskable-$s.svg" "$ICONS/icon-maskable-$s.png" "$s"
done
render "$ICONS/icon-maskable-512.svg" "$TMP/apple.png" 180
$IM "$TMP/apple.png" -background "#FFFFFF" -alpha remove -alpha off "$ICONS/apple-touch-icon.png"
render "$PUB/logo.svg" "$ICONS/logo-512.png" 512

# --- Favicon -----------------------------------------------------------------
render "$PUB/favicon.svg" "$ICONS/favicon-32.png" 32
render "$PUB/favicon.svg" "$ICONS/favicon-16.png" 16
render "$PUB/favicon.svg" "$TMP/fav48.png" 48
$IM "$ICONS/favicon-16.png" "$ICONS/favicon-32.png" "$TMP/fav48.png" "$PUB/favicon.ico"

# --- Capacitor (resources/) --------------------------------------------------
render "$ICONS/icon-maskable-512.svg" "$TMP/icon1024.png" 1024
$IM "$TMP/icon1024.png" -background "#FFFFFF" -alpha remove -alpha off "$RES/icon.png"
# Icono adaptativo Android: primer plano transparente (marca en el 66% central) + fondo
render "$PUB/logo.svg" "$TMP/fg.png" 600
canvas "$TMP/fg.png" "$RES/icon-foreground.png" 1024 none
$IM -size 1024x1024 xc:"#FFFFFF" "$RES/icon-background.png"
# Splash 2732x2732 (zona segura central ~1200 px): marca a 720 px
render "$PUB/logo.svg"      "$TMP/splash-mark.png"      720
render "$PUB/logo-dark.svg" "$TMP/splash-mark-dark.png" 720
canvas "$TMP/splash-mark.png"      "$RES/splash.png"             2732 "#FFFFFF"
canvas "$TMP/splash-mark-dark.png" "$RES/splash-dark.png"        2732 "#09090B"
canvas "$TMP/splash-mark.png"      "$RES/splash-transparent.png" 2732 none

# --- Vistas previas (blanco y #09090B) --------------------------------------
render "$PUB/logo.svg"               "$TMP/pl.png"  480
render "$PUB/logo-dark.svg"          "$TMP/pld.png" 480
canvas "$TMP/pl.png"  "$PREV/logo-on-white.png" 640 "#FFFFFF"
canvas "$TMP/pld.png" "$PREV/logo-on-dark.png"  640 "#09090B"
render "$PUB/logo-wordmark.svg"      "$TMP/pw.png"  1000 1000   # -a: mantiene proporción (≈1000x250)
render "$PUB/logo-wordmark-dark.svg" "$TMP/pwd.png" 1000 1000
$IM "$TMP/pw.png"  -bordercolor "#FFFFFF" -border 120x120 -background "#FFFFFF" -flatten "$PREV/wordmark-on-white.png"
$IM "$TMP/pwd.png" -bordercolor "#09090B" -border 120x120 -background "#09090B" -flatten "$PREV/wordmark-on-dark.png"
canvas "$ICONS/icon-512.png" "$PREV/icon-512-on-white.png" 640 "#FFFFFF"
canvas "$ICONS/icon-512.png" "$PREV/icon-512-on-dark.png"  640 "#09090B"
# Hoja resumen
$IM \( "$PREV/logo-on-white.png" "$PREV/logo-on-dark.png" "$PREV/icon-512-on-white.png" "$PREV/icon-512-on-dark.png" +append \) \
    \( "$PREV/wordmark-on-white.png" "$PREV/wordmark-on-dark.png" -resize 1280x +append \) \
    -background "#E4E4E7" -gravity center -append -depth 8 "$PREV/brand-sheet.png"

echo "✓ PNG generados:"
ls -1 "$ICONS"/*.png "$PUB/favicon.ico" "$RES"/*.png "$PREV"/*.png | sed 's/^/   /'
