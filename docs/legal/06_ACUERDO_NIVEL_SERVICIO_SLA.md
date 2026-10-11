# Acuerdo de Nivel de Servicio (SLA) · NutriFit
**Service Level Agreement (SLA) y Disponibilidad**  
**Contacto Oficial:** `nutrifit@trujillomingorance.com`  
**Vigencia:** 2026

---

## 1. Compromiso de Disponibilidad de la Infraestructura
NutriFit se compromete a mantener un porcentaje de disponibilidad mensual de al menos el **99.9%** para los servicios centrales de API y sincronización en la nube.

| Métrica | Nivel Comprometido | Método de Medición |
| :--- | :--- | :--- |
| **Disponibilidad de API Edge** | 99.9% mensual | Monitoreo sintético externo continuo cada 60s |
| **Tiempo de Respuesta (p95)** | < 120 ms | Métricas de latencia de borde en Cloudflare |
| **Disponibilidad Local en Cliente** | 100% (Modo Offline) | Almacenamiento IndexedDB y Service Worker en caché local |

---

## 2. Ventanas de Mantenimiento y Actualizaciones Inmutables
Debido al diseño de despliegue atómico e inmutable de Cloudflare Pages, las actualizaciones de versiones de la aplicación (incluyendo la versión web y las funciones backend) se despliegan **sin tiempo de inactividad** (*Zero-Downtime Deployments*).

Cualquier mantenimiento de base de datos mayor que requiera ventana programada se comunicará con al menos 48 horas de antelación.

---

## 3. Soporte Técnico y Tiempos de Respuesta

| Nivel de Severidad | Definición | Tiempo de Respuesta |
| :--- | :--- | :--- |
| **Severidad 1 (Crítica)** | Caída total de la API de sincronización | < 2 horas |
| **Severidad 2 (Alta)** | Degradación en el procesamiento de IA o parseo | < 8 horas |
| **Severidad 3 (Normal)** | Consultas de funcionamiento, dudas de cuenta | < 24 horas laborales |

Canal de incidencias y soporte corporativo: `nutrifit@trujillomingorance.com`.
