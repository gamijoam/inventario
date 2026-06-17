-- Migration: add default_price_list_margin setting (45%) to business_config
-- Date: 2026-06-02
--
-- WHY
-- Replaces the hardcoded `useState(45)` in ProductForm.jsx and the
-- `margin_percent: 45` initial value in PreciosMasivosTab.jsx. The value
-- is now configurable from /#/config-center -> Configuracion Masiva.
--
-- TARGET
-- This DB is multi-tenant. Schemas present: restaurante, restaurante2,
-- restaurante3, cosaloca, colaloca2, public. The active QA tenant for
-- the user is `restaurante3` (URL: restaurante3.qa.miinventariofacil.com).
-- Replicate this INSERT for other tenants if they need the same default.
--
-- WHY A STANDALONE SQL (not alembic)
-- In this project, alembic only manages the `public` schema (see
-- alembic/env.py SHARED_TABLES and the include_object filter). Tenant
-- schemas are initialized by a separate process. So data migrations for
-- tenant tables are applied directly with a script like this one.
--
-- IDEMPOTENT
-- ON CONFLICT (key) DO NOTHING, so safe to re-run.

INSERT INTO business_config (key, value)
VALUES ('default_price_list_margin', '45')
ON CONFLICT (key) DO NOTHING;
