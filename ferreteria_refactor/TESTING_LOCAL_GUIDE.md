# Guía de Prueba Local - Multi-Branch Alembic (Desde Cero)

## 🎯 Objetivo
Reiniciar completamente el sistema de migraciones y probar la arquitectura Multi-Branch en entorno local (sin Docker).

---

## 📋 Paso 1: Limpieza del Historial de Migraciones

### PowerShell (Windows)
```powershell
# Navega al directorio del proyecto
cd c:\Users\gamijoam\Documents\inventario\ferreteria_refactor

# Elimina todas las migraciones antiguas (excepto los READMEs)
Remove-Item -Path "alembic\versions\*.py" -Force
Remove-Item -Path "alembic\versions\__pycache__" -Recurse -Force -ErrorAction SilentlyContinue

# Verifica que shared/ y tenant/ estén vacíos (excepto README.md)
Get-ChildItem "alembic\versions\shared" -Exclude "README.md" | Remove-Item -Force
Get-ChildItem "alembic\versions\tenant" -Exclude "README.md" | Remove-Item -Force
```

### Bash (Linux/Mac)
```bash
# Navega al directorio del proyecto
cd ~/Documents/inventario/ferreteria_refactor

# Elimina todas las migraciones antiguas
rm -f alembic/versions/*.py
rm -rf alembic/versions/__pycache__

# Limpia shared/ y tenant/ (excepto README.md)
find alembic/versions/shared -type f ! -name "README.md" -delete
find alembic/versions/tenant -type f ! -name "README.md" -delete
```

---

## 🗄️ Paso 2: Reset de la Base de Datos

### Opción A: Recrear Base de Datos Completa (Recomendado)

Conecta a PostgreSQL con `psql` o DBeaver y ejecuta:

```sql
-- Desconectar todas las sesiones activas
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'ferreteria_db'
  AND pid <> pg_backend_pid();

-- Eliminar base de datos
DROP DATABASE IF EXISTS ferreteria_db;

-- Crear base de datos nueva
CREATE DATABASE ferreteria_db
  WITH OWNER = postgres
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8'
  TEMPLATE = template0;

-- Conectar a la nueva base de datos
\c ferreteria_db

-- Crear extensiones necesarias (si las usas)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### Opción B: Solo Limpiar Schemas (Más Rápido)

Si prefieres mantener la base de datos y solo limpiar los schemas:

```sql
-- Conectar a ferreteria_db
\c ferreteria_db

-- Eliminar schema public y recrearlo
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Eliminar todos los schemas de tenants (ajusta según tus tenants)
DROP SCHEMA IF EXISTS ferreteria CASCADE;
DROP SCHEMA IF EXISTS prueba9 CASCADE;
DROP SCHEMA IF EXISTS demo CASCADE;
```

---

## 🏗️ Paso 3: Generar Migraciones Iniciales

### 3.1 Migración Inicial de la Rama SHARED (Public Schema)

```powershell
# PowerShell
alembic revision --autogenerate -m "initial_shared_schema" -x branch=shared
```

```bash
# Bash
alembic revision --autogenerate -m "initial_shared_schema" -x branch=shared
```

**Salida esperada:**
```
🌍 [ALEMBIC] Running SHARED migrations (public schema)
✅ [ALEMBIC] Using version table: alembic_version_shared in schema: public
Generating alembic/versions/shared/xxxxx_initial_shared_schema.py ... done
```

**Verifica el archivo generado:**
- Debe estar en `alembic/versions/shared/`
- Debe contener `create_table('tenants', ...)` y `create_table('tenant_payments', ...)`

### 3.2 Migración Inicial de la Rama TENANT (Tenant Schemas)

**IMPORTANTE:** Necesitas un schema de tenant existente para que autogenerate funcione. Primero crea uno manualmente:

```sql
-- En DBeaver/psql, conectado a ferreteria_db
CREATE SCHEMA ferreteria;
```

Luego genera la migración:

```powershell
# PowerShell
alembic revision --autogenerate -m "initial_tenant_schema" -x branch=tenant -x tenant=ferreteria
```

```bash
# Bash
alembic revision --autogenerate -m "initial_tenant_schema" -x branch=tenant -x tenant=ferreteria
```

**Salida esperada:**
```
🏢 [ALEMBIC] Running TENANT migrations for schema: ferreteria
✅ [ALEMBIC] Using version table: alembic_version_tenant in schema: ferreteria
Generating alembic/versions/tenant/yyyyy_initial_tenant_schema.py ... done
```

**Verifica el archivo generado:**
- Debe estar en `alembic/versions/tenant/`
- Debe contener `create_table('products', ...)`, `create_table('sales', ...)`, etc.

---

## 🚀 Paso 4: Aplicar Migraciones con el Script Automático

### 4.1 Aplicar Solo Migraciones Compartidas (Primero)

```powershell
# PowerShell
python apply_migrations.py --shared-only
```

```bash
# Bash
python apply_migrations.py --shared-only
```

**Salida esperada:**
```
🚀 MULTI-TENANT MIGRATION DEPLOYMENT
📦 STEP 1: Applying SHARED Migrations (Public Schema)
  🔧 Upgrading public schema to latest shared migrations...
✅ Shared migrations completed successfully.
```

**Verifica en DBeaver:**
```sql
-- Debe existir la tabla de versiones compartidas
SELECT * FROM public.alembic_version_shared;

