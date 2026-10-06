# NutriFit · Frontend (Fases 5–6)

React 18 + Vite + Tailwind 3. Interfaz en español, mobile-first (375 px), modo
claro/oscuro (sigue al sistema; se puede fijar en Ajustes).

## Estructura

| Ruta | Qué hay |
|---|---|
| `src/components/ui/` | Button, Card, Input, Slider, Segmented/OpcionTarjeta, Sheet (focus trap, Esc), Toast, Spinner |
| `src/components/` | Login, Onboarding (4 pasos), Dashboard, AnilloCalorias, BarrasMacros, SelectorSemana, SeccionComida, HojaAnadir, ScannerComida, ModalRevisionPlato, WidgetAgua, GraficaPeso, Ajustes, BannerInstalarPWA |
| `src/hooks/` | `useTurnstile`, `useResumen` (caché en memoria + actualizaciones optimistas), `useTema`, `useNumeroAnimado` |
| `src/lib/` | `api.ts` (cliente tipado), `imagen.ts` (compresión 800×800 WebP 0.7 → JPEG), `fechas.ts`, `formato.ts`, `resumen.ts`, `tema.ts`, `sw.ts`, `tipos.ts` |
| `public/sw.js` | Service Worker escrito a mano; la lista de precarga y la versión las inyecta el plugin `nutrifit-sw` de `vite.config.ts` |

## Turnstile (modo invisible)

`useTurnstile(accion)` carga `api.js?render=explicit`, pide la site key a
`/api/config` y renderiza el widget con `execution: 'execute'`: no hace nada
hasta que el usuario pulsa (enviar email, guardar perfil, analizar foto). El
tamaño/visibilidad los decide la configuración del widget en Cloudflare
(producción: **Invisible**, site key `0x4AAAAAAFPhRCuPz21TsJR5`). En local se usa
la clave de prueba invisible `1x00000000000000000000BB` (`.dev.vars`).

## PWA

- `manifest.webmanifest` con `id`, iconos `any` + `maskable`, tema `#10B981`.
- `sw.js`: cache-first para `/assets` (hash), `/fonts`, `/icons` y logos;
  network-first para la navegación con el shell `/index.html` de reserva sin
  conexión; `/api/comidas/resumen` network-first (copia offline); el resto de
  `/api` nunca se cachea. Cachés `nf-*` versionadas: las antiguas se borran al
  activar. Nueva versión → aviso "Actualizar" (mensaje `SKIP_WAITING`). Al
  cerrar sesión se borran los datos cacheados (`LIMPIAR_DATOS`).
- Banner de instalación: pasos de iOS Safari (Compartir → Añadir a inicio) o
  `beforeinstallprompt` en Android; se descarta 30 días (localStorage).

## Rendimiento

Login, Onboarding, Dashboard, Scanner, ModalRevisionPlato, GraficaPeso y
Ajustes se cargan con `React.lazy`. JS inicial ≈ 52 KB gzip (React incluido);
con la pantalla de Dashboard ≈ 62 KB. Fuente Outfit variable (subset latino,
28 KB woff2) autoalojada con `preload` y `font-display: swap`.

## Notas

- El **peso objetivo** (línea discontinua de la gráfica) se guarda en
  `localStorage` (`nf:pesoObjetivo`); si no hay, se estima por objetivo
  (−5 % en déficit, +3 % en superávit). No hay columna en D1 todavía.
- `GET /api/auth/yo` devuelve `usuario: null` (200) sin sesión para no generar
  errores 401 en la consola en cada arranque.

## Rutas sueltas y app nativa (Fase 7–8)

