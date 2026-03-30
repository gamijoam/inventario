# 27 — Sistema de Feature Flags por Tenant

> Permite activar/desactivar funcionalidades de forma individual por tenant desde el panel SaaS admin, sin deploy ni migración por cada nueva feature.

---

## Motivación

Clientes pueden solicitar funciones específicas que otros no necesitan (o no han pagado). Sin feature flags, la única opción era hacer visible la función para todos o hacer deploys separados. Con este sistema: el código existe en producción pero está **oculto por defecto** — se activa por tenant con un click desde el admin.

---

## Arquitectura

### Columna en BD

```sql
-- Tenant.feature_flags: JSONB, default {}
-- Una sola migración. Sin migraciones futuras por cada flag nueva.
{"descuento_especial": true, "reporte_avanzado": true}
```

### Registro central de flags (backend)

```python
# ferreteria_refactor/backend_api/feature_flags_registry.py
REGISTRY = {
    "flag_name": {
        "label": "Nombre visible en admin",
        "description": "Qué hace esta feature",
        "category": "ventas | reportes | pos | inventario | config"
    }
}
```

- Agregar una flag al registro la hace aparecer automáticamente en el panel admin
- No requiere cambios en la BD ni en el frontend de admin
- El flag existe en código → wrappear UI/lógica con el flag → agregar al registro → activar en admin

### Flujo de datos

```
BD (tenant.feature_flags JSONB)
  ↓
GET /config  →  { modules: {...}, feature_flags: {"flag": true} }
  ↓
ConfigContext.featureFlags
  ↓
useFeatureFlag('flag_name')  →  true / false
```

---

## Implementación Backend

### Modelo

```python
# models/models.py
class Tenant(Base):
    # ... columnas existentes ...
    feature_flags = Column(JSONB, nullable=False, server_default='{}')
```

### Endpoint de configuración (existente, extendido)

```python
# GET /config — ya lo consume el frontend tenant
{
  "modules": { "has_services_module": true, ... },
  "feature_flags": { "descuento_especial": true }   # NUEVO
}
```

### Endpoint admin

```
PATCH /admin/tenants/{tenant_id}/feature-flags
Authorization: Bearer <superuser_token>
Body: {"flag_name": true/false}

GET  /admin/feature-flags/registry
# Devuelve REGISTRY completo — el admin UI lo usa para mostrar toggles
```

---

## Implementación Frontend Tenant

### Hook

```javascript
// src/hooks/useFeatureFlag.js
import { useConfig } from '../context/ConfigContext';

export const useFeatureFlag = (flagName) => {
  const { featureFlags } = useConfig();
  return featureFlags?.[flagName] === true;
};
```

### Uso en componentes

```javascript
// Opción 1 — hook
const tieneDescuento = useFeatureFlag('descuento_especial');
if (!tieneDescuento) return null;

// Opción 2 — componente wrapper
<FeatureFlag flag="reporte_avanzado">
  <ReporteAvanzadoButton />
</FeatureFlag>
```

### ConfigContext

```javascript
// context/ConfigContext.jsx — agregar al estado
const [featureFlags, setFeatureFlags] = useState({});

// En loadConfig():
setFeatureFlags(data.feature_flags ?? {});
```

---

## Implementación Panel SaaS Admin

Sección nueva en `TenantDetails.tsx` — **Features Premium**:

```
┌──────────────────────────────────────────────┐
│  Features Premium                            │
├──────────────────────────────────────────────┤
│  [ventas]                                    │
│  Descuento especial por cliente   [ ON  ]    │
│                                              │
│  [reportes]                                  │
│  Reporte avanzado de ventas       [ OFF ] →  │
│  Exportación Excel                [ OFF ]    │
│                                              │
│  [pos]                                       │
│  Vista kanban servicios           [ OFF ]    │
└──────────────────────────────────────────────┘
```

- Toggles agrupados por `category` del registry
- Cada toggle hace `PATCH /admin/tenants/{id}/feature-flags`
- El registry se carga desde `GET /admin/feature-flags/registry`

---

## Instrucciones: Cómo crear una nueva feature flag

### Paso 1 — Agregar al registry

Abrir `ferreteria_refactor/backend_api/feature_flags_registry.py` y agregar:

```python
REGISTRY: dict[str, dict] = {
    # ... flags existentes ...

    "nombre_del_flag": {
        "label": "Texto visible en el panel admin",
        "description": "Qué hace esta feature cuando está activa.",
        "category": "ventas",  # ventas | pos | inventario | reportes | config | otros
    },
}
```

> El flag aparece automáticamente en el panel admin al guardar. Sin restart necesario si el backend está en modo dev; en prod hay que hacer deploy.

### Paso 2 — Usar en el frontend

```javascript
// En cualquier componente
import { useFeatureFlag } from '../hooks/useFeatureFlag';

const MiComponente = () => {
    const tieneFlag = useFeatureFlag('nombre_del_flag');

    if (!tieneFlag) return null;  // o mostrar versión básica

    return <FuncionalidadEspecial />;
};
```

Para envolver un bloque grande:

```javascript
// Componente wrapper (opcional — puedes crear uno si lo necesitas frecuentemente)
const tieneFlag = useFeatureFlag('nombre_del_flag');
{tieneFlag && <SeccionCompleta />}
```

### Paso 3 — Proteger en backend (si aplica)

Si el endpoint mismo debe verificar el flag (no solo la UI):

```python
# En el router correspondiente
from ..models.tenant import Tenant
from ..tenant_context import get_tenant_schema

@router.post("/mi-endpoint")
def mi_endpoint(db: Session = Depends(get_db), ...):
    tenant = db.query(Tenant).filter(
        Tenant.schema_name == get_tenant_schema()
    ).first()
    if not (tenant and tenant.feature_flags.get("nombre_del_flag")):
        raise HTTPException(403, "Feature no disponible para este tenant")
    # ... lógica normal
```

> No es necesario para todos los flags — solo si quieres protección a nivel API además de la UI.

### Paso 4 — Activar para el cliente

1. Ir al Panel SaaS Admin → Tenants → seleccionar el tenant
2. Tab "Vista General" → sección **Features Premium**
3. Activar el toggle del flag
4. El cliente ve la funcionalidad al instante (sin reload, sin deploy)

### Paso 5 — Agregar a la tabla de flags conocidos

Actualizar la tabla al final de este documento.

---

## Flags conocidos (actualizar esta tabla)

| Flag | Label | Categoría | Estado |
|------|-------|-----------|--------|
| `descuento_cliente_especial` | Descuento especial por cliente | ventas | Registro listo — UI pendiente |
| `exportar_excel_inventario` | Exportar inventario a Excel | reportes | Registro listo — UI pendiente |
| `precio_costo_visible_cajero` | Precio de costo visible para cajero | pos | Registro listo — UI pendiente |

---

## Lo que NO reemplaza

- `has_services_module`, `has_laundry_module`, etc. siguen siendo los flags de **módulos completos** (sidebar entero aparece/desaparece)
- Feature flags son para **funciones dentro de un módulo** ya habilitado, o features transversales pequeñas

---

## Ventajas clave

| | Sin flags | Con JSONB flags |
|--|-----------|-----------------|
| Nueva feature para un cliente | Visible para todos | Click en admin |
| Monetizar funciones premium | Imposible diferenciarlo | Trivial |
| Rollback de feature | Nuevo deploy | Click en admin |
| Migración por feature | Siempre | Una vez (la columna) |
| Ver qué tiene cada cliente | Manual | Vista en admin |
