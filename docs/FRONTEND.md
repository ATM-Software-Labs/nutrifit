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
- `src/lib/config.ts`: **único sitio** para `GITHUB_REPO` (`VITE_GITHUB_REPO`, por defecto `ATM-Software-Labs/nutrifit`), `URL_APK` y `URL_API_NATIVA`.
- `src/lib/plataforma.ts`: `esNativa` (vía `window.Capacitor.isNativePlatform()`, sin meter `@capacitor/core` en el bundle web) y `API_BASE`. Los plugins nativos (`nativo.ts`, `tokenApp.ts`) se cargan con `import()` solo en el APK.
