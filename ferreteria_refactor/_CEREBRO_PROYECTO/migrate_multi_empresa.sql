-- ================================================================
-- MIGRACIÓN: Sistema Multi-Empresa
-- Rama: feature/multi-empresa
-- Aplicar PRIMERO en QA, luego en PROD
-- ================================================================

-- 1. Tabla de organizaciones (grupos empresariales)
CREATE TABLE IF NOT EXISTS public.organizations (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    owner_email     VARCHAR(255) NOT NULL,
    owner_name      VARCHAR(200),
    plan            VARCHAR(50)  DEFAULT 'multi',
    max_tenants     INT          DEFAULT 5,
    is_active       BOOLEAN      DEFAULT true,
    created_at      TIMESTAMP    DEFAULT NOW(),
    logo_url        TEXT,
    primary_color   VARCHAR(10)  DEFAULT '#4F46E5'
);

-- 2. Vincular tenants a organizaciones
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS organization_id INTEGER
    REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_tenants_org ON public.tenants(organization_id);

-- 3. Usuarios de organización (quién puede cambiar entre empresas)
CREATE TABLE IF NOT EXISTS public.organization_users (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER      NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_email      VARCHAR(255) NOT NULL,
    role            VARCHAR(50)  DEFAULT 'owner',
    can_switch      BOOLEAN      DEFAULT true,
    invited_at      TIMESTAMP    DEFAULT NOW(),
    accepted_at     TIMESTAMP,
    UNIQUE(organization_id, user_email)
);

-- 4. Catálogo compartido entre empresas del grupo
CREATE TABLE IF NOT EXISTS public.shared_products (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER      NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name            VARCHAR(300) NOT NULL,
    sku             VARCHAR(100),
    description     TEXT,
    cost_price      NUMERIC(14,4) DEFAULT 0,
    suggested_price NUMERIC(14,4) DEFAULT 0,
    category_name   VARCHAR(100),
    image_url       TEXT,
    is_active       BOOLEAN      DEFAULT true,
    created_at      TIMESTAMP    DEFAULT NOW(),
    UNIQUE(organization_id, sku)
);

-- 5. Transferencias de stock entre empresas del grupo
CREATE TABLE IF NOT EXISTS public.inter_company_transfers (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER      NOT NULL REFERENCES public.organizations(id),
    from_tenant_id  INTEGER      NOT NULL REFERENCES public.tenants(id),
    to_tenant_id    INTEGER      NOT NULL REFERENCES public.tenants(id),
    status          VARCHAR(50)  DEFAULT 'PENDING',
    notes           TEXT,
    created_by      INTEGER      REFERENCES public.users(id),
    created_at      TIMESTAMP    DEFAULT NOW(),
    completed_at    TIMESTAMP,
    CONSTRAINT chk_different_tenants CHECK (from_tenant_id <> to_tenant_id)
);

CREATE TABLE IF NOT EXISTS public.inter_company_transfer_items (
    id              SERIAL PRIMARY KEY,
    transfer_id     INTEGER      NOT NULL REFERENCES public.inter_company_transfers(id) ON DELETE CASCADE,
    product_sku     VARCHAR(100) NOT NULL,
    product_name    VARCHAR(300) NOT NULL,
    quantity        NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
    unit_cost       NUMERIC(14,4) DEFAULT 0
);

-- Verificación
SELECT
    'organizations'             AS tabla, COUNT(*) FROM public.organizations
UNION ALL SELECT
    'organization_users',                  COUNT(*) FROM public.organization_users
UNION ALL SELECT
    'shared_products',                     COUNT(*) FROM public.shared_products
UNION ALL SELECT
    'inter_company_transfers',             COUNT(*) FROM public.inter_company_transfers;
