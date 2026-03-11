# 08 - Seguridad y Auditoría (RBAC y Trazabilidad)

Protocolos de seguridad y aseguramiento de datos en **Mi Inventario Fácil**.

## 1. Aislamiento Multi-Tenant
*   **Schema Isolation**: Cada cliente (Ferretería, Lavandería, etc.) tiene su propia base de datos lógica.
*   **Validation**: El middleware valida cada petición garantizando que un usuario solo acceda a los datos de su propia suscripción.

## 2. Roles y Permisos (RBAC)
*   **ADMIN**: Control total del negocio y configuraciones globales.
*   **CASHIER**: Limitado a ventas y gestión de efectivo de su turno.
*   **WAREHOUSE**: Permisos específicos para recepciones y conteos de stock.

## 3. Autorización por PIN
Acciones sensibles (Descuentos altos, crédito a morosos) disparan una solicitud de PIN. Un administrador debe ingresar su código de autorización para que el sistema permita procesar la excepción.

## 4. AuditLog (Registro de Actividad)
Toda modificación de datos genera una entrada en la tabla de auditoría:
*   **Timestamp**: Momento exacto de la acción.
*   **User**: Quién lo hizo.
*   **Action**: `CREATE`, `UPDATE` o `DELETE`.
*   **State**: Snapshot de los datos antes y después del cambio para auditorías técnicas.

## 5. Auditoría de Seguridad (Marzo 2026)

> **Branch:** `fix/critical-security-multiagent` | **Método:** 4 agentes correctores + 4 verificadores en paralelo
> **Resultado:** 35+ hallazgos resueltos en 15 commits atómicos, 100% verificados.

### 5.1 Hardening del Backend
| Fix | Detalle |
|-----|---------|
| Global exception handler | No expone `str(exc)` ni `type(exc).__name__`; retorna siempre `{"detail": "Internal server error"}` + `logger.exception()` interno |
| Endpoint `/debug/routes` | Protegido con `Depends(get_current_superuser)` |
| Bare `except:` eliminados | 4 ocurrencias reemplazadas por excepciones específicas (services, config, admin, cash) |
| `DATABASE_URL` sin default SQLite | Fuerza configuración explícita en todos los entornos |
| `BACKUP_DIR` | `os.environ.get()` en vez de hardcoded `/app/backups` |
| Subdominios reservados | Middleware bloquea `api-*` y `admin-*` en producción |

### 5.2 CORS y Orígenes
- **Producción:** solo orígenes `https://` permitidos
- **Desarrollo:** permite también `http://localhost`
- **Configuración:** variable `CORS_ORIGINS` env var + merge con defaults
- **Regex multi-nivel:** soporta `tenant.qa.miinventariofacil.com` (sub-subdominios)

### 5.3 Secretos y Credenciales
| Fix | Detalle |
|-----|---------|
| Cloudflare token | Externalizado a `${CF_DNS_API_TOKEN}` env var (antes hardcoded en deploy script) |
| `.gitignore` | Añadido `.venv/`, `!.env.example` |
| **Pendiente** | Rotar token Cloudflare (el viejo estuvo en git history) |
| **Pendiente** | Rotar `private_key.pem` (JWT signing key estuvo en repo) |

### 5.4 Infraestructura Docker
| Fix | Detalle |
|-----|---------|
| Non-root user | `appuser` en backend + root Dockerfile (nginx mantiene root para puerto 80) |
| Security headers nginx | `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy` |
| Healthchecks | Backend: `python urllib` a `/api/v1/health` |
| Resource limits | backend 512m, frontend 128m, db 1g, traefik 256m |
| Versiones pinneadas | 30 paquetes Python (`==`) + 8 base images Docker con version+distro |
| Timezone | `TZ=America/Caracas` en backend + DB (QA y Prod) |

### 5.5 Rate Limiting
- `slowapi` integrado con handler de error personalizado
- `POST /pin-login`: `@limiter.limit("5/minute")`
- `/auth/login` y `/public/register`: ya contaban con rate limiting previo
- **Nota:** el parametro `Request` DEBE llamarse `request` (no `http_request`) para que slowapi funcione
- **Pendiente:** verificar cobertura en `/auth/discovery` y otros endpoints publicos
