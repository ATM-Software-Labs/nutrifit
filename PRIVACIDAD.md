# Política de privacidad de NutriFit

> **BORRADOR pendiente de revisión por Alberto** — no es asesoramiento legal. Revisar antes del lanzamiento, en especial el uso de datos del nivel gratuito de Gemini y la base legal para datos de salud (art. 9 RGPD).

Última actualización: 6 de octubre de 2026.

## Quién es el responsable

NutriFit es un proyecto personal y de código abierto de Alberto Trujillo Mingorance (Barcelona, España). Contacto: [soporte@trujillomingorance.com](mailto:soporte@trujillomingorance.com).

## Qué datos guardamos

- **Cuenta:** tu email (para enviarte el enlace y el código de acceso; no hay contraseñas). Del código de 6 cifras solo guardamos una huella criptográfica (HMAC) durante 15 minutos.
- **Perfil:** nombre, sexo, edad, peso, altura, nivel de actividad y objetivo, para calcular tus calorías y macros.
- **Diario:** comidas que registras (nombre, ingredientes, calorías y macros), agua y peso.
- **Técnicos:** dirección IP de forma transitoria y con hash para limitar abusos (rate limiting), y registros de errores sin datos personales.

El peso y los hábitos de alimentación pueden considerarse **datos relativos a la salud**. Solo los usamos para mostrarte tu propio seguimiento.

## Fotos, descripciones e inteligencia artificial

- Cuando analizas una foto, la imagen (comprimida en tu dispositivo) se envía a la **API de Google Gemini** para estimar ingredientes y macros. Si falla, se usa **Cloudflare Workers AI** como alternativa.
- Si describes una comida con texto, ese texto se envía del mismo modo (Gemini o, si no está disponible, Cloudflare Workers AI) solo para estimar los macros. **No escribas datos personales** en la descripción.
- **NutriFit no guarda la foto ni el texto**: solo el resultado que confirmas.
- **Importante (nivel gratuito de Gemini):** mientras NutriFit use el nivel gratuito de la API, Google puede usar el contenido enviado para mejorar sus productos, y personas revisoras pueden verlo, según los [términos adicionales de la API de Gemini](https://ai.google.dev/gemini-api/terms). No subas fotos con personas o información privada. Si pasamos al nivel de pago, esto dejará de aplicarse y lo indicaremos aquí.
- Cloudflare Workers AI no usa el contenido para entrenar modelos.

## Con quién se comparten (encargados del tratamiento)

- **Cloudflare** (alojamiento, base de datos D1, protección anti-bots Turnstile y Workers AI).
- **Google** (análisis de fotos con Gemini, ver arriba).
- **Brevo** (envío del email con el enlace y el código de acceso).
- **Open Food Facts** (base de datos abierta de productos): cuando buscas un producto envasado, nuestro servidor consulta Open Food Facts **solo con el término de búsqueda o el código de barras**, sin tu email, tu IP ni ningún dato de tu cuenta, y guarda la respuesta en caché unos días. La base de alimentos genéricos está incluida en la app y no hace ninguna consulta externa.

No vendemos datos, no hay publicidad y no usamos herramientas de analítica ni de seguimiento.

## Entrar en un ordenador con el QR

Cuando el ordenador muestra un QR para entrar con el móvil, guardamos durante **2 minutos** una solicitud con: una huella del identificador del QR y del secreto que se queda en ese navegador, un código corto de 4 caracteres, el navegador y sistema operativo aproximados del ordenador (p. ej. «Chrome · Windows») y su **ubicación aproximada** (ciudad y país, deducidos por Cloudflare a partir de la IP; no guardamos la IP). Lo mostramos en tu móvil para que compruebes que eres tú antes de pulsar «Aprobar». La solicitud solo sirve una vez y después se elimina en las limpiezas automáticas de la base de datos.

## Cookies y almacenamiento local

- Una única cookie técnica, `nf_session`, para mantener tu sesión (30 días). En la app Android se usa un token guardado en el almacenamiento privado de la app.
- En tu navegador se guardan preferencias (tema, peso objetivo, aviso de instalación) y una copia en caché de la app para que funcione sin conexión.

## Cuánto tiempo

Mientras tengas cuenta. Los enlaces y códigos de acceso caducan a los 15 minutos, las solicitudes de acceso por QR a los 2 minutos, y unos y otros se eliminan después en las limpiezas automáticas; los registros anti-abuso se borran en 48 horas.

## Tus derechos

Puedes descargar tus comidas, peso y agua en CSV desde **Historial → Exportar**, y pedir acceso, rectificación, portabilidad o **eliminación de tu cuenta y todos tus datos** escribiendo a [soporte@trujillomingorance.com](mailto:soporte@trujillomingorance.com). También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).

## Cambios

Si cambia algo importante (por ejemplo, el proveedor de IA), lo avisaremos en la app y actualizaremos esta página.
