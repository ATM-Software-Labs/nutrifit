# Acuerdo de Procesamiento de Datos (DPA) · NutriFit
**Data Processing Agreement conforme al Artículo 28 del RGPD**  
**Contacto Oficial:** `nutrifit@trujillomingorance.com`  
**Aplicable a:** Empresas, entrenadores, nutricionistas y clientes corporativos de NutriFit.

---

## 1. Definiciones y Partes
- **Responsable del Tratamiento (Controller):** El cliente u organización corporativa que gestiona planes o datos de usuarios a través de la infraestructura NutriFit.
- **Encargado del Tratamiento (Processor):** NutriFit Platform (`nutrifit@trujillomingorance.com`), que provee la infraestructura informática, bases de datos y motores de inferencia.

---

## 2. Instrucciones Documentadas y Confidencialidad
1. NutriFit únicamente tratará los datos de acuerdo con las instrucciones documentadas del Responsable y las funcionalidades intrínsecas de la plataforma.
2. Todo el personal y colaboradores con acceso eventual a los sistemas de soporte están sujetos a acuerdos estrictos de confidencialidad y secreto profesional.

---

## 3. Subencargados del Tratamiento Autorizados (Subprocessors)

| Subencargado | Sede / Jurisdicción | Servicio Prestado | Garantías de Seguridad |
| :--- | :--- | :--- | :--- |
| **Cloudflare, Inc.** | EE. UU. / Unión Europea | Red de entrega (CDN), Edge Workers, Cloudflare D1 | Cláusulas Contractuales Tipo (SCC), SOC 2 Type II, ISO 27001 |
| **Brevo (Sendinblue)** | París, Francia (UE) | Envío de correos transaccionales (Magic Links) | Servidores ubicados en la Unión Europea, RGPD Compliant |
| **Google Cloud Platform** | Global / UE | API de inferencia multimodal e inicio de sesión OAuth | Certificación ISO 27001, SOC 2, DPA corporativo |

Cualquier cambio o incorporación en la lista de subencargados se notificará formalmente a través del canal corporativo `nutrifit@trujillomingorance.com`.

---

## 4. Medidas Técnicas y Organizativas (TOMs)
NutriFit implementa medidas técnicas de seguridad de vanguardia:
- Cifrado en tránsito mediante TLS 1.3 con conjuntos de cifrado resistentes a ataques de intermediarios (HSTS activado con `max-age=31536000`).
- Cifrado en reposo en la base de datos de borde (AES-256).
- Aislamiento de entornos de ejecución mediante micro-contenedores V8 Isolate en Cloudflare Workers.
- Sanitización estricta de entradas y prevención de inyecciones SQL mediante consultas 100% parametrizadas (`prepare().bind()`).
- Rate limiting automatizado por IP y por identificador de usuario para mitigar ataques de denegación de servicio y fuerza bruta.

---

## 5. Notificación de Incidentes de Seguridad
En caso de tener conocimiento de cualquier brecha de seguridad que afecte a los datos personales tratados, NutriFit notificará al Responsable en un plazo no superior a **48 horas** tras la confirmación del incidente, aportando los detalles técnicos y las medidas correctivas adoptadas.

Formalizaciones y solicitudes de firma de DPA: `nutrifit@trujillomingorance.com`.
