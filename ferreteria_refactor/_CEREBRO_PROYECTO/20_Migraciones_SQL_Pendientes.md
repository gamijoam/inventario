# 20 - Migraciones SQL Pendientes

Centraliza los comandos SQL que deben ejecutarse manualmente en el VPS al hacer deploy de nuevas imágenes. Los cambios aquí listados NO están gestionados por Alembic.

> **Regla**: Cada cambio de esquema se documenta aquí con su estado QA/PROD.

---

## Cómo ejecutar en el VPS

```bash
# SQL en QA
docker exec db_qa_server psql -U postgres -d invensoft_qa -c "SQL_AQUI"

# SQL en PROD
docker exec db_prod_server psql -U postgres -d invensoft_prod -c "SQL_AQUI"
```

Para todos los schemas de tenant:
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

## ⏳ PENDIENTE EN PROD — Sistema Multi-Empresa

**Script completo:** `_CEREBRO_PROYECTO/migrate_multi_empresa.sql`

**Debe aplicarse ANTES del deploy de `feature/multi-empresa` a prod.**

```sql
-- ══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN MULTI-EMPRESA — Aplicar en invensoft_prod ANTES del merge
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Tabla organizations (grupos empresariales)
CREATE TABLE IF NOT EXISTS public.organizations (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(200) NOT NULL,
    slug          VARCHAR(200) NOT NULL UNIQUE,
    owner_email   VARCHAR(200) NOT NULL,
    owner_name    VARCHAR(200),
    plan          VARCHAR(50)  NOT NULL DEFAULT 'multi',
    max_tenants   INTEGER      NOT NULL DEFAULT 5,
    is_active     BOOLEAN      NOT NULL DEFAULT true,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    logo_url      VARCHAR(500),
    primary_color VARCHAR(20)  NOT NULL DEFAULT '#4F46E5',
    -- Sprint 6
    use_shared_whatsapp BOOLEAN      DEFAULT false,
    whatsapp_instance   VARCHAR(100) DEFAULT NULL,
    plan_expires_at     TIMESTAMP    DEFAULT NULL,
    plan_price          NUMERIC(10,2) DEFAULT 0,
    plan_notes          TEXT         DEFAULT NULL
);

-- 2. Miembros de la organización (quién puede hacer switch entre empresas)
CREATE TABLE IF NOT EXISTS public.organization_users (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER     NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_email      VARCHAR(200) NOT NULL,
    role            VARCHAR(50)  NOT NULL DEFAULT 'manager',
    can_switch      BOOLEAN      NOT NULL DEFAULT true,
    invited_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    accepted_at     TIMESTAMP
);

-- 3. Catálogo compartido del grupo
CREATE TABLE IF NOT EXISTS public.shared_products (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER      NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name            VARCHAR(500) NOT NULL,
    sku             VARCHAR(200),
    description     TEXT,
    category_name   VARCHAR(200),
    cost_price      NUMERIC(12,4) DEFAULT 0,
    suggested_price NUMERIC(12,4) DEFAULT 0,
    image_url       VARCHAR(500),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, sku)
);

-- 4. Cabecera de transferencias de stock entre empresas
CREATE TABLE IF NOT EXISTS public.inter_company_transfers (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER     NOT NULL REFERENCES public.organizations(id),
    from_tenant_id  INTEGER     NOT NULL REFERENCES public.tenants(id),
    to_tenant_id    INTEGER     NOT NULL REFERENCES public.tenants(id),
    status          VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
    notes           TEXT,
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMP
);

-- 5. Ítems de cada transferencia
CREATE TABLE IF NOT EXISTS public.inter_company_transfer_items (
    id          SERIAL PRIMARY KEY,
    transfer_id INTEGER      NOT NULL REFERENCES public.inter_company_transfers(id) ON DELETE CASCADE,
    product_sku VARCHAR(200) NOT NULL,
    product_name VARCHAR(500) NOT NULL,
    quantity    NUMERIC(12,4) NOT NULL,
    unit_cost   NUMERIC(12,4) DEFAULT 0
);

-- 6. Columna organization_id en tenants
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS organization_id INTEGER
    REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_organization_id ON public.tenants(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_users_org_id ON public.organization_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_users_email ON public.organization_users(user_email);
```

**Estado:** QA ✅ | PROD ⏳

---

## ✅ APLICADA — Migración v2 (2026-03-xx)

Script: `migrate_prod_v2.sql`
- Columnas `onboarding_completed`/`onboarding_step` en `public.tenants`
- Columna `featured` en tablas de productos de todos los tenants
- Claves de config de catálogo en `business_config`
- Tenants existentes marcados como `onboarding_completed = true`

**Estado:** QA ✅ | PROD ✅

---

## ✅ APLICADA — Migración v3 herramientas (2026-03-xx)

