# Invensoft — Sistema SaaS de Gestión de Negocios

> Plataforma multi-tenant para ferretería, restaurante, barbería, lavandería, servicio técnico y farmacia. Desarrollada para el mercado latinoamericano con soporte multimoneda nativo (USD / VES / COP) y tasas BCV automáticas.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Backend** | FastAPI · Python 3.12 · PostgreSQL 15+ |
| **Frontend** | React 18 · Vite · Tailwind CSS |
| **SaaS Admin** | React + TypeScript · Vite |
| **Hardware Bridge** | C# .NET WPF · WebSocket · ESC/POS |
| **Infraestructura** | Docker Compose · Traefik · Let's Encrypt |

---

## Módulos de Negocio

| Módulo | Descripción |
|--------|-------------|
| **POS Multi-moneda** | Ventas en USD / VES / COP con tasas BCV en tiempo real, IGTF automático |
| **Inventario** | Stock por almacén, Kardex valorado, transferencias, combos con escandallo |
| **Cuentas por Cobrar** | Créditos con límite configurable, aging report, bloqueo automático |
| **Caja Multicaja** | Múltiples cajas simultáneas, Reporte Z, cierre archivable multi-moneda |
| **Servicio Técnico** | Recepción con diagnóstico, garantías RMA, tickets 58mm/80mm |
| **Restaurante** | Mapa de mesas, KDS (pantalla cocina), takeout, menú digital, escandallo |
| **Barbería** | Comisiones automáticas por empleado, dashboard integrado con POS |
| **Lavandería** | Órdenes de servicio con estados de entrega |
| **Farmacia** | Lotes con vencimiento, recetas, control regulatorio |
| **Cotizaciones** | Generación, envío por email, conversión directa a venta |

---

## Arquitectura Multi-Tenant

Cada empresa tiene su propio **schema PostgreSQL** aislado. La detección del tenant se realiza por **subdominio** (`empresa.miinventariofacil.com`) o header `X-Tenant-ID`.

```
public schema     → datos globales (tenants, users, audit_logs)
{empresa} schema  → datos del negocio (productos, ventas, caja, etc.)
```

---

## Estructura del Proyecto

```
inventario/
├── ferreteria_refactor/
│   ├── backend_api/           # FastAPI + Python
│   │   ├── routers/           # Endpoints por dominio
│   │   ├── services/          # Lógica de negocio
│   │   ├── models/            # SQLAlchemy ORM
│   │   ├── middleware/        # TenantMiddleware, LicenseGuard
│   │   ├── scheduler.py       # APScheduler (backups, licencias)
│   │   └── tests/             # 800+ tests (pytest)
│   ├── frontend_web/          # React 18 + Vite
│   │   └── src/
│   │       ├── pages/         # 58 páginas lazy-loaded
│   │       ├── components/    # Componentes reutilizables
│   │       └── context/       # Auth, Cart, Config, WebSocket
│   ├── saas_admin/            # Panel superadmin (TypeScript)
│   ├── alembic/               # Migraciones de base de datos
│   └── _CEREBRO_PROYECTO/     # Documentación técnica detallada
├── Invensoft_Windows_Bridge/  # Bridge C# para impresoras ESC/POS
├── landing_page/              # Landing page estática
├── docker-compose.prod.yml
├── docker-compose.qa.yml
└── deploy_images.sh           # Build + push + deploy automatizado
```

---

## Sistema de Licencias

| Tipo | Duración |
|------|----------|
| `trial` | 2 días (configurable) |
| `monthly` | Mensual |
| `annual` | Anual |
| `lifetime` | Vitalicio |

- Auto-expiración con **5 días de gracia** (scheduler a las 00:05 UTC)
- Email de aviso cuando quedan ≤7 días
- Backup automático diario a las 01:00 AM Venezuela

---

## RBAC — Control de Acceso

| Rol | Permisos |
|-----|---------|
| `ADMIN` | Acceso total al tenant |
| `CASHIER` | POS, Ventas, Clientes, Caja, Servicios, Cotizaciones |
| `WAREHOUSE` | Inventario, Compras, Proveedores, Farmacia |
| `superuser` | Solo panel SaaS admin |

---

## Desarrollo Local

### Requisitos

- Python 3.12+
- Node.js 22+
- PostgreSQL 15+
- Docker (opcional)

### Backend

```bash
cd ferreteria_refactor/backend_api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Configurar .env (ver .env.example)
alembic upgrade head
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd ferreteria_refactor/frontend_web
npm install
# Configurar .env.development (ver .env.example)
npm run dev
```

### Con Docker (stack completo)

```bash
docker-compose -f docker-compose.qa.yml up -d
```

### Multi-tenancy local

Agregar a `/etc/hosts`:
```
127.0.0.1 demo.localhost
127.0.0.1 miempresa.localhost
```

---

## Tests

```bash
cd ferreteria_refactor/backend_api
pytest tests/ -v --cov=. --cov-report=term-missing
```

El suite incluye 800+ tests con fixtures para PostgreSQL real y SQLite.

---

## Deploy

```bash
./deploy_images.sh
```

El script:
1. Ejecuta tests pre-flight (328 tests)
2. Construye imágenes Docker multi-stage
3. Publica en DockerHub con tag versionado
4. Conecta al VPS y hace pull + restart

---

## Documentación

La documentación técnica detallada vive en [`ferreteria_refactor/_CEREBRO_PROYECTO/`](ferreteria_refactor/_CEREBRO_PROYECTO/):

| Documento | Contenido |
|-----------|-----------|
| `01_Arquitectura.md` | Flujo de peticiones, WebSockets, middleware |
| `02_Base_De_Datos.md` | Modelos, índices, provisioning de tenant |
| `05_Guia_Despliegue.md` | Docker, Traefik, rollback, variables de entorno |
| `08_Seguridad_y_Auditoria.md` | RBAC, AuditLog, hardening, CORS |
| `12_Manual_de_Desarrollo_Local.md` | Setup local, multi-tenancy en localhost |
| `17_Deuda_Tecnica_y_Plan_de_Mejoras.md` | Roadmap técnico |
| `24_Auditoria_Integral_2026-03-25.md` | Auditoría completa del sistema |

---

## Variables de Entorno Clave

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/invensoft
SECRET_KEY=your-secret-key-here
ENVIRONMENT=production
SMTP_HOST=privateemail.com
SMTP_PORT=587
SMTP_USER=soporte@miinventariofacil.com
CF_DNS_API_TOKEN=your-cloudflare-token
```

Ver `.env.example` para la lista completa.

---

## Contribuir

1. Crear rama desde `main`: `git checkout -b feature/nombre`
2. Commits en español con prefijo convencional: `feat:`, `fix:`, `chore:`, `test:`
3. Todos los tests deben pasar antes del merge
4. PR con descripción del cambio y capturas si aplica

---

## Contacto y Soporte

- **WhatsApp:** +58 422-741-0094
- **Email:** soporte@miinventariofacil.com
- **Web:** [miinventariofacil.com](https://miinventariofacil.com)
