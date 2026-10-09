# Política de privacidad de NutriFit

Última actualización: 9 de octubre de 2026.

### Quién es el responsable

NutriFit es un proyecto de código abierto titularidad de Alberto Trujillo Mingorance (Barcelona, España). Contacto de privacidad y soporte: [soporte@trujillomingorance.com](mailto:soporte@trujillomingorance.com).

### Base legal del tratamiento

El tratamiento de tus datos de registro y uso se realiza sobre la base de la ejecución del servicio solicitado. Dado que los registros de peso y nutrición pueden considerarse categorías especiales de datos relativos a la salud (art. 9 RGPD), su tratamiento se fundamenta exclusivamente en tu consentimiento explícito al utilizar la aplicación, con el único fin de mostrarte tus propias métricas y seguimiento personal.

### Qué datos tratamos

- **Cuenta:** tu email (para enviarte el enlace o código de acceso sin contraseñas). Del código de acceso de 6 cifras solo se almacena una huella criptográfica (HMAC) durante un máximo de 15 minutos.
- **Perfil:** nombre o alias público, sexo, edad, peso, altura, nivel de actividad física y objetivo calórico/macros.
- **Diario y actividad:** comidas registradas (ingredientes, calorías y macronutrientes), historial de peso, ingesta de agua y sesiones de entrenamiento manuales.
- **Técnicos:** dirección IP tratada de forma transitoria y sometida a hash para mitigación de abusos y control de peticiones (rate limiting), junto a registros técnicos de errores sin datos personales vinculados.

### Fotos, descripciones e inteligencia artificial

- **Procesamiento de imágenes:** al analizar una imagen, tu dispositivo la redimensiona y descarta los metadatos EXIF (incluyendo geolocalización) antes de enviarla. La imagen se remite a la API de Google Gemini para estimar composición y macronutrientes. Si dicho servicio excede el tiempo de respuesta o no está disponible, la petición se deriva de forma secuencial y transparente a Groq (modelo visual), al gateway seguro Trujillo AI (`ai.trujillomingorance.com`) y, como último recurso, a Cloudflare Workers AI. Cada proveedor únicamente recibe la imagen si el anterior no ha respondido.
- **Descripciones de texto:** si describes una comida mediante texto libre, la cadena se procesa bajo el mismo flujo de análisis nutricional. Se recomienda no incluir datos personales en las descripciones.
- **Retención:** NutriFit no almacena las imágenes ni los textos descriptivos en sus servidores; únicamente se persiste en tu diario el resultado final que confirmas.
- **Aviso sobre el nivel gratuito de Gemini:** en el uso del tier gratuito de la API de Google Gemini, Google puede procesar los datos de conformidad con sus términos de servicio para desarrolladores con fines de depuración y mejora de modelos. Por ello, se prohíbe explícitamente subir fotografías que contengan rostros de personas o documentos personales. En caso de migración a niveles comerciales dedicados, se actualizará este apartado.
- **Proveedores alternativos:** Cloudflare Workers AI no emplea los datos suministrados para entrenar modelos.

### Destinatarios y encargados del tratamiento

- **Cloudflare, Inc.:** infraestructura de alojamiento, base de datos perimetral D1, mitigación de bots con Turnstile y Workers AI.
- **Google LLC:** inferencia y análisis nutricional mediante Gemini API.
- **Groq Inc.:** proveedor de inferencia rápida de visión como respaldo secundario.
- **Trujillo AI (`ai.trujillomingorance.com`):** gateway de contingencia para análisis de visión.
- **Brevo:** servicio de infraestructura para el envío transaccional de correos de acceso.
- **Open Food Facts:** catálogo alimentario abierto consultado mediante código de barras o término genérico de producto, sin transmitir tu email, tu IP ni identificadores de cuenta.

No se comercializan datos personales, no se inserta publicidad ni se utilizan plataformas de rastreo o analítica publicitaria de terceros.

### Acceso web mediante código QR

Cuando inicias sesión en un ordenador escaneando un código QR desde el móvil, se genera una solicitud temporal con una validez máxima de 2 minutos. Dicha solicitud contiene un identificador único anonimizado, un código de verificación de 4 caracteres, el navegador aproximado y la ubicación geográfica estimada (ciudad y país, provistas por Cloudflare a nivel de red sin persistir tu dirección IP). Esta información se visualiza exclusivamente en tu móvil para autorizar el acceso antes de pulsar «Aprobar» y se purga de forma inmediata tras su uso o caducidad.

### Cookies y almacenamiento local

- **Cookie técnica obligatoria:** cookie `__Host-nf_session`, configurada con directivas HttpOnly, Secure y SameSite=Lax con expiración a 30 días, destinada exclusivamente al mantenimiento de la sesión autenticada. Su identificador se guarda cifrado y queda invalidado al cerrar sesión. En la aplicación móvil se emplea un token de sesión en almacenamiento seguro local.
- **Almacenamiento web (Local-first):** en tu navegador se guardan tus preferencias de interfaz (modo oscuro, idioma), metas y la caché de la aplicación para permitir su operativa fuera de línea (PWA).

### Conservación de la información

Tus datos se conservan mientras mantengas activa tu cuenta. Los enlaces y códigos de inicio de sesión caducan a los 15 minutos, las autorizaciones QR a los 2 minutos (ambos eliminados en purgas automáticas programadas de la base de datos) y los registros técnicos anti-abuso se eliminan a las 48 horas.

### Tus derechos

De acuerdo con el RGPD y la LOPDGDD, tienes derecho de acceso, rectificación, supresión (derecho al olvido), limitación del tratamiento, portabilidad y oposición. Puedes descargar un volcado completo de tus registros desde la sección de configuración de la app o solicitar el borrado íntegro de tu cuenta dirigiéndote a [soporte@trujillomingorance.com](mailto:soporte@trujillomingorance.com). Igualmente, tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos ([aepd.es](https://www.aepd.es)) si consideras que tus derechos han sido vulnerados.

### Modificaciones

Cualquier actualización relevante en esta política (incluyendo cambios de proveedores de IA o funcionalidades de tratamiento) será notificada mediante la aplicación antes de su entrada en vigor.
