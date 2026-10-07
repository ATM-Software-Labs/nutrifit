import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

/**
 * Inyecta en dist/sw.js la lista de precarga (HTML, JS/CSS con hash, fuente,
 * iconos principales) y una versión derivada del contenido, de modo que cada
 * despliegue con cambios genera un SW nuevo y limpia las cachés antiguas.
 */
function nutrifitSW(): Plugin {
  return {
    name: 'nutrifit-sw',
    apply: 'build',
    writeBundle(opciones) {
      const dir = opciones.dir!
      const listar = (d: string): string[] =>
        readdirSync(d).flatMap((f) => {
          const p = join(d, f)
          return statSync(p).isDirectory() ? listar(p) : [p]
        })
      const archivos = listar(dir)
        .map((p) => '/' + relative(dir, p).split('\\').join('/'))
        .filter(
          (u) =>
            /^\/assets\/.+\.(js|css)$/.test(u) ||
            u === '/fonts/outfit-latin-var.woff2' ||
            u === '/boot.js' ||
            u === '/manifest.json' ||
            u === '/manifest.webmanifest' ||
            u === '/favicon.svg' ||
            u === '/logo.svg' ||
            /^\/icons\/(icon-192|apple-touch-icon)\.png$/.test(u),
        )
        .sort()
      const precache = ['/index.html', ...archivos]
      const hash = createHash('sha256')
      for (const u of precache) hash.update(u).update(readFileSync(join(dir, u)))
      const version = `${pkg.version}-${hash.digest('hex').slice(0, 10)}`
      const ruta = join(dir, 'sw.js')
      const sw = readFileSync(ruta, 'utf8')
        .replace('/*__PRECACHE__*/ []', JSON.stringify(precache))
        .replace('__VERSION__', version)
      writeFileSync(ruta, sw)
      this.info(`sw.js: ${precache.length} recursos precacheados · versión ${version}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), nutrifitSW()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Con `npm run pages:dev` corriendo en paralelo (puerto 8788), /api/* se
    // redirige a las Pages Functions locales de Wrangler.
    proxy: { '/api': 'http://localhost:8788' },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    modulePreload: { polyfill: false },
    rolldownOptions: {
      // «nombre.hash12» (antes «nombre-hash»): estrena TODAS las URLs de /assets para que
      // ni el borde de Cloudflare ni los navegadores reutilicen copias malas (index.html
      // servido como JS/CSS con caché inmutable) guardadas en los despliegues del 6-oct-2026.
      output: {
        entryFileNames: 'assets/[name].[hash:12].js',
        chunkFileNames: 'assets/[name].[hash:12].js',
        assetFileNames: 'assets/[name].[hash:12][extname]',
      },
    },
  },
})
