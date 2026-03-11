# 19 — Sistema de Licencias y Suscripciones

> **Estado:** Backend implementado ✅ | SaaS Admin UI pendiente 🔄
> **Actualizado:** 2026-03-05 (antes: 2026-03-04)
> **Aplica a:** Web SaaS (Tauri/Desktop removido marzo 2026)
> **Branch:** `fix/critical-security-multiagent`

---

## 1. Resumen del Modelo

| Aspecto | Decisión |
|---------|----------|
| Cobro por | **Computadora** (device_id ligado a hardware) |
| Trial | **Configurable por admin** (días editables, no hardcodeado) |
| Planes | `trial` · `monthly` · `annual` · `lifetime` |
| Validación web | Middleware chequea `subscription_expires_at` en BD |
| Validación desktop | Online al arrancar + archivo `.lic` local para offline |
| Auto-expiración | APScheduler en FastAPI (job diario) |
| Control manual | Panel SaaS Admin con botones de gestión |

---

## 2. Modelo de Datos — Cambios al Tenant

### Nuevos campos en tabla `tenants` (schema `public`)

```python
# Agregar a models/tenant.py
license_type             = Column(String(20), default="trial")
# Valores: "trial" | "monthly" | "annual" | "lifetime"

trial_days               = Column(Integer, default=15)
# Días de prueba configurables por el admin SaaS

trial_ends_at            = Column(DateTime, nullable=True)
# Calculado al activar: NOW() + trial_days

subscription_expires_at  = Column(DateTime, nullable=True)
# Fecha de vencimiento de la suscripción activa

license_blocked_reason   = Column(String(50), nullable=True)
# "expired" | "unpaid" | "manual" | null

# is_active ya existe — se usa como flag de bloqueo efectivo
```

### Alembic migration

```python
# alembic/versions/XXXX_add_license_fields_to_tenants.py
op.add_column('tenants', sa.Column('license_type', sa.String(20), default='trial'))
op.add_column('tenants', sa.Column('trial_days', sa.Integer(), default=15))
op.add_column('tenants', sa.Column('trial_ends_at', sa.DateTime(), nullable=True))
op.add_column('tenants', sa.Column('subscription_expires_at', sa.DateTime(), nullable=True))
op.add_column('tenants', sa.Column('license_blocked_reason', sa.String(50), nullable=True))
```

---

## 3. Lógica de Expiración — Web SaaS

### Fix crítico aplicado (2026-03-04)

**Bug encontrado y corregido:** El endpoint `POST /auth/login` no verificaba `tenant.is_active`
antes de autenticar al usuario. Una empresa desactivada manualmente desde el panel
podía seguir iniciando sesión.

**Fix en `routers/auth.py`:**
```python
if tenant and not tenant.is_active:
    raise HTTPException(
        status_code=403,
        detail="Esta empresa está suspendida. Contacta a soporte para renovar tu suscripción."
    )
```

### Auto-expiración diaria (APScheduler)

```python
# backend_api/scheduler.py (nuevo archivo)
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('cron', hour=0, minute=5)  # Cada día a las 00:05
async def auto_expire_tenants():
    """Desactiva tenants con suscripción vencida."""
    db = next(get_db())
    now = datetime.utcnow()

    expired = db.query(Tenant).filter(
        Tenant.is_active == True,
        or_(
            and_(Tenant.license_type == 'trial', Tenant.trial_ends_at < now),
            and_(Tenant.license_type != 'trial',
                 Tenant.license_type != 'lifetime',
                 Tenant.subscription_expires_at < now)
        )
    ).all()

    for tenant in expired:
        tenant.is_active = False
        tenant.license_blocked_reason = "expired"
        print(f"⏰ [LICENSE] Auto-expired tenant: {tenant.schema_name}")

    db.commit()
    print(f"⏰ [LICENSE] Checked expiry. Disabled {len(expired)} tenants.")
```

Registrar en `main.py`:
```python
from .scheduler import scheduler

@app.on_event("startup")
async def startup():
    scheduler.start()

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
```

### LicenseGuardMiddleware (actualización)

El middleware actual valida la licencia del **servidor** (license.key del VPS).
**No confundir** con las licencias de tenants individuales.

Para bloquear requests de tenants expirados, el check se hace en `get_current_user`
(dependencies.py) — ya existe el check `tenant.is_active`. El login también bloquea.

---

## 4. Sistema de Licencias — App Desktop Tauri

### 4.1 Flujo completo

