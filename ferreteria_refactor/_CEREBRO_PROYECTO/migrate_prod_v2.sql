-- Migracion PROD v2 — Mi Inventario Facil — 2026-04-02

-- 1. Onboarding en public.tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0;

UPDATE public.tenants
  SET onboarding_completed = true, onboarding_step = 3
  WHERE onboarding_completed = false OR onboarding_completed IS NULL;

-- 2. Columna featured en products (por cada tenant)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schema_name FROM public.tenants WHERE is_active = true LOOP
    EXECUTE 'ALTER TABLE "' || r.schema_name || '".products ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false';
  END LOOP;
END $$;

-- 3. Config catalogo en business_config (por cada tenant)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schema_name FROM public.tenants WHERE is_active = true LOOP
    EXECUTE 'INSERT INTO "' || r.schema_name || '".business_config (key,value) VALUES
      (''catalog_show_out_of_stock'',''false''),
      (''catalog_business_hours'',''''),
      (''catalog_whatsapp_cart'',''true'')
      ON CONFLICT DO NOTHING';
  END LOOP;
END $$;

SELECT 'OK — migracion completada' as resultado;
