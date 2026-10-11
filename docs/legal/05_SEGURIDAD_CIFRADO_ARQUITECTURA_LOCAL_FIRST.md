# Seguridad, Cifrado y Arquitectura Local-First · NutriFit
**Documento Técnico de Seguridad y Auditoría**  
**Contacto del Equipo de Seguridad:** `security@trujillomingorance.com` / `nutrifit@trujillomingorance.com`  
**Clasificación:** Público / Recursos Corporativos NutriFit  
**Versión:** 1.1 (2026)

---

## 1. Principios de Diseño Criptográfico

### 1.1. Arquitectura de Autenticación sin Contraseñas Estáticas
NutriFit elimina la superficie de ataque más común en la web (las contraseñas compartidas o vulnerables a filtraciones masivas). El acceso a la plataforma opera exclusivamente mediante:
1. **Magic Links Criptográficos:** Tokens criptográficos aleatorios de 256 bits generados con entropía segura de sistema operativo (`crypto.getRandomValues`). Estos tokens tienen un tiempo de vida (TTL) de 15 minutos y se invalidan inmediatamente tras el primer uso.
2. **Tokens de Sesión con Firma HMAC-SHA256:** Las cookies de sesión viajan firmadas con claves de alta entropía gestionadas a nivel de entorno en Cloudflare Secrets, con prefijo `__Host-` que impide la sobreescritura desde subdominios.
3. **Flujo de Emparejamiento QR Zero-Knowledge:** La clave de cifrado simétrica viaja únicamente en el fragmento hash de la URL (`#clave`) que los navegadores nunca envían en las peticiones HTTP a ningún servidor.

---

## 2. Protección de Datos en Tránsito y en Reposo
- **TLS 1.3 Obligatorio:** Todas las comunicaciones están protegidas mediante transporte cifrado de última generación con curva elíptica X25519 y algoritmos ChaCha20-Poly1305 / AES-256-GCM.
- **Cabeceras de Seguridad Avanzada (CSP y HSTS):**
  - `Content-Security-Policy`: Política estricta que impide la ejecución de scripts no autorizados (mitigación completa de Cross-Site Scripting - XSS).
  - `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`.
  - `X-Frame-Options: DENY`: Prevención absoluta de ataques de Clickjacking.
  - `X-Content-Type-Options: nosniff`: Prevención de ataques de confusión de tipo MIME.

---

## 3. Modelo Local-First y Resiliencia sin Conexión
1. **Almacenamiento Local Aislado:** La base de datos IndexedDB local almacena registros de comidas, hidratación, peso y perfiles, garantizando tiempos de carga instantáneos (0ms de latencia de red en operaciones comunes).
2. **Workers de Compresión en Navegador:** La reducción de tamaño y anonimización de metadatos EXIF de imágenes de platos se realiza directamente en el navegador del cliente antes de cualquier transmisión de red.

---

## 4. Política de Divulgación Coordinada de Vulnerabilidades (Vulnerability Disclosure)
NutriFit mantiene un compromiso activo con la comunidad de investigadores de seguridad. Si detectas cualquier fallo de seguridad o anomalía en la infraestructura:
1. Envía un informe detallado con prueba de concepto (PoC) a `security@trujillomingorance.com` o `nutrifit@trujillomingorance.com`.
2. Nos comprometemos a acusar recibo en menos de **24 horas** y a subsanar incidencias críticas en un plazo máximo de **72 horas**.
