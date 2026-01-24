# Informe Técnico: Integración Android Management API

**Fecha:** 21/01/2026
**Módulo:** `security_module`
**Estado Actual:** Bloqueado por límites de cuota de Google.

## 1. Objetivo
Crear un microservicio en Node.js capaz de:
1.  Autenticarse con Android Management API.
2.  Crear una entidad "Enterprise" (Empresa).
3.  Definir políticas de seguridad (Bloqueo Kiosco vs Desbloqueado).
4.  Generar códigos QR para enrolar dispositivos físicos.

## 2. Trabajo Realizado

### Archivos Implementados
*   **`index.js`**: Cliente de autenticación usando `googleapis` y Credenciales de Servicio (`credentials.json`).
*   **`setup_enterprise.js`**: Script interactivo para crear la empresa.
    *   *Resultado:* Se creó exitosamente la empresa con ID `enterprises/LC01932uzn`.
    *   *Configuración:* Se guardó el ID en `config.json`.
*   **`policies.js`**: Script para subir políticas a la nube.
    *   *Política UNLOCKED:* `enterprises/LC01932uzn/policies/policy_unlocked` (Cámara, apps permitidas).
    *   *Política LOCKED:* `enterprises/LC01932uzn/policies/policy_locked` (Kiosco, solo Teléfono y Ajustes).
*   **`generate_qr.js`**: Script para crear tokens de enrolamiento.
    *   Genera un JSON con los datos necesarios (checksum, url de descarga, token).

## 3. Incidente Actual

### Descripción del Error
Al escanear el código QR generado con un dispositivo Android (tras restablecimiento de fábrica), el proceso de configuración inicia (descarga "Android Device Policy") pero falla antes de terminar con el siguiente mensaje en pantalla:

> **"Dado que su organización alcanzó sus límites de uso, este dispositivo no se puede configurar."**

**(En inglés: "Organization reached its usage limits")**

### Diagnóstico Técnico
Este error proviene directamente de la infraestructura de Google (Android Management API) y **no es un error del código fuente**.

Indica que la **Cuenta de Google** utilizada para crear la Enterprise (`setup_enterprise.js`) o el **Proyecto de Google Cloud** asociado ha alcanzado su cuota de dispositivos.

**Detalles Clave:**
*   Aunque el comando `list_devices.js` muestra **0 dispositivos activos**, Google contabiliza "intentos de enrolamiento", "dispositivos borrados recientemente" o tiene un límite muy bajo (a veces 0 o 10) para cuentas de prueba/personales que no han solicitado acceso de producción.
*   Se intentó mitigar usando tokens de un solo uso (`oneTimeOnly: true`), pero el bloqueo persiste a nivel de organización.

## 4. Pasos Recomendados para Solución

Para desbloquear el desarrollo, un experto o administrador debe realizar una de las siguientes acciones:

**Opción A (Recomendada para Pruebas Inmediatas):**
Crear una **NUEVA Enterprise** utilizando una **Cuenta de Google Diferente** que esté completamente limpia.
1.  Conseguir un Gmail nuevo.
2.  Ejecutar `node setup_enterprise.js` nuevamente.
3.  Usar el enlace generado e iniciar sesión con el *nuevo* Gmail.
4.  Actualizar el `config.json` con el nuevo Enterprise ID.

**Opción B (Solución Corporativa):**
Solicitar un aumento de cuota a Google para el proyecto actual.
1.  Acceder a la consola de Google Cloud.
2.  Buscar la cuota de "Android Management API" -> "Enrollment Tokens" o "Devices".
3.  Llenar el formulario de solicitud de cuota de producción (puede tardar días en aprobarse).
