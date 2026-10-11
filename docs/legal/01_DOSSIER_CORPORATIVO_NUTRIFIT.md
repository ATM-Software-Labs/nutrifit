# NutriFit · Dossier Corporativo y Memoria Técnica
**Entidad / Plataforma:** NutriFit Enterprise  
**Contacto Oficial:** `nutrifit@trujillomingorance.com`  
**Sede de Desarrollo:** Barcelona, España  
**Versión del Documento:** 1.1 (2026)  
**Canal Oficial de Repositorio:** [ATM Software Labs · NutriFit](https://github.com/ATM-Software-Labs/nutrifit)

---

## 1. Resumen Ejecutivo
NutriFit es una plataforma multiplataforma de registro nutricional, hidratación y composición corporal de grado profesional, diseñada bajo los principios de **Local-First**, **Zero-Knowledge Privacy** y **Soberanía del Usuario**. A diferencia de los modelos SaaS tradicionales basados en monetización publicitaria y telemetría invasiva, NutriFit opera como una Progressive Web App (PWA) de alto rendimiento y aplicación nativa para Android, garantizando que los datos de salud se procesen localmente y con cifrado estricto.

---

## 2. Pilares Arquitectónicos

### 2.1. Arquitectura Local-First (IndexedDB + SQLite)
- **Almacenamiento en Cliente:** La totalidad del diario de alimentos, registros de ingesta de agua, seguimiento de peso y metadatos nutricionales se almacenan en el dispositivo mediante IndexedDB (IndexedDB `nutrifit_local`) con persistencia garantizada.
- **Funcionamiento 100% Offline:** La aplicación precachea el 100% de sus recursos estáticos y modelos de IA en el navegador vía Service Worker, permitiendo un funcionamiento continuo sin conexión a internet.
- **Sincronización Opcional y Diferida:** La persistencia hacia la nube (Cloudflare D1) se realiza mediante micro-lotes cifrados en segundo plano utilizando tokens de sesión HttpOnly criptográficamente firmados (HMAC-SHA256).

### 2.2. Inteligencia Artificial en el Borde (Edge AI)
- **Modelos de Visión y Procesamiento del Lenguaje:** NutriFit incorpora parseo multimodal de comidas a través de Cloudflare Workers AI (`@cf/google/gemma-4-26b-a4b-it`) y Google Generative Language API con prompts estrictamente parametrizados y tiempos de respuesta ultra-bajos (<800ms).
- **Procesamiento de Imágenes en Local:** Antes de cualquier envío, las fotografías de platos se redimensionan y comprimen en WebP en el dispositivo mediante Web Workers específicos (`comprimirFoto.worker.ts`), sin enviar datos biométricos no solicitados.

### 2.3. Cero Rastro y Privacidad por Diseño (RGPD Compliance)
- **Sin Publicidad ni Rastreadores de Terceros:** Cero scripts de Meta Pixel, Google Analytics o redes de publicidad programática.
- **Identificadores Criptográficos Anónimos:** Las sesiones y códigos de emparejamiento por código QR utilizan claves efímeras de 256 bits generadas en el Web Crypto API del navegador (`crypto.randomUUID()` y `crypto.getRandomValues()`).

---

## 3. Especificaciones Técnicas y Stack

| Capa | Tecnologías | Propósito |
| :--- | :--- | :--- |
| **Frontend Core** | React 19, TypeScript 5.8, Vite 8, Tailwind CSS | Interfaz reactiva fluida a 60-120 FPS sin bloqueos en el hilo principal |
| **PWA & Offline** | Workbox, Service Workers, Web App Manifest | Instalación nativa en Android, Windows 11, iOS y macOS |
| **Nativo Android** | Capacitor 8, Kotlin Toolchain 21, Android SDK 36 | APK compilado reproducible, firmado con `apksigner` v2+v3 |
| **Backend & Edge** | Cloudflare Pages Functions, Workers AI | Serveless Edge computing distribuido en más de 300 ubicaciones globales |
| **Base de Datos** | Cloudflare D1 (SQLite distribuido) | Transacciones ACID de baja latencia con respaldo global |
| **Email Transaccional**| Brevo API / SMTP Cifrado TLS 1.3 | Magic links seguros sin almacenamiento de contraseñas |

---

## 4. Compromisos de Nivel de Servicio (SLA)
- **Disponibilidad de la Red Edge:** 99.9% de uptime garantizado por la infraestructura global de Cloudflare.
- **Tiempo de Recuperación ante Desastres (RTO):** < 15 minutos mediante despliegues inmutables atómicos.
- **Punto de Recuperación de Datos (RPO):** 0 minutos para datos locales en el dispositivo; replicación instantánea en Edge D1.

---

## 5. Contacto Corporativo y Soporte
- **Consultas Generales y Corporativas:** `nutrifit@trujillomingorance.com`
- **Seguridad e Informes de Vulnerabilidades:** `security@trujillomingorance.com` / `nutrifit@trujillomingorance.com`
- **Soporte de Privacidad (DPO):** `dpo@trujillomingorance.com`
- **Portal Web Oficial:** [https://nutri.trujillomingorance.com](https://nutri.trujillomingorance.com)