- `/descargar` (`SeccionDescargas`, lazy): APK directo, pasos de iOS ilustrados en SVG y enlace al código. Se llega desde el pie del login y desde Ajustes. Oculta dentro del APK.
- `/privacidad` (`Privacidad`, lazy): renderiza `PRIVACIDAD.md` (importado `?raw`) con un Markdown mínimo y seguro.
- `src/lib/config.ts`: **único sitio** para `GITHUB_REPO` (`VITE_GITHUB_REPO`, por defecto `ATM-Software-Labs/nutrifit`), `URL_APK` (`https://nutri.trujillomingorance.com/descargar/NutriFit.apk`, servido por nuestro dominio) y `URL_API_NATIVA`.
- `src/lib/plataforma.ts`: `esNativa` (vía `window.Capacitor.isNativePlatform()`, sin meter `@capacitor/core` en el bundle web) y `API_BASE`. Los plugins nativos (`nativo.ts`, `tokenApp.ts`) se cargan con `import()` solo en el APK.

## Escritorio, historial y altas sin cámara (Fase 9)

- **Rutas** (`src/lib/rutas.ts`, History API sin dependencias): `/` (Hoy),
  `/historial` y `/vincular#id` (aprobar desde el móvil el acceso de un PC; el
  id viaja en el fragmento y se borra de la URL al arrancar). `/descargar` y
  `/privacidad` siguen siendo páginas sueltas.
- **Escritorio (≥ `lg`, 1024 px):** `BarraLateral` (Hoy, Historial, Añadir comida,
  Peso, Agua, Ajustes, Descargar app; usuario y «Salir» abajo) y panel en 2
  columnas (lg) o 3 (xl) con la tarjeta `AnadirRapido` (tipo de comida +
  Describir / Buscar / Subir foto / Manual, y zona para soltar la foto). El
  árbol es único: en móvil el orden y el aspecto no cambian (cabecera, botón
  flotante, una columna); solo se añade el acceso al historial en la cabecera.
- **Login:** tras pedir el enlace aparece el campo del **código de 6 cifras**
  (`autocomplete="one-time-code"`, se envía solo al completarlo). En escritorio,
  `LoginQR` (chunk aparte con el codificador [`uqr`](https://github.com/unjs/uqr),
  MIT) muestra el QR en SVG, el código corto y una cuenta atrás; consulta el
  estado cada 2 s solo con la pestaña visible y se renueva unas pocas veces.
- **Añadir sin cámara:** `HojaAnadir` suma «Describir con texto»
  (`DescribirComida`, Turnstile `analizar-texto`) y «Buscar alimento»
  (`BuscarAlimento`: base local + Open Food Facts, gramos y «cesta» de
  alimentos). Todo acaba en `ModalRevisionPlato`. En escritorio no se ofrece
  la cámara y se puede arrastrar la foto (misma compresión WebP).
- **Base de alimentos:** `src/data/alimentos.ts` (≈ 360 alimentos, 16
  categorías) se genera con `python3 scripts/alimentos/generar.py` a partir de
  `scripts/alimentos/mapa.txt` y de **USDA FoodData Central — SR Legacy (2018)**,
  dominio público (CC0): kcal, proteínas, carbohidratos por diferencia y grasas
  por 100 g, más el FDC ID de cada fila. Los nombres en español y las raciones
  típicas son nuestros.
- **Historial** (`Historial.tsx` + `Graficas.tsx`): semana/mes, anterior/siguiente,
  KPIs, barras de calorías con la línea de objetivo, macros apilados, peso y
  agua en SVG puro, y la tabla de días (clic → abre ese día en Hoy).
- **Exportar** (`Exportar.tsx`): CSV vía `fetch` + Blob (la cookie viaja sola;
  en la app, Bearer) e **informe PDF** = `Informe.tsx` (vista de impresión con
  `@media print`, A4) + `window.print()` → «Guardar como PDF». Sin librerías.
- **Presupuesto:** JS inicial ~55 KB gzip + CSS ~9 KB; `Historial`, `LoginQR`,
  `BuscarAlimento` (incluye la base de alimentos), `DescribirComida`,
  `Exportar`, `Informe` y `Vincular` son chunks perezosos.
