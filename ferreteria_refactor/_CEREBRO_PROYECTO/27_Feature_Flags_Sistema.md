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

## Convención para nuevas features

Al desarrollar cualquier función nueva que sea "a la carta" o "premium":

1. **Crear el flag** en `feature_flags_registry.py`
2. **Wrappearlo** en el frontend con `useFeatureFlag('nombre_flag')`
3. **Protegerlo** en backend si aplica (verificar en el endpoint)
4. **Documentarlo** aquí en la tabla de flags conocidos

### Flags conocidos (actualizar esta tabla)

| Flag | Label | Categoría | Primer cliente |
|------|-------|-----------|----------------|
| *(pendiente primera implementación)* | | | |

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
