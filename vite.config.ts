import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Con `npm run pages:dev` corriendo en paralelo (puerto 8788), /api/* se
    // redirige a las Pages Functions locales de Wrangler.
    proxy: { '/api': 'http://localhost:8788' },
  },
  build: { outDir: 'dist', sourcemap: false },
})
