# 18 — Sistema de Tests Automatizados

> Documentación completa del sistema de tests contra PostgreSQL real.
> **Creado:** 2026-03-19

---

## Índice

1. [Filosofía y arquitectura](#filosofia)
2. [Infraestructura: BD de test](#infraestructura)
3. [Cómo ejecutar los tests](#como-ejecutar)
4. [Estructura de archivos](#estructura)
5. [Fixtures disponibles](#fixtures)
6. [Catálogo de tests (45 tests)](#catalogo)
7. [Hallazgos en producción](#hallazgos)
8. [Cómo agregar nuevos tests](#agregar)

---

## 1. Filosofía y arquitectura {#filosofia}

### El problema que resuelve

El sistema detecta errores de integración que los tests unitarios no pueden ver: inconsistencias de datos en producción, bugs en transacciones, FK rotas, datos históricos corruptos. La pregunta que responde es: **"¿La BD está bien?"**

### Estrategia

- **Tests corren contra una BD PostgreSQL real** restaurada desde un backup de producción.
- **Cada test corre dentro de una transacción que se revierte al final** → la BD queda intacta después de cada test (aunque el test inserte o modifique datos).
- **Los tests son de solo lectura** en su mayoría — consultan datos reales, no los modifican.
- **Fallos son hallazgos reales**: si un test falla, es porque existe un problema en los datos de producción o en el código.

### Clasificación de fallos

| Tipo | Acción |
|------|--------|
| **Hard fail** | Problema grave: seguridad, corrupción, bug activo en código |
| **Warning (print)** | Dato histórico: existía antes del fix, no es accionable hoy |
| **Skip** | Feature no habilitada en ese tenant (tabla no existe) |

---

## 2. Infraestructura: BD de test {#infraestructura}

### Docker Compose

```bash
# Archivo: docker-compose.test.yml (en la raíz del proyecto)
# Levanta PostgreSQL 15 en puerto 5434

cd /home/gamijoam/Documentos/inventario
docker compose -f docker-compose.test.yml up -d
```

**Contenedor:** `invensoft_db_test`
**Puerto:** `5434` (el 5432 y 5433 son para dev/QA)
**BD:** `invensoft_test`
**Usuario:** `postgres` / `testpass123`

### Restaurar backup

```bash
# Backup guardado en: ferreteria_refactor/backup_20260319_181708.sql.gz
# Restaurar manualmente si se destruye el volumen:

docker exec -i invensoft_db_test psql -U postgres -c "DROP DATABASE IF EXISTS invensoft_test; CREATE DATABASE invensoft_test;"
gunzip -c ferreteria_refactor/backup_20260319_181708.sql.gz | docker exec -i invensoft_db_test psql -U postgres -d invensoft_test
```

**Contenido del backup** (backup de producción real, 2026-03-19):
- 21 schemas totales
- 5 tenants activos con datos reales: `lalicoreria`, `farmaciasanjose`, `emprendimientomaikergimenez`, `comercialasiatico`, `convertidoressanjuanelo`
- Más tenants demo/prueba: `prueba`, `prueba2020`, `novedades`, etc.

### Variable de entorno

```bash
# URL por defecto (ya está en conftest.py):
TEST_DATABASE_URL=postgresql://postgres:testpass123@localhost:5434/invensoft_test

# Para sobreescribir:
export TEST_DATABASE_URL=postgresql://otro_usuario:pass@otro_host:5432/otra_bd
```

---

## 3. Cómo ejecutar los tests {#como-ejecutar}

**Prerequisito:** tener el Docker de test corriendo (`docker compose -f docker-compose.test.yml up -d`).

```bash
# Directorio de trabajo siempre desde aquí:
cd /home/gamijoam/Documentos/inventario/ferreteria_refactor

# Correr TODAS las categorías:
python -m pytest backend_api/tests/test_cat1_caja_pg.py \
                  backend_api/tests/test_cat2_ventas_pg.py \
                  backend_api/tests/test_cat3_inventario_pg.py \
                  backend_api/tests/test_cat4_auth_pg.py \
                  backend_api/tests/test_cat5_tenants_pg.py \
                  -v --no-cov

# Correr una sola categoría:
python -m pytest backend_api/tests/test_cat1_caja_pg.py -v --no-cov

# Correr un test específico:
python -m pytest backend_api/tests/test_cat2_ventas_pg.py::TestIntegridadBasicaVentas::test_toda_venta_tiene_al_menos_un_detalle -v --no-cov

# Con salida detallada (ver los print/warnings):
python -m pytest backend_api/tests/test_cat4_auth_pg.py -v --no-cov -s

# Sin mostrar detalles de fallo (solo lista de passed/failed):
python -m pytest backend_api/tests/ -v --no-cov --tb=no
```

**Flags importantes:**
- `--no-cov`: deshabilita coverage (más rápido, no necesario aquí)
- `-s`: muestra los `print()` dentro de los tests (útil para ver warnings)
- `-v`: muestra el nombre de cada test
- `--tb=short` o `--tb=line`: resumen corto del error en caso de fallo

---

## 4. Estructura de archivos {#estructura}

```
ferreteria_refactor/
├── docker-compose.test.yml          ← Infraestructura PostgreSQL de test
├── backend_api/
│   └── tests/
│       ├── conftest.py              ← Fixtures compartidas (pg_engine, pg_db, etc.)
│       ├── conftest_pg.py           ← Constantes auxiliares (TENANT_SCHEMAS, etc.)
│       ├── test_critical_pg.py      ← 15 tests generales (legacy, superset de cat1-5)
│       ├── test_cat1_caja_pg.py     ← Cat 1: Caja (9 tests)
│       ├── test_cat2_ventas_pg.py   ← Cat 2: Ventas (11 tests)
│       ├── test_cat3_inventario_pg.py ← Cat 3: Inventario (9 tests)
│       ├── test_cat4_auth_pg.py     ← Cat 4: Auth/Seguridad (8 tests)
│       └── test_cat5_tenants_pg.py  ← Cat 5: Tenants (8 tests)
```

---

## 5. Fixtures disponibles {#fixtures}

Definidas en `backend_api/tests/conftest.py`. Se inyectan automáticamente por pytest — no se importan.

### `pg_engine` (scope=session)
Engine SQLAlchemy conectado a la BD de test. Una sola instancia por sesión de pytest. Usar para tests que solo necesitan ejecutar SQL raw.

```python
def test_algo(self, pg_engine):
    with pg_engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM public.tenants")).scalar()
```

### `pg_db` (scope=function)
Sesión SQLAlchemy con `search_path` al tenant por defecto (`farmaciasanjose`). Corre en transacción que se revierte al final. Usar cuando se necesita acceso ORM a un tenant específico.

```python
def test_algo(self, pg_db):
    from backend_api.models.models import Sale
    count = pg_db.query(Sale).count()
```

### `pg_db_for_schema` (scope=function)
Factory fixture que crea sesiones para cualquier schema. Útil para tests de aislamiento multi-tenant. Todas las transacciones se revierten al final.

```python
def test_aislamiento(self, pg_db_for_schema):
    session_a = pg_db_for_schema("lalicoreria")
    session_b = pg_db_for_schema("farmaciasanjose")

    ventas_a = session_a.query(Sale).count()
    ventas_b = session_b.query(Sale).count()
    assert ventas_a != ventas_b
```

---

## 6. Catálogo de tests {#catalogo}

### Categoría 1 — Caja (`test_cat1_caja_pg.py`) — 8/9 pasan

| # | Test | Estado | Hallazgo |
|---|------|--------|---------|
| 1 | Constraint único previene dos sesiones OPEN | ✅ | lalicoreria tiene el índice `uq_*` |
| 2 | No puede haber dos sesiones OPEN en mismo registro | ✅ | — |
| 3 | Cerrar caja sin ventas: expected == initial | ✅ | — |
| 4 | Sesiones CLOSED tienen end_time y expected | ⚠️ FALLA | 7 tenants con sesiones históricas (pre-multicaja) sin `final_cash_expected`. Solo falla si hay sesiones *recientes* (últimos 30 días) |
| 5 | Diferencia caja = reported - expected | ✅ | — |
| 6 | Depósitos suman al expected | ✅ | — |
| 7 | Monedas de sesión cubren las usadas en ventas | ✅ | — |
| 8 | cash_session_currencies sin valores negativos | ✅ | — |
| 9 | Movimientos de caja no son huérfanos | ✅ | — |

### Categoría 2 — Ventas (`test_cat2_ventas_pg.py`) — 7/11 pasan

| # | Test | Estado | Hallazgo |
|---|------|--------|---------|
| 10 | Toda venta tiene al menos un SaleDetail | ❌ FALLA | `emprendimientomaikergimenez`: 9 ventas sin detalle (inserción parcial) |
| 11 | Total venta == suma de detalles | ❌ FALLA | 3 tenants: conversión de moneda aplicada en total pero no en subtotales |
| 12 | UUID único por venta | ✅ | — |
| 13 | total_amount siempre positivo | ✅ | — |
| 14 | Créditos activos tienen balance_pending > 0 | ✅ | — |
| 15 | Ventas pagadas tienen balance cero | ✅ | — |
| 16 | Kardex tiene movimiento SALE por cada venta | ✅ (warning) | 5 tenants con ventas sin Kardex correspondiente (imprime warning) |
| 17 | Kardex balance_after no negativo | ✅ | — |
| 18 | Ventas con cambio tienen currency definida | ✅ | — |
| 19 | Pagos de venta suman al total | ❌ FALLA | 4 tenants: ventas `paid=TRUE` sin `sale_payments` (tabla creada después de las ventas) |
| 20 | Ventas sin pagos son crédito | ❌ FALLA | Mismo origen que test 19 |

### Categoría 3 — Inventario (`test_cat3_inventario_pg.py`) — 9/9 pasan

| # | Test | Estado | Hallazgo |
|---|------|--------|---------|
| 21 | Stock global no < -10 | ✅ (warning) | — |
| 22 | product_stocks por bodega no negativo | ✅ | — |
| 23 | Productos físicos tienen registro en bodega | ✅ (warning) | 6 tenants con productos sin `product_stocks` (migración multi-bodega pendiente) |
| 24 | Kardex suma consistente con stock | ✅ (warning) | 5 tenants con desfase > 5u entre Kardex y stock |
| 25 | Kardex no tiene movimientos huérfanos | ✅ | — |
| 26 | Transferencias COMPLETED tienen detalles | ✅ | — |
| 27 | Transferencia origen ≠ destino | ✅ | — |
| 28 | No hay IMEI duplicado en AVAILABLE | ✅ | — |
| 29 | product_instances solo para has_imei=TRUE | ✅ | — |

### Categoría 4 — Auth/Seguridad (`test_cat4_auth_pg.py`) — 7/8 pasan

| # | Test | Estado | Hallazgo |
|---|------|--------|---------|
| 30 | No hay usuarios activos sin password_hash | ✅ | — |
| 31 | Hashes tienen formato bcrypt ($2b$/$2a$) | ✅ | — |
| 32 | No hay email duplicado en usuarios | ✅ | — |
| 33 | Usuarios de tenant tienen tenant_id válido | ✅ | — |
| 34 | Superusers no tienen tenant_id | ✅ (warning) | 6 admins de tenant con `is_superuser=TRUE` por error de diseño |
| 35 | Todo tenant tiene al menos un ADMIN activo | ✅ | — |
| 36 | PINs configurados tienen formato bcrypt | ❌ FALLA | **6 usuarios con PIN en texto plano** (ver sección Hallazgos) |
| 37 | DEBUG_BYPASS_TOKEN no existe en código | ✅ | **CORREGIDO** en esta sesión (removido de websocket.py) |

### Categoría 5 — Tenants (`test_cat5_tenants_pg.py`) — 8/8 pasan

| # | Test | Estado | Hallazgo |
|---|------|--------|---------|
| 38 | Todo tenant tiene schema PostgreSQL | ✅ | — |
| 39 | Todo tenant tiene ADMIN activo | ✅ | — |
| 40 | Todo tenant tiene almacén activo | ✅ | — |
| 41 | Todo tenant tiene caja registradora activa | ✅ | — |
| 42 | Todo tenant tiene métodos de pago (≥3) | ✅ | — |
| 43 | schema_name válido y no reservado | ✅ | — |
| 44 | Tenants reales tienen ≥2 monedas activas | ✅ | — |
| 45 | No hay schema_name duplicados | ✅ | — |

**Total: 39/45 tests pasan. Los 6 fallos representan problemas reales en datos de producción.**

---

## 7. Hallazgos en producción {#hallazgos}

### 🔴 CRÍTICO — PINs en texto plano (Test 36)

Ver [sección PINs en texto plano](#pins-planos) en `08_Seguridad_y_Auditoria.md` para el análisis completo.

**Resumen:** 6 usuarios tienen el campo `pin` almacenado como texto plano (4-5 caracteres) en lugar de un hash bcrypt (~60 caracteres). Esto significa:
1. El PIN es legible directamente en la BD
2. El endpoint `/auth/validate-pin` falla para estos usuarios porque `passlib.verify()` no puede verificar texto plano contra un hash bcrypt
3. Requiere una migración urgente

**Usuarios afectados:** `comercialasiatico@gmail.com`, `maikergimenez@gmail.com`, `maikergimenez1986@gmail.com`, `lavanderialecheria@gmail.com`, `parramartinezj16@gmail.com`, `rodriguezisaac876@gmail.com` (superadmin)

**Migración necesaria:** Ver `20_Migraciones_SQL_Pendientes.md` → "Migración: Re-hashear PINs en texto plano".

### 🔴 CORREGIDO — DEBUG_BYPASS_TOKEN en WebSocket (Test 37)

`websocket.py` línea 63 tenía:
```python
if token == "DEBUG_BYPASS_TOKEN_xyz":
    email = db.query(User).first().email  # impersonaba al primer usuario
```

**Impacto:** Cualquier persona con acceso al WebSocket podía conectarse sin JWT usando ese string literal, obteniendo permisos del primer usuario de la BD (generalmente el admin).

**Fix aplicado:** Removido en commit `4b6b93a` (2026-03-19).

### 🟡 DATO HISTÓRICO — Ventas sin sale_payments (Tests 19-20)

4 tenants (`emprendimientomaikergimenez`, `comercialasiatico`, `prueba`, `convertidoressanjuanelo`) tienen ventas `is_credit=FALSE` sin ningún registro en `sale_payments`. Esto ocurrió porque la tabla `sale_payments` fue creada después de que esos tenants ya tenían ventas. Las ventas son reales pero no tienen el registro de pago.

**No hay acción urgente:** Las ventas ya se cobraron, el dinero está. El problema es de trazabilidad histórica.

### 🟡 DATO HISTÓRICO — Sesiones de caja sin end_time (Test 4)

7 tenants tienen sesiones `CLOSED` sin `final_cash_expected`. Son sesiones cerradas antes de que se implementara la funcionalidad de balance esperado (versión pre-multicaja).

---

## 8. Cómo agregar nuevos tests {#agregar}

### Estructura básica de un test

```python
# Archivo: backend_api/tests/test_catX_nombre_pg.py

from sqlalchemy import text

class TestNombreGrupo:
    """Descripción del grupo."""

    def test_algo_especifico(self, pg_engine):
        """
        Test N: Descripción de qué verifica y por qué es importante.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            problemas = []
            for (schema,) in tenants:
                try:
                    count = conn.execute(text(f"""
                        SELECT COUNT(*) FROM "{schema}".tabla
                        WHERE condicion_de_problema = TRUE
                    """)).scalar()
                    if count > 0:
                        problemas.append(f"{schema}: {count} registros con problema")
                except Exception:
                    pass  # tenant no tiene esta tabla — skip silencioso

            assert problemas == [], \
                f"Descripción del problema encontrado: {problemas}"
```

### Patrones recomendados

- **Iterar todos los tenants**: Siempre consultar `public.tenants WHERE is_active = TRUE` y loopar — no harcodear un schema.
- **`try/except` silencioso**: Para tablas que pueden no existir en todos los tenants (feature flags).
- **Tolerancia numérica**: Para comparaciones de Decimal usar `ABS(a - b) > 0.10`.
- **Warning vs hard fail**: Si el problema es dato histórico, usar `print()` + dejar pasar. Si es bug activo en código nuevo, hacer `assert`.
- **`LIMIT N` en queries**: Siempre limitar los resultados para no saturar el mensaje de error.