Script: `migrate_prod_v3_herramientas.sql`
- Tablas del módulo de herramientas/equipos para ferretería
- Columnas de tracking de préstamo/mantenimiento

**Estado:** QA ✅ | PROD ✅

---

## ✅ APLICADA — is_archived en service_orders (2026-04-05)

```sql
-- Aplicada en todos los schemas QA y PROD vía loop
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_service_orders_archived ON service_orders(is_archived);
```

**Estado:** QA ✅ (16 schemas) | PROD ✅ (53 schemas)

---

## ✅ APLICADA — feature_flags en tenants (2026-03-31)

```sql
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}';
```

**Estado:** QA ✅ | PROD ✅

---

## ⏳ PENDIENTE EN PROD — Integración BloqueCelular + Crédito Celular

**Aplicar ANTES del merge de `feature/integracion-bloqueo` a PROD.**

```sql
DO $$ DECLARE s TEXT; BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public','information_schema','pg_catalog','pg_toast')
      AND schema_name NOT LIKE 'pg_%'
  LOOP
    -- Columnas BloqueCelular en sales
    EXECUTE format('ALTER TABLE %I.sales
      ADD COLUMN IF NOT EXISTS bloqueo_dispositivo_id    INTEGER,
      ADD COLUMN IF NOT EXISTS bloqueo_cliente_id        INTEGER,
      ADD COLUMN IF NOT EXISTS bloqueo_codigo_activacion VARCHAR(20),
      ADD COLUMN IF NOT EXISTS bloqueo_sincronizado      BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS bloqueo_estado            VARCHAR(20),
      ADD COLUMN IF NOT EXISTS bloqueo_error             TEXT,
      ADD COLUMN IF NOT EXISTS credit_down_payment       NUMERIC(18,4),
      ADD COLUMN IF NOT EXISTS credit_installments       INTEGER,
      ADD COLUMN IF NOT EXISTS credit_interest_rate      NUMERIC(8,4),
      ADD COLUMN IF NOT EXISTS credit_frequency          VARCHAR(20),
      ADD COLUMN IF NOT EXISTS credit_installment_amount NUMERIC(18,4)', s);
    -- Config BloqueCelular en business_config
    EXECUTE format('INSERT INTO %I.business_config (key,value) VALUES
      (''bloqueocelular_enabled'',   ''false''),
      (''bloqueocelular_url'',       ''http://backend_bloqueo_server:3000''),
      (''bloqueocelular_email'',     ''''),
      (''bloqueocelular_password'',  ''''),
      (''bloqueocelular_token'',     ''''),
      (''bloqueocelular_token_exp'', ''''),
      (''bloqueocelular_tenant_id'', '''')
      ON CONFLICT (key) DO NOTHING', s);
  END LOOP;
END $$;
```

**Estado:** QA ✅ (aplicado 2026-04-05) | PROD ⏳

---

## ✅ APLICADA — purchase_orders descuento (2026-04-05)

```sql
DO $$ DECLARE s TEXT; BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public','information_schema','pg_catalog','pg_toast')
      AND schema_name NOT LIKE 'pg_%'
  LOOP
    EXECUTE 'ALTER TABLE "' || s || '".purchase_orders
      ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,4) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_type   VARCHAR(20)   DEFAULT ''none'',
      ADD COLUMN IF NOT EXISTS discount_notes  TEXT          DEFAULT NULL';
  END LOOP;
END $$;
```

**Estado:** QA ✅ | PROD ✅ (53 schemas)


---

## ✅ APLICADAS — Sesión 2026-04-06/07 (todos los tenants activos)

### purchase_items — columnas de descuento por ítem
```sql
DO $$ DECLARE s TEXT; BEGIN
  FOR s IN SELECT schema_name FROM public.tenants WHERE is_active=true LOOP
    EXECUTE format('ALTER TABLE %I.purchase_items
      ADD COLUMN IF NOT EXISTS discount_pct    NUMERIC(10,4) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,4) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS subtotal        NUMERIC(18,4)', s);
  END LOOP;
END $$;
```
**Estado:** PROD ✅ (31 tenants activos)

### products — columna featured (catálogo público)
```sql
DO $$ DECLARE s TEXT; BEGIN
  FOR s IN SELECT schema_name FROM public.tenants WHERE is_active=true LOOP
    EXECUTE format('ALTER TABLE %I.products
      ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false', s);
  END LOOP;
END $$;
```
**Estado:** PROD ✅ (31 tenants activos)

### Schemas incompletos — demo300 y demo301
Tenants creados con solo 5/58 tablas. Tablas recreadas con:
```sql
CREATE TABLE IF NOT EXISTS demo300.{tabla} (LIKE oscardemo.{tabla} INCLUDING ALL);
```
**Estado:** PROD ✅ — demo300: 5→58 tablas | demo301: 5→58 tablas