```
PRIMERA ACTIVACIÓN (necesita internet):
┌─────────────────────────────────────────────────────────┐
│  App arranca por primera vez                            │
│  ↓                                                      │
│  Genera device_id (MAC address + disk serial hash)      │
│  ↓                                                      │
│  POST /api/v1/desktop/license/activate                  │
│    Body: { tenant_id, device_id, app_version }          │
│  ↓                                                      │
│  Servidor responde:                                     │
│    • Tenant nuevo → crea trial automático (X días)      │
│    • Tenant existente + activo → devuelve JWT licencia  │
│    • Tenant bloqueado → 402 con mensaje de renovación  │
│  ↓                                                      │
│  App guarda license.lic en %AppData%\Invensoft\         │
└─────────────────────────────────────────────────────────┘

ARRANQUES SIGUIENTES:
┌─────────────────────────────────────────────────────────┐
│  App arranca                                            │
│  ↓                                                      │
│  ¿Hay internet?                                        │
│  ├── SÍ → GET /api/v1/desktop/license/status           │
│  │         ├── Activo → refresca license.lic local      │
│  │         └── Bloqueado → pantalla de suspensión       │
│  └── NO → Lee license.lic local                        │
│           ├── Válido (no vencido) → ✅ funciona         │
│           │   └── Aviso si vence en < 7 días            │
│           ├── Vence hoy → ⚠️ gracia de 5 días          │
│           └── Vencido + sin gracia → ❌ pantalla lock   │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Archivo `license.lic` (JWT RS256)

Guardado en: `%AppData%\Invensoft\license.lic`

**Payload:**
```json
{
  "tenant_id": "ferreteria-gonzalez",
  "tenant_name": "Ferretería González",
  "device_id": "a3f8b2c1d4e5...",
  "plan": "monthly",
  "issued_at": "2026-03-01T00:00:00Z",
  "expires_at": "2026-04-01T00:00:00Z",
  "grace_days": 5,
  "features": ["pos", "restaurant", "hardware"],
  "max_users": 10,
  "iss": "miinventariofacil.com"
}
```

- Firmado con **clave privada RS256** del servidor
- El `.exe` tiene la **clave pública** embebida (no puede ser falseada)
- Si alguien edita el archivo → firma inválida → app rechaza

### 4.3 Generación del device_id

```rust
// src-tauri/src/license.rs
fn get_device_id() -> String {
    // Combina MAC address + ID de volumen de disco
    // Resultado: hash SHA256 de ambos → 64 chars hex
    // Estable entre reinicios, cambia si se cambia el disco/placa madre
}
```

**Política de device_id:**
- 1 licencia = 1 computadora
- Si el cliente cambia de hardware → contacta admin → admin revoca device_id viejo y activa el nuevo
- El admin puede ver todos los device_ids registrados por tenant en el panel SaaS

### 4.4 Nuevos endpoints FastAPI

```python
# routers/desktop_license.py (nuevo archivo)

POST /api/v1/desktop/license/activate
"""
Primera activación. Registra device_id y crea trial si es nuevo.
"""
Body: {
    "tenant_id": str,
    "device_id": str,
    "app_version": str
}
Response: {
    "license_token": "JWT...",
    "plan": "trial",
    "expires_at": "2026-04-04T...",
    "days_remaining": 30,
    "message": "Trial activado por 30 días"
}

GET /api/v1/desktop/license/status
"""
Verifica estado actual. Llamado en cada arranque cuando hay internet.
"""
Header: X-Device-ID: <device_id>
Header: X-Tenant-ID: <tenant_slug>
Response: {
    "valid": true,
    "plan": "monthly",
    "expires_at": "2026-04-01T...",
    "days_remaining": 28,
    "license_token": "JWT actualizado..."
}

# --- Solo superadmin ---

POST /api/v1/saas-admin/licenses/manage
Body: {
    "tenant_id": str,
    "action": "grant_trial" | "extend_monthly" | "extend_annual" | "grant_lifetime" | "revoke",
    "days": int  # Solo para grant_trial
}
```

### 4.5 Tabla `desktop_licenses` (nuevo modelo)

```python
# models/tenant.py — nueva tabla en schema 'public'
class DesktopLicense(Base):
    __tablename__ = "desktop_licenses"
    __table_args__ = {'schema': 'public'}

    id            = Column(Integer, primary_key=True)
    tenant_id     = Column(Integer, ForeignKey("public.tenants.id"))
    device_id     = Column(String(64), nullable=False)   # hash SHA256
    device_label  = Column(String(100), nullable=True)   # "Caja 1", "Oficina"
    activated_at  = Column(DateTime, default=datetime.utcnow)
    last_seen_at  = Column(DateTime, nullable=True)
    is_active     = Column(Boolean, default=True)
    app_version   = Column(String(20), nullable=True)

    # Índice único por tenant + device
    __table_args__ = (
        UniqueConstraint('tenant_id', 'device_id'),
        {'schema': 'public'}
    )
```

---

## 5. Panel SaaS Admin — Gestión de Licencias

### Vista principal

```
┌─────────────────────────────────────────────────────────────────┐
│ GESTIÓN DE LICENCIAS                                            │
├────────────────┬──────────┬────────────┬──────────┬────────────┤
│ Empresa        │ Plan     │ Vence      │ Estado   │ Acciones   │
├────────────────┼──────────┼────────────┼──────────┼────────────┤
│ Ferret. Glez.  │ monthly  │ 2026-04-01 │ ✅ Activo│ [Extender] │
│ Rest. El Sol   │ trial    │ 2026-03-19 │ ⏳ Trial │ [Activar]  │
│ Lavand. Venus  │ annual   │ 2027-01-01 │ ✅ Activo│ [Extender] │
│ Peluq. Estilo  │ monthly  │ 2026-02-28 │ ❌ Vencid│ [Renovar]  │
└────────────────┴──────────┴────────────┴──────────┴────────────┘

