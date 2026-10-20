# Política de Privacidad y Cumplimiento RGPD · NutriFit
**Reglamento (UE) 2016/679 (RGPD) y Ley Orgánica 3/2018 (LOPDGDD)**  
**Canal Oficial de Privacidad:** `nutrifit@trujillomingorance.com`  
**Responsable del Tratamiento:** NutriFit Labs · Barcelona, España  
**Vigencia:** 2026

---

## 1. Principio Fundamental: Privacidad por Diseño (Privacy by Design)
NutriFit se fundamenta en minimizar la recogida de datos al mínimo técnico indispensable (*Data Minimization*). Toda la lógica de cálculo y registro puede funcionar de manera aislada en el cliente local sin necesidad de transmisión continua de telemetría a servidores centrales.

---

## 2. Categorías de Datos Tratados

| Categoría | Datos Específicos | Finalidad | Base Jurídica |
| :--- | :--- | :--- | :--- |
| **Identificación** | Dirección de correo electrónico | Envío de enlaces mágicos y autenticación | Ejecución del contrato (Art. 6.1.b RGPD) |
| **Perfil Nutricional** | Edad, sexo biológico, altura, peso, nivel de actividad | Estimación metabólica y macros recomendados | Consentimiento explícito (Art. 6.1.a y 9.2.a RGPD) |
| **Registro Diario** | Comidas, gramos, calorías, ingesta de agua | Visualización de progreso y estadísticas | Consentimiento explícito |
| **Fotografías de Platos** | Archivo temporal de imagen comprimida | Estimación con IA de composición del plato | Consentimiento y ejecución de funcionalidad |

---

## 3. Almacenamiento Local vs. Almacenamiento en Nube
1. **Dispositivo del Usuario (IndexedDB):** Los datos se almacenan en el espacio local del navegador bajo la base de datos `nutrifit_local`. El usuario tiene control físico sobre la eliminación de la caché y de los datos en cualquier instante.
2. **Servidores Cloudflare (Unión Europea / Red Global):** Las copias de seguridad de sincronización se alojan en Cloudflare D1 en nodos con certificación ISO/IEC 27001, SOC 2 Type II y cláusulas contractuales tipo (SCC) aprobadas por la Comisión Europea.
3. **Copia de seguridad diaria (Supabase, Unión Europea):** Cada noche se replica la base de datos principal en un proyecto de Supabase (PostgreSQL) alojado en la Unión Europea (Fráncfort, Alemania), sin sesiones, códigos de acceso ni tokens de apps conectadas. Las supresiones se propagan a la copia en un máximo de 24 horas.

---

## 4. Ejercicio de Derechos ARCO+ (Acceso, Rectificación, Supresión, Portabilidad, Limitación y Oposición)
Cualquier usuario puede ejercer sus derechos directamente:
- **Descarga Inmediata (Portabilidad):** Directamente desde la aplicación en `Ajustes > Exportar Datos`.
- **Eliminación Total (Derecho al Olvido):** Directamente desde `Ajustes > Eliminar Cuenta`.
- **Contacto Escrito:** Enviando un correo a `nutrifit@trujillomingorance.com` con el asunto `Ejercicio Derechos RGPD`. Se responderá en un plazo máximo de 72 horas laborales sin costes asociados.

---

## 5. Política de Cookies y Almacenamiento Local
NutriFit **NO** utiliza cookies publicitarias, ni cookies de seguimiento de terceros, ni fingerprinting de dispositivos:
- **`__Host-nf_sesion`**: Cookie técnica estricta, cifrada con firma criptográfica, marcada con atributos `HttpOnly`, `Secure` y `SameSite=Lax`.
- **`__Host-nf_google`**: Cookie técnica efímera para el flujo de autorización OAuth 2.0 (se elimina automáticamente tras completar el inicio de sesión).
