# 20 - Migraciones SQL Pendientes

Este archivo centraliza todos los comandos SQL que deben ejecutarse manualmente en el VPS (QA y/o Producción) al momento de hacer deploy de nuevas imágenes Docker. Los cambios aquí listados NO están gestionados por Alembic y deben correrse manualmente.

> **Regla**: Cada vez que se agregue un cambio de esquema que requiera SQL manual, documentarlo aquí con su estado.

---

## Cómo ejecutar en el VPS

```bash
# Conectarse al VPS
sshpass -p 'GaboMac12' ssh root@212.28.176.157

# Ejecutar SQL en QA (todos los tenants)
docker exec db_qa_server psql -U postgres -d invensoft_qa -c "SQL_AQUI"

# Ejecutar SQL en PROD (todos los tenants)
docker exec db_prod_server psql -U postgres -d invensoft_prod -c "SQL_AQUI"
```

Para ejecutar en **todos los esquemas de tenant** usar el loop PL/pgSQL:
```sql
DO $$ DECLARE s TEXT; BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public','information_schema','pg_catalog','pg_toast')
  LOOP
    EXECUTE format('ALTER TABLE %I.tabla ADD COLUMN ...', s);
  END LOOP;
END $$;
```

---

## Migraciones

### [M001] Eliminación lógica de clientes — `is_active`
- **Fecha:** 2026-03-12
- **Rama:** feature/reports-center
- **Propósito:** Permite desactivar clientes sin eliminarlos, preservando integridad referencial con facturas y créditos.
- **QA:** ✅ Aplicado (2026-03-12)
- **PROD:** ❌ Pendiente

```sql
DO $$ DECLARE s TEXT; BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public','information_schema','pg_catalog','pg_toast')
  LOOP
    EXECUTE format('ALTER TABLE %I.customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE', s);
  END LOOP;
END $$;
```

---

### [M002] Índices de rendimiento en tabla `sales`
- **Fecha:** 2026-03-12
- **Rama:** feature/reports-center
- **Propósito:** Acelera consultas de créditos (CxC), filtrado por estado de pago y vencimiento. Reduce tiempo de carga del tab Créditos en el Centro de Reportes.
- **QA:** ✅ Aplicado (2026-03-12)
- **PROD:** ❌ Pendiente

```sql
DO $$ DECLARE s TEXT; BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public','information_schema','pg_catalog','pg_toast')
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_sales_is_credit ON %I.sales(is_credit) WHERE is_credit = true', replace(s,'-','_'), s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_sales_paid ON %I.sales(paid)', replace(s,'-','_'), s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_sales_due_date ON %I.sales(due_date) WHERE due_date IS NOT NULL', replace(s,'-','_'), s);
  END LOOP;
END $$;
```

---

### [M003] Módulo Farmacia — Nuevas columnas y tablas
- **Fecha:** 2026-03-12 (planificado)
- **Rama:** feature/pharmacy-module (pendiente)
- **Propósito:** Soporte para lotes con fecha de vencimiento, clasificación de medicamentos (OTC/Receta/Controlado), prescripciones y libro de control.
- **QA:** ⏳ Pendiente (ejecutar cuando se implemente Fase 1)
- **PROD:** ⏳ Pendiente

#### Paso 1: Flag de módulo en tabla pública
```sql
-- Ejecutar en esquema public (no requiere loop)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS has_pharmacy_module BOOLEAN NOT NULL DEFAULT FALSE;
```

#### Paso 2: Columnas en tabla `products` (todos los tenants)
```sql
DO $$ DECLARE s TEXT; BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public','information_schema','pg_catalog','pg_toast')
  LOOP
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS drug_classification VARCHAR(20) DEFAULT ''OTC''', s);
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS active_ingredient VARCHAR(200)', s);
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS storage_condition VARCHAR(20) DEFAULT ''AMBIENT''', s);
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS requires_prescription BOOLEAN DEFAULT FALSE', s);
  END LOOP;
END $$;
```

#### Paso 3: Tabla `product_lots` (todos los tenants)
```sql
DO $$ DECLARE s TEXT; BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public','information_schema','pg_catalog','pg_toast')
  LOOP
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.product_lots (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES %I.products(id) ON DELETE CASCADE,
        lot_number VARCHAR(100) NOT NULL,
        expiry_date DATE NOT NULL,
        quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
        received_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(20) DEFAULT ''ACTIVE'',
        supplier_id INTEGER REFERENCES %I.suppliers(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )', s, s, s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_lots_expiry ON %I.product_lots(expiry_date)', replace(s,'-','_'), s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_lots_product ON %I.product_lots(product_id)', replace(s,'-','_'), s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_lots_status ON %I.product_lots(status)', replace(s,'-','_'), s);
  END LOOP;
END $$;
```

#### Paso 4: Tabla `prescriptions` (todos los tenants)
```sql
DO $$ DECLARE s TEXT; BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public','information_schema','pg_catalog','pg_toast')
  LOOP
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.prescriptions (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER REFERENCES %I.sales(id) ON DELETE SET NULL,
        patient_name VARCHAR(200) NOT NULL,
        patient_cedula VARCHAR(20) NOT NULL,
        doctor_name VARCHAR(200) NOT NULL,
        doctor_mpps VARCHAR(50),
        prescription_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )', s, s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_prescriptions_cedula ON %I.prescriptions(patient_cedula)', replace(s,'-','_'), s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_prescriptions_sale ON %I.prescriptions(sale_id)', replace(s,'-','_'), s);
  END LOOP;
END $$;
```

---

## Resumen rápido

| ID | Descripción | QA | PROD | Cuándo ejecutar |
|----|-------------|:---:|:----:|-----------------|
| M001 | `customers.is_active` | ✅ | ❌ | Al subir imagen con soft-delete |
| M002 | Índices en `sales` | ✅ | ❌ | Al subir imagen con ReportsCenter |
| M003 | Módulo Farmacia completo | ⏳ | ⏳ | Al subir imagen con módulo farmacia |

---

> **Nota:** Después de ejecutar cada migración, actualizar este archivo marcando ✅ y la fecha.
