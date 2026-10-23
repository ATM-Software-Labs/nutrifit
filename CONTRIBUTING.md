# Cómo contribuir a NutriFit

¡Gracias por echar una mano! Unas pocas normas para que todo vaya rápido.

## Antes de empezar

1. Busca si ya hay un issue; si no, abre uno (plantillas **Error** o **Idea o mejora**).
2. Para cambios grandes, espera a que lo comentemos antes de programar.

## Entorno

Node.js 22 (`.nvmrc`). Pasos en el [README](README.md#desarrollo-local).

## Rama y commits

- Rama desde `main`: `mejora/nombre-corto` o `arreglo/nombre-corto`.
- Commits en español, en presente y concretos: «Historial: muestra el agua por semana».

## Antes del PR

```bash
npm run typecheck && npm test && npm run build
```

- Tests con `node:test` en `tests/` para la lógica nueva.
- Interfaz: modo claro y oscuro, móvil y escritorio, foco visible y `prefers-reduced-motion`. Adjunta capturas.
- **Base de datos:** migraciones nuevas en `migrations/NNNN_nombre.sql` y solo **aditivas** (`CREATE TABLE IF NOT EXISTS`, columnas nuevas con valor por defecto). Nada de borrar ni renombrar.
- **Nada de secretos** ni datos personales (tampoco en capturas o tests).

## Estilo

- TypeScript estricto, React con componentes de función y Tailwind con las clases existentes (`tarjeta`, `cifra`, colores `mint`, `graphite`…).
- Textos de la interfaz y comentarios en español.
- `.editorconfig`: 2 espacios, LF, UTF-8.
