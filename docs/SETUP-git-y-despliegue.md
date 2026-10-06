# NutriFit · Git, GitHub y primer despliegue en Cloudflare Pages

Guía paso a paso para publicar el repositorio en GitHub y hacer el primer
despliegue manual con Wrangler. Todos los comandos se ejecutan desde la raíz
del proyecto (`nutrifit/`).

> **Requisitos:** Node.js ≥ 22 (`node -v`), npm, git y una cuenta de GitHub y de
> Cloudflare. Opcional: GitHub CLI (`gh`).

---

## 1. Revisar el repositorio local

El repositorio ya está inicializado en la rama `main` con un primer commit y
**sin remoto**.

```bash
git status
git log --oneline
git remote -v          # debe salir vacío
```

### 1.1 Identidad de los commits

Ya está configurada en el repositorio local y los commits existentes se
reescribieron con ella (no había nada publicado):

```bash
git log --format='%an <%ae>' | sort -u
# Alberto Trujillo Mingorance <249946281+atrumin16@users.noreply.github.com>
```

---

## 2. Crear el repositorio en GitHub y enlazar el remoto

### Opción A — con GitHub CLI (`gh`)

```bash
gh auth login                       # una sola vez (GitHub.com → HTTPS → navegador)
gh repo create ATM-Software-Labs/nutrifit \
  --public \
  --description "NutriFit — app open source de nutrición y macros (React + Cloudflare Pages)" \
  --homepage "https://nutri.trujillomingorance.com" \
  --source . \
  --remote origin \
  --push
```

`--source . --remote origin --push` crea el repo, añade el remoto `origin` y
sube `main` en un solo paso. Comprueba:

```bash
git remote -v
gh repo view --web
```

### Opción B — manual (web + git)

1. Entra en <https://github.com/new>.
2. *Repository name:* `nutrifit` · *Public* · **NO** marques README, .gitignore
   ni licencia (ya existen en local).
3. Crea el repositorio `nutrifit` en la organización **ATM-Software-Labs** y enlaza el remoto:

```bash
# HTTPS
git remote add origin https://github.com/ATM-Software-Labs/nutrifit.git
# …o SSH
# git remote add origin git@github.com:ATM-Software-Labs/nutrifit.git

git branch -M main
git push -u origin main
```

### Después del primer push

```bash
git add -A
git commit -m "feat: descripción del cambio"
git push
```

La CI (`.github/workflows/ci.yml`) ejecutará `npm ci`, `typecheck` y `build`
en cada push / pull request.

---

## 3. Primer despliegue en Cloudflare Pages con Wrangler

Wrangler ya está como dependencia de desarrollo (`npx wrangler …`).

### 3.1 Iniciar sesión

```bash
npx wrangler login        # abre el navegador para autorizar
npx wrangler whoami       # verifica la cuenta
```

### 3.2 Crear el proyecto de Pages

```bash
npx wrangler pages project create nutrifit --production-branch main
```

Esto crea el subdominio de Pages. Para este proyecto es **`nutrifit-ac9.pages.dev`**: Cloudflare añade un sufijo cuando `nutrifit` ya está cogido. El nombre del proyecto sigue siendo `nutrifit`.

### 3.3 Desplegar

```bash
npm run deploy
# equivale a: npm run build && wrangler pages deploy dist --project-name nutrifit
```

Wrangler sube `dist/` y compila automáticamente la carpeta `functions/`
(Pages Functions). Al terminar mostrará la URL del despliegue. Comprueba:

```bash
curl https://nutrifit-ac9.pages.dev/api/health
# {"ok":true,"service":"nutrifit",...}
```

Listar despliegues:

```bash
npx wrangler pages deployment list --project-name nutrifit
```

### 3.4 Secretos (cuando lleguen D1 / IA / Brevo)

```bash
npx wrangler pages secret put GEMINI_API_KEY --project-name nutrifit
npx wrangler pages secret put BREVO_API_KEY  --project-name nutrifit
```

En local van en `.dev.vars` (copia de `.dev.vars.example`, ignorado por git).

---

## 4. Dominio propio `nutri.trujillomingorance.com`

Desde el panel de Cloudflare: **Workers & Pages → nutrifit → Custom domains →
Set up a custom domain** → `nutri.trujillomingorance.com`. Si la zona
`trujillomingorance.com` ya está en la misma cuenta de Cloudflare, el registro
CNAME se crea automáticamente; si no, añade a mano:

```
CNAME  nutri  nutrifit-ac9.pages.dev
```

---

## 5. (Opcional) Despliegue automático desde GitHub

Dos alternativas, a elegir más adelante:

- **Integración Git de Cloudflare Pages** (panel → *Connect to Git*). Nota: un
  proyecto creado con `wrangler pages project create` es de tipo *Direct
  Upload* y no se puede convertir; habría que crear otro proyecto conectado a
  Git.
- **GitHub Actions + Wrangler** (mantiene el proyecto Direct Upload): añadir los
  secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` al repo y un paso
  `npx wrangler pages deploy dist --project-name nutrifit`.

---

## Resumen rápido

```bash
# GitHub
gh repo create nutrifit --public --source . --remote origin --push

# Cloudflare Pages
npx wrangler login
npx wrangler pages project create nutrifit --production-branch main
npm run deploy
```
