<p align="center">
  <img src="public/logo-wordmark.svg" alt="NutriFit" height="56" />
</p>

<p align="center">
  Seguimiento de nutrición y macros, minimalista y open source.<br/>
  <a href="https://nutri.trujillomingorance.com">nutri.trujillomingorance.com</a>
</p>

---

> 🚧 **Estado:** esqueleto inicial (Fase 1 identidad + Fase 2 base del proyecto).

## Stack

- **Frontend:** Vite · React 18 · TypeScript · Tailwind CSS · lucide-react
- **Backend:** Cloudflare Pages Functions (`/functions`) · D1 (próximamente) · Workers AI / Gemini (próximamente)
- **Email:** Brevo (próximamente)
- **Móvil:** PWA (iPhone) · Capacitor (APK Android)

## Desarrollo

Requiere **Node.js ≥ 22** (ver `.nvmrc`).

```bash
npm install
npm run dev          # Vite en http://localhost:5173 (proxy /api -> :8788)
npm run pages:dev    # build + Pages Functions locales con Wrangler en http://localhost:8788
npm run build        # compila a dist/
npm run deploy       # build + wrangler pages deploy dist --project-name nutrifit
```

Para variables locales: `cp .dev.vars.example .dev.vars`.

## Estructura

```
src/            components/ · hooks/ · lib/      (app React)
functions/      api/health.ts · api/macros/ · api/comidas/ · utils/   (Pages Functions)
migrations/     esquema D1 (fases posteriores)
public/         logo, favicon, iconos PWA, manifest
resources/      icon.png 1024 · splash.png 2732 (Capacitor)
scripts/        generate-brand.py (SVG de marca) · svg-to-png.sh (PNG)
docs/           guías (git, despliegue…)
```

## Marca

Imagotipo: anillo de macros en tres segmentos (proteína · carbohidratos · grasas) con un brote que nace de su apertura. Trazos de 2 px, extremos redondeados. Menta `#10B981` + grafito `#111827`.

```bash
npm run brand        # regenera los SVG y todos los PNG (requiere python3 + fonttools, librsvg/ImageMagick)
```

## Licencia

[MIT](LICENSE) © 2026 Alberto Trujillo Mingorance