-- Deben existir las tablas compartidas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
-- Resultado esperado: tenants, tenant_payments, alembic_version_shared
```

### 4.2 Crear un Tenant de Prueba

Inserta un tenant en la tabla `public.tenants`:

```sql
-- Insertar tenant de prueba
INSERT INTO public.tenants (name, schema_name, domain, is_active, is_demo, subscription_expires_at)
VALUES ('Ferretería Demo', 'ferreteria', 'ferreteria.localhost', true, true, NOW() + INTERVAL '15 days');

-- Verificar
SELECT id, name, schema_name, is_active FROM public.tenants;
```

### 4.3 Aplicar Migraciones de Tenants

```powershell
# PowerShell - Aplicar a todos los tenants activos
python apply_migrations.py --tenant-only
```

```bash
# Bash
python apply_migrations.py --tenant-only
```

**Salida esperada:**
```
🏢 STEP 2: Applying TENANT Migrations
Fetching active tenants from database...
Found 1 active tenant(s): ferreteria

  → Migrating tenant: ferreteria
  🔧 Upgrading ferreteria schema...
  ✅ ferreteria migrated successfully

✅ ALL MIGRATIONS APPLIED SUCCESSFULLY
```

**Verifica en DBeaver:**
```sql
-- Debe existir la tabla de versiones del tenant
SELECT * FROM ferreteria.alembic_version_tenant;

-- Deben existir las tablas del tenant
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'ferreteria' 
ORDER BY table_name;
-- Resultado esperado: products, sales, customers, inventory, etc.
```

---

## 🧪 Paso 5: Prueba Completa (Agregar Nuevo Tenant)

### 5.1 Insertar Segundo Tenant

```sql
-- Crear schema manualmente (solo para la primera vez)
CREATE SCHEMA prueba9;

-- Insertar en la tabla tenants
INSERT INTO public.tenants (name, schema_name, domain, is_active, is_demo, subscription_expires_at)
VALUES ('Prueba 9', 'prueba9', 'prueba9.localhost', true, false, NOW() + INTERVAL '90 days');
```

### 5.2 Aplicar Migraciones al Nuevo Tenant

```powershell
# PowerShell - Solo al tenant específico
python apply_migrations.py --tenant prueba9
```

```bash
# Bash
python apply_migrations.py --tenant prueba9
```

**Salida esperada:**
```
🏢 STEP 2: Applying TENANT Migrations
Targeting specific tenant: prueba9

  → Migrating tenant: prueba9
  🔧 Upgrading prueba9 schema...
  ✅ prueba9 migrated successfully

✅ ALL MIGRATIONS APPLIED SUCCESSFULLY
```

### 5.3 Verificar Aislamiento de Versiones

```sql
-- Verificar que cada tenant tiene su propia tabla de versiones
SELECT 'public.alembic_version_shared' as table_name, version_num FROM public.alembic_version_shared
UNION ALL
SELECT 'ferreteria.alembic_version_tenant', version_num FROM ferreteria.alembic_version_tenant
UNION ALL
SELECT 'prueba9.alembic_version_tenant', version_num FROM prueba9.alembic_version_tenant;
```

**Resultado esperado:**
```
table_name                          | version_num
------------------------------------+-------------
public.alembic_version_shared       | xxxxx (shared migration ID)
ferreteria.alembic_version_tenant   | yyyyy (tenant migration ID)
prueba9.alembic_version_tenant      | yyyyy (mismo tenant migration ID)
```

---

## ✅ Verificación Final

### Checklist de Éxito

- [ ] Migraciones antiguas eliminadas
- [ ] Base de datos recreada (vacía)
- [ ] Migración `initial_shared_schema.py` generada en `alembic/versions/shared/`
- [ ] Migración `initial_tenant_schema.py` generada en `alembic/versions/tenant/`
- [ ] Tabla `public.alembic_version_shared` creada
- [ ] Tablas `public.tenants` y `public.tenant_payments` creadas
- [ ] Tenant `ferreteria` insertado en `public.tenants`
- [ ] Schema `ferreteria` tiene tabla `alembic_version_tenant`
- [ ] Schema `ferreteria` tiene todas las tablas de tenant (products, sales, etc.)
- [ ] Segundo tenant `prueba9` migrado exitosamente
- [ ] Cada tenant tiene su propia versión de migración aislada

---

## 🐛 Solución de Problemas

### Error: "Target database is not up to date"
**Causa:** Migraciones antiguas en la carpeta `versions/` raíz.  
**Solución:** Elimina todos los `.py` en `alembic/versions/` (excepto los de `shared/` y `tenant/`)

### Error: "Invalid branch"
**Causa:** Falta el argumento `-x branch=shared` o `-x branch=tenant`.  
**Solución:** Agrega el argumento correcto al comando.

### Error: "Tenant migrations require -x tenant=schema_name"
**Causa:** Intentaste generar/aplicar migración de tenant sin especificar el schema.  
**Solución:** Agrega `-x tenant=ferreteria` al comando.

### Error: "No such schema: ferreteria"
**Causa:** El schema no existe en la base de datos.  
**Solución:** Ejecuta `CREATE SCHEMA ferreteria;` antes de generar la migración.

---

## 📞 Comandos de Referencia Rápida

```bash
# Limpiar migraciones
rm -f alembic/versions/*.py

# Generar shared
alembic revision --autogenerate -m "initial_shared" -x branch=shared

# Generar tenant (requiere schema existente)
alembic revision --autogenerate -m "initial_tenant" -x branch=tenant -x tenant=ferreteria

# Aplicar todo
python apply_migrations.py

# Aplicar solo shared
python apply_migrations.py --shared-only

# Aplicar solo tenants
python apply_migrations.py --tenant-only

# Aplicar a tenant específico
python apply_migrations.py --tenant ferreteria
```
