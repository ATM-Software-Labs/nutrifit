# Política de privacidad de NutriFit

> **BORRADOR pendiente de revisión por Alberto** — no es asesoramiento legal. Revisar antes del lanzamiento, en especial el uso de datos del nivel gratuito de Gemini y la base legal para datos de salud (art. 9 RGPD).

Última actualización: 6 de octubre de 2026.

## Quién es el responsable

NutriFit es un proyecto personal y de código abierto de Alberto Trujillo Mingorance (Barcelona, España). Contacto: [soporte@trujillomingorance.com](mailto:soporte@trujillomingorance.com).

## Qué datos guardamos

- **Cuenta:** tu email (para enviarte el enlace de acceso; no hay contraseñas).
- **Perfil:** nombre, sexo, edad, peso, altura, nivel de actividad y objetivo, para calcular tus calorías y macros.
- **Diario:** comidas que registras (nombre, ingredientes, calorías y macros), agua y peso.
- **Técnicos:** dirección IP de forma transitoria y con hash para limitar abusos (rate limiting), y registros de errores sin datos personales.

El peso y los hábitos de alimentación pueden considerarse **datos relativos a la salud**. Solo los usamos para mostrarte tu propio seguimiento.

## Fotos de comida e inteligencia artificial

- Cuando analizas una foto, la imagen (comprimida en tu dispositivo) se envía a la **API de Google Gemini** para estimar ingredientes y macros. Si falla, se usa **Cloudflare Workers AI** como alternativa.
- **NutriFit no guarda la foto**: solo el resultado que confirmas.
- **Importante (nivel gratuito de Gemini):** mientras NutriFit use el nivel gratuito de la API, Google puede usar el contenido enviado para mejorar sus productos, y personas revisoras pueden verlo, según los [términos adicionales de la API de Gemini](https://ai.google.dev/gemini-api/terms). No subas fotos con personas o información privada. Si pasamos al nivel de pago, esto dejará de aplicarse y lo indicaremos aquí.
- Cloudflare Workers AI no usa el contenido para entrenar modelos.

## Con quién se comparten (encargados del tratamiento)

- **Cloudflare** (alojamiento, base de datos D1, protección anti-bots Turnstile y Workers AI).
- **Google** (análisis de fotos con Gemini, ver arriba).
- **Brevo** (envío del email con el enlace de acceso).

No vendemos datos, no hay publicidad y no usamos herramientas de analítica ni de seguimiento.

## Cookies y almacenamiento local

- Una única cookie técnica, `nf_session`, para mantener tu sesión (30 días). En la app Android se usa un token guardado en el almacenamiento privado de la app.
- En tu navegador se guardan preferencias (tema, peso objetivo, aviso de instalación) y una copia en caché de la app para que funcione sin conexión.

## Cuánto tiempo

Mientras tengas cuenta. Los enlaces de acceso caducan a los 15 minutos y los registros anti-abuso se borran en 48 horas.

## Tus derechos

Puedes pedir acceso, rectificación, portabilidad o **eliminación de tu cuenta y todos tus datos** escribiendo a [soporte@trujillomingorance.com](mailto:soporte@trujillomingorance.com). También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).

## Cambios

Si cambia algo importante (por ejemplo, el proveedor de IA), lo avisaremos en la app y actualizaremos esta página.