[+ Configurar días de trial por defecto: [30] días]
```

### Acciones disponibles

- **Trial configurable:** Admin define días de prueba al crear tenant (o cambiar default global)
- **Extender mensual:** +30 días desde hoy (o desde vencimiento si está vigente)
- **Extender anual:** +365 días
- **Lifetime:** Sin fecha de vencimiento
- **Revocar:** Bloquea inmediatamente
- **Ver dispositivos:** Lista de device_ids registrados por tenant con botón "Revocar dispositivo"

---

## 6. Pantallas de la App Desktop (estados de licencia)

### Estado: Trial activo
```
🔔 Modo prueba: 23 días restantes
   [Contactar para activar licencia completa]
```
Banner discreto en la parte superior. No bloquea el uso.

### Estado: Vence pronto (< 7 días)
```
⚠️ Tu licencia vence en 5 días
   Contacta a tu proveedor para renovar.
   [Renovar ahora]
```
Toast + banner naranja.

### Estado: Sin internet + no vencido
```
✅ Modo offline — Licencia válida hasta 01/04/2026
```
Badge verde discreto.

### Estado: Vencido (offline)
```
╔═══════════════════════════════════════╗
║   🔒 LICENCIA VENCIDA                 ║
║                                       ║
║   Tu licencia venció el 01/04/2026    ║
║   Conecta a internet para renovar     ║
║   o contacta a soporte.               ║
║                                       ║
║   [Reintentar conexión]               ║
╚═══════════════════════════════════════╝
```
Pantalla de bloqueo. No se puede usar la app.

### Estado: Bloqueado por admin (impago)
```
╔═══════════════════════════════════════╗
║   ⛔ CUENTA SUSPENDIDA                ║
║                                       ║
║   Esta empresa ha sido suspendida.    ║
║   Motivo: Pago pendiente              ║
║                                       ║
║   Contacta a soporte:                 ║
║   soporte@miinventariofacil.com       ║
╚═══════════════════════════════════════╝
```

---

## 7. Fases de Implementación

| Fase | Qué incluye | Dónde | Estado |
|------|------------|-------|--------|
| **A** | Fix login bug (tenant.is_active) | Backend | ✅ HECHO |
| **D** | Endpoints `/desktop/license/*` (activar + CRUD admin) | Backend | ✅ HECHO |
| **E** | Tabla `public.desktop_licenses` + modelo + migración | Backend | ✅ HECHO |
| **B** | Campos license en modelo Tenant + migración | Backend | 🔄 Pendiente |
| **C** | APScheduler auto-expiración diaria | Backend | 🔄 Pendiente |
| **F** | Panel licencias en SaaS Admin (UI) | saas_admin | 🔄 **PRÓXIMO** |
| **G** | Validación offline en Tauri (Rust, key embebida) | Tauri | 🔄 Pendiente |
| **H** | Pantallas trial/vencimiento en React | Frontend | 🔄 Pendiente |

### Implementación real (2026-03-05) — vs diseño original

El diseño original especificaba device_id + JWT RS256. La implementación fase 1 usó
un enfoque más simple y operacional de inmediato:

**Lo que se implementó:**
- Licencias con formato `XXXX-XXXX-XXXX-XXXX` generadas por el admin
- Tabla `public.desktop_licenses` con: `license_key` (unique), `plan_name`,
  flags de módulos por licencia, `max_devices`, `activations_count`, `expires_at`
- Activación: POST sin auth → valida key, retorna módulos habilitados
- Admin CRUD completo protegido con `get_current_superuser`

**Diferencias respecto al diseño:**
- No usa device_id (simplificado para fase 1)
- No usa JWT RS256 para el `.lic` (usa localStorage en la app)
- Offline: 7 días de gracia vía `localStorage` (`desktop_license_exp`)
- Los módulos se leen de la respuesta del servidor (preparado para fase 2)

**Archivos creados:**
- `backend_api/models/desktop_license.py` — Modelo `DesktopLicense`
- `backend_api/routers/desktop_licenses.py` — Router con activación y CRUD
- `alembic/versions/0fbdc2b894af_add_desktop_licenses_table.py` — Migración
- `frontend_web/src/pages/LicenseActivation.jsx` — UI de activación + bypass DEV

---

## 8. Configuración por Entorno

```env
# .env / .env.prod
LICENSE_TRIAL_DAYS_DEFAULT=30        # Días de trial por defecto (editable por admin)
LICENSE_GRACE_DAYS_OFFLINE=5         # Días de gracia offline después del vencimiento
LICENSE_RS256_PRIVATE_KEY=<key>      # Para firmar tokens de licencia desktop
LICENSE_RS256_PUBLIC_KEY=<key>       # Pública (también embebida en .exe Tauri)
```

---

*Documento creado: 2026-03-04*
*Fix aplicado: login no bloqueaba tenant inactivo → corregido en auth.py*
