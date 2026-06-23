-- Catalogo empresarial: enlaces manuales entre productos equivalentes de distintos tenants.
-- No modifica SKU/barcode de productos; guarda un codigo interno de catalogo por organizacion.

CREATE TABLE IF NOT EXISTS public.organization_catalog_links (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    catalog_code    VARCHAR(100) NOT NULL,
    tenant_schema   VARCHAR(100) NOT NULL,
    product_id      INTEGER NOT NULL,
    is_master       BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_email VARCHAR(255),
    created_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_org_catalog_link_product UNIQUE (organization_id, tenant_schema, product_id),
    CONSTRAINT uq_org_catalog_link_tenant_code UNIQUE (organization_id, tenant_schema, catalog_code)
);

CREATE INDEX IF NOT EXISTS idx_org_catalog_links_org_code
    ON public.organization_catalog_links (organization_id, catalog_code);

CREATE INDEX IF NOT EXISTS idx_org_catalog_links_org_tenant
    ON public.organization_catalog_links (organization_id, tenant_schema);
