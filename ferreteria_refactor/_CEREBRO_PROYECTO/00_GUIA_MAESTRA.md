# 🧠 Guía Maestra — Mi Inventario Fácil
> Documento de referencia rápida. Todo lo que se ha construido, cómo funciona y qué falta.
> **Última actualización:** 2026-04-01

---

## 📋 Índice
1. [Stack y arquitectura](#stack)
2. [Infraestructura del servidor](#infra)
3. [Cómo hacer un deploy](#deploy)
4. [Módulos del sistema](#modulos)
5. [WhatsApp Business](#whatsapp)
6. [Feature Flags Premium](#flags)
7. [Ramas activas y roadmap](#roadmap)
8. [Errores conocidos y soluciones](#errores)
9. [Credenciales y accesos](#credenciales)

---

## 1. Stack y arquitectura {#stack}

```
Frontend React 18 + Vite + Tailwind
    │
    │ HTTPS (Cloudflare → Traefik)
    ▼
FastAPI (Python 3.12) — multi-tenant
    │
    ├── PostgreSQL 15 (un schema por tenant)
    ├── APScheduler (jobs automáticos)
    └── Servicio Baileys (WhatsApp)
```

| Componente | Tecnología | Puerto |
|---|---|---|
| Backend API | FastAPI + Uvicorn | 8000 |
| Frontend app | React + Nginx | 80 |
| Admin SaaS | React + Nginx | 80 |
| Landing page | React + Nginx | 80 |
| Base de datos | PostgreSQL 15 | 5432 |
| WhatsApp | Node.js + Baileys | 3000 |
| Reverse proxy | Traefik v2 | 80/443 |

---

## 2. Infraestructura del servidor {#infra}

**VPS:** 212.28.176.157 | **OS:** Ubuntu 24

### Contenedores en producción
```bash
docker ps --format "{{.Names}} | {{.Status}}"
```

| Contenedor | Imagen | Red principal |
|---|---|---|
| `backend_prod_server` | `gamijoam/ferreteria-backend:TAG` | web_publica |
| `frontend_prod_server` | `gamijoam/ferreteria-app:TAG` | web_publica |
| `landing_prod_server` | `gamijoam/ferreteria-landing:TAG` | web_publica |
| `admin_panel_prod_server` | `gamijoam/ferreteria-admin-panel:TAG` | web_publica |
| `db_prod_server` | `postgres:15-alpine` | prod_prod_internal |
| `whatsapp_service` | `mi-inventario-whatsapp:1.1` | web_publica |
| `backend_qa_server` | `gamijoam/ferreteria-backend:qa-*` | qa_qa_internal |
| `frontend_qa_server` | `gamijoam/ferreteria-app:qa-*` | web_publica |
| `traefik_core` | `traefik:v2.11` | web_publica |

### Redes Docker
| Red | Quién la usa |
|---|---|
| `web_publica` | Todos los servicios con dominio público (Traefik los ve aquí) |
| `prod_prod_internal` | backend_prod ↔ db_prod (sin internet) |
| `qa_qa_internal` | backend_qa ↔ db_qa |

### ⚠️ Regla crítica de redes
Traefik toma la **primera red** del contenedor para enrutar.
Siempre iniciar con `--network web_publica` y conectar la red interna después:
```bash
docker run -d --name backend_prod_server --network web_publica ...
sleep 5
docker network connect prod_prod_internal backend_prod_server
```

### Directorios importantes
```
/root/deploy/
├── qa/code/          ← Código fuente (git)
├── prod/             ← Configuración prod
│   ├── .env          ← TAG de la versión activa
│   └── data/media/   ← Imágenes y archivos (NO eliminar)
├── whatsapp-service/ ← Servicio Baileys
└── deploy.sh         ← Script de deploy automatizado ✅
```

---

## 3. Cómo hacer un deploy {#deploy}

### Deploy completo (recomendado)
```bash
cd /root/deploy/qa/code
git checkout main
git pull origin main

# Ejecutar el script automatizado
/root/deploy/deploy.sh "descripcion-del-deploy"

# Ejemplos:
/root/deploy/deploy.sh "reportes-excel"
/root/deploy/deploy.sh "portal-cliente-v1"
```

El script hace automáticamente:
1. ✅ Verifica git limpio en QA
2. ✅ Verifica credenciales DockerHub
3. ✅ Build de 4 imágenes
4. ✅ Push a DockerHub (`gamijoam/ferreteria-*:VERSION`)
5. ✅ Actualiza TAG en `/root/deploy/prod/.env`
6. ✅ Recrea los 4 contenedores (web_publica primero)
7. ✅ Smoke tests — si falla hace **rollback automático**
8. ✅ Push a GitHub

### Rollback manual de emergencia
```bash
OLD_TAG="prod-version-anterior-YYYYMMDD"
sed -i "s/^TAG=.*/TAG=$OLD_TAG/" /root/deploy/prod/.env
/root/deploy/deploy.sh --only-restart
```

### Migraciones de BD antes del deploy
Si hay nuevas columnas o tablas, ejecutar **ANTES** del build:
```sql
-- Patrón seguro (idempotente)
ALTER TABLE tabla ADD COLUMN IF NOT EXISTS col TIPO DEFAULT val;
INSERT INTO config(key,value) SELECT 'key','val'
  WHERE NOT EXISTS (SELECT 1 FROM config WHERE key='key');
```

---

## 4. Módulos del sistema {#modulos}

### Módulos activos (todos los tenants)
| Módulo | Ruta | Descripción |
|---|---|---|
| POS / Ventas | `#/pos` | Punto de venta con pagos mixtos |
| Inventario | `#/inventory` | Productos, categorías, stock mínimo |
| Clientes | `#/sales-center?tab=clientes` | CRM + Vista 360° + créditos |
| Cotizaciones | `#/sales-center?tab=cotizaciones` | PDF + envío WhatsApp |
| Taller/Servicios | `#/services` | Órdenes de servicio, técnicos |
| Compras | `#/purchases` | Proveedores, órdenes de compra |
| Reportes | `#/reports` | Ventas, inventario, caja |
| Configuración | `#/config` | Monedas, impuestos, WhatsApp, usuarios |
| Dashboard | `/` | KPIs en tiempo real |

### Módulos premium (feature flags)
| Módulo | Flag | Descripción |
|---|---|---|
| WhatsApp Business | `whatsapp_business` | 11 automatizaciones |
| Sistema Comisiones | `sistema_comisiones` | Comisiones por vendedor/técnico |
| Impresión A4 | `impresion_factura_a4` | Facturas en hoja normal |
| Precio libre POS | `precio_libre_pos` | Cajero edita precios |

### Módulos por tipo de negocio
| Módulo | Flag en tenant | Descripción |
|---|---|---|
| Restaurante | `has_restaurant_module` | Mesas, cocina, delivery |
| Lavandería | `has_laundry_module` | Órdenes de lavado |
| Barbería | `has_barbershop_module` | Citas, servicios |

---

## 5. WhatsApp Business {#whatsapp}

### Arquitectura
```
Tenant → "Conectar WhatsApp" → Backend → Servicio Baileys
                                              ↓
                                    Genera QR como PNG base64
                                              ↓
                               Frontend polling /instance/qr
                                              ↓
                                    Tenant escanea QR
                                              ↓
                                    WhatsApp conectado ✅
```

### 11 automatizaciones activas

| # | Mensaje | Trigger | Destinatario |
|---|---|---|---|
| 1 | Ticket de venta | Al cobrar POS | 👤 Cliente |
| 2 | Cotización PDF | Botón manual | 👤 Cliente |
| 3 | Orden recibida taller | Al crear orden | 👤 Cliente |
| 4 | Equipo listo | Estado → LISTO | 👤 Cliente |
| 5 | Confirmación abono | Al pagar crédito | 👤 Cliente |
| 6 | Recordatorio deuda | Configurable | 👤 Cliente |
| 7 | Bienvenida cliente | Al crear cliente | 👤 Cliente |
| 8 | Cotización por vencer | 2d antes, 10am | 👤 Cliente |
| 9 | Garantía por vencer | 7d antes, 10:30am | 👤 Cliente |
| 10 | Alerta stock bajo | Diario 8am | 🔑 Admin |
| 11 | Resumen cierre caja | Al cerrar sesión | 🔑 Admin |

### Jobs en APScheduler
```
09:00 VE → recordatorio deuda (configurable por tenant)
08:00 VE → alerta stock bajo
10:00 VE → cotización por vencer (2 días)
10:30 VE → garantía por vencer (7 días)
```

### Configuración por tenant (business_config)
```sql
-- Ver configuración WhatsApp de un tenant
SET search_path TO nombre_tenant;
SELECT key, value FROM business_config WHERE key LIKE 'whatsapp_%';
```

### Formato del número de teléfono
```
Venezuela:  584141234567  (58 + operador 414/424/412/416/426 + 7 dígitos)
Colombia:   573001234567
México:     521234567890
Regla:      código de país SIN el + + número completo SIN espacios
```

---

## 6. Feature Flags Premium {#flags}

### Activar desde el panel SaaS admin
Admin → Tenants → Seleccionar tenant → Features Premium → Activar flag

### Activar desde la BD (emergencia)
```sql
UPDATE public.tenants
SET feature_flags = feature_flags || '{"whatsapp_business": true}'::jsonb
WHERE schema_name = 'nombre_tenant';
```

### Agregar un flag nuevo al sistema
1. Agregar en `backend_api/feature_flags_registry.py`
2. Usar en backend: `tenant.feature_flags.get('flag_name')`
3. Usar en frontend: `useFeatureFlag('flag_name')`
4. Activar por tenant desde el panel admin

---

## 7. Ramas activas y roadmap {#roadmap}

### Estado de ramas
| Rama | Estado | Descripción |
|---|---|---|
| `main` | ✅ Producción | Código en prod |
| `feature/deploy-script` | ✅ Completado | Script deploy.sh automatizado |
| `feature/monitoring-alerts` | 🔄 Siguiente | Monitoreo y alertas |
| `feature/reports-excel-pdf` | ⏳ Pendiente | Exportar reportes |
| `feature/cicd-github-actions` | ⏳ Pendiente | CI/CD automático |
| `feature/onboarding-wizard` | 🔄 Siguiente | Onboarding guiado |
| `feature/catalogo-publico` | ⏳ Pendiente | Catálogo público |
| `feature/portal-cliente` | ⏳ Pendiente | Portal self-service |

### Metodología de trabajo
```
1. git checkout feature/nombre-rama
2. Implementar
3. Tests → Reporte
4. ✅ Aprobado → merge a main → deploy.sh
5. git checkout feature/siguiente-rama
```

---

## 8. Errores conocidos y soluciones {#errores}

### 504 Gateway Timeout en API después de deploy
**Causa:** Contenedor iniciado con red interna como primera red.
**Fix:**
```bash
VERSION=$(grep TAG /root/deploy/prod/.env | cut -d= -f2)
docker stop backend_prod_server && docker rm backend_prod_server
docker run -d --name backend_prod_server --network web_publica \
  --env-file /root/deploy/prod/.env \
  -v /root/deploy/prod/data/media:/app/media \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.backend-prod.rule=Host(\`api.miinventariofacil.com\`)" \
  --label "traefik.http.routers.backend-prod.entrypoints=websecure" \
  --label "traefik.http.routers.backend-prod.tls.certresolver=myresolver" \
  --label "traefik.http.services.backend-prod.loadbalancer.server.port=8000" \
  --label "traefik.docker.network=web_publica" \
  gamijoam/ferreteria-backend:$VERSION
sleep 5 && docker network connect prod_prod_internal backend_prod_server
```

### backend_api.models.prueba ModuleNotFoundError
**Causa:** Migración Alembic con import a módulo eliminado.
**Impacto:** Backend arranca en "modo desarrollo". No crítico.
**Fix pendiente:** Limpiar migración en rama `feature/fix-alembic`.

### WhatsApp QR no aparece
```bash
# Verificar servicio Baileys
curl http://172.18.0.18:3000/health
# Si no responde:
docker restart whatsapp_service
```

### search_path no persiste en SQLAlchemy (bug conocido)
**Causa:** SQLAlchemy connection pool puede cambiar conexión entre queries.
**Solución:** Usar SQL con schema explícito:
```python
db.execute(text(f'SELECT * FROM "{schema}".tabla WHERE key = :k'), {"k": key})
```
**NUNCA** depender del `SET search_path` para queries críticas.

---

## 9. Credenciales y accesos {#credenciales}

| Servicio | URL | Usuario | Notas |
|---|---|---|---|
| Panel Admin SaaS | https://admin.miinventariofacil.com | rodriguezisaac876@gmail.com | Admin principal |
| n8n | https://n8n.miinventariofacil.com | admin@miinventariofacil.com | Flujo WhatsApp dispatcher |
| DockerHub | hub.docker.com | gamijoam | Token en deploy |
| GitHub | github.com/gamijoam/inventario | gamijoam | Rama main = prod |
| VPS | 212.28.176.157 | root | SSH |

### Base de datos producción
```bash
docker exec db_prod_server psql -U postgres -d invensoft_prod
```

### Base de datos QA
```bash
docker exec db_qa_server psql -U postgres -d invensoft_qa
```

### Ver todos los tenants
```sql
SELECT schema_name, license_type, is_active, feature_flags
FROM public.tenants ORDER BY created_at DESC;
```

---

*Documento mantenido por el sistema de IA del proyecto. Última actualización automática en cada sesión de desarrollo.*

---

## 10. CI/CD y Deploy automático

Ver documento completo: `35_CICD_Telegram_GitHub.md`

### Flujo rápido
```
git push main → GitHub Actions → SSH VPS → build → DockerHub
                                                        ↓
                                              Telegram: [✅ Aprobar] [❌ Cancelar]
                                                        ↓ (presionas ✅)
                                              deploy-containers.sh → prod actualizado
```

### Archivos clave
| Archivo | Rol |
|---|---|
| `.github/workflows/deploy.yml` | Trigger: push a main → SSH al VPS |
| `/root/deploy/notify_build_ready.py` | Envía botones a Telegram |
| `/root/deploy/telegram-bot/webhook.py` | Bot Flask que recibe aprobaciones |
| `/root/deploy/deploy-containers.sh` | Recrea los 4 contenedores prod |
| `/root/deploy/monitor.conf` | TOKEN y CHAT_ID de Telegram |

### Verificación rápida
```bash
docker ps --filter "name=deploy_bot_server"
curl https://api.miinventariofacil.com/bot/health
python3 /root/deploy/notify_build_ready.py "test"
```
