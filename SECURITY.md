# Seguridad

## Avisar de una vulnerabilidad

No abras un issue público. Usa **[Report a vulnerability](https://github.com/ATM-Software-Labs/nutrifit/security/advisories/new)** (aviso privado de GitHub) o escribe a **soporte@trujillomingorance.com** con:

- qué has encontrado y dónde (URL, endpoint o archivo),
- cómo reproducirlo,
- el impacto que crees que tiene.

Respondemos en un plazo de **72 horas** y te contamos el plan de arreglo. Si quieres, te citamos en las notas de la versión.

## Versiones con soporte

Solo la última versión desplegada en [nutri.trujillomingorance.com](https://nutri.trujillomingorance.com) y el último APK de [Releases](https://github.com/ATM-Software-Labs/nutrifit/releases/latest).

## Qué hacemos

- Secretos solo como secretos de Cloudflare (Workers/Pages) o de GitHub Actions; nunca en el repositorio. El historial se revisa con `gitleaks`.
- Cabeceras estrictas (CSP, HSTS, `frame-ancestors 'none'`), sesiones en cookie `HttpOnly`, Turnstile en el acceso y límites por usuario e IP.
- Dependencias vigiladas por Dependabot y `npm audit` en CI.
- Fuera de alcance: ataques de denegación de servicio, ingeniería social y fallos en servicios de terceros (Cloudflare, Groq, Google).
