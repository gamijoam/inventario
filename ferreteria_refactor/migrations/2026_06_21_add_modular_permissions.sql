-- Modular permissions and role profiles.
-- Safe to run multiple times. Existing role behavior is preserved by seeded profiles.

CREATE TABLE IF NOT EXISTS public.permissions (
    code VARCHAR(120) PRIMARY KEY,
    module VARCHAR(60) NOT NULL,
    resource VARCHAR(80) NOT NULL,
    action VARCHAR(60) NOT NULL,
    label VARCHAR(160) NOT NULL,
    description TEXT,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'basic',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT permissions_risk_level_check CHECK (risk_level IN ('basic', 'sensitive', 'critical'))
);

CREATE TABLE IF NOT EXISTS public.role_profiles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES public.tenants(id) ON DELETE CASCADE,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(140) NOT NULL,
    description TEXT,
    base_role VARCHAR(40),
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT role_profiles_base_role_check CHECK (
        base_role IS NULL OR base_role IN ('ADMIN', 'CASHIER', 'WAREHOUSE', 'WAITER', 'KITCHEN')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_profiles_tenant_code
    ON public.role_profiles(tenant_id, code)
    WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_profiles_global_code
    ON public.role_profiles(code)
    WHERE tenant_id IS NULL;

CREATE TABLE IF NOT EXISTS public.role_profile_permissions (
    role_profile_id INTEGER NOT NULL REFERENCES public.role_profiles(id) ON DELETE CASCADE,
    permission_code VARCHAR(120) NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
    allowed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_profile_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_role_profile_permissions_code
    ON public.role_profile_permissions(permission_code);

CREATE TABLE IF NOT EXISTS public.user_role_profiles (
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role_profile_id INTEGER NOT NULL REFERENCES public.role_profiles(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, tenant_id, role_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_user_role_profiles_user_tenant
    ON public.user_role_profiles(user_id, tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_profiles_primary
    ON public.user_role_profiles(user_id, tenant_id)
    WHERE is_primary = TRUE;

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    permission_code VARCHAR(120) NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
    effect VARCHAR(10) NOT NULL,
    reason TEXT,
    created_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT user_permission_overrides_effect_check CHECK (effect IN ('allow', 'deny'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_permission_overrides_scope
    ON public.user_permission_overrides(user_id, tenant_id, permission_code);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_tenant
    ON public.user_permission_overrides(user_id, tenant_id);

CREATE TABLE IF NOT EXISTS public.permission_audit_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES public.tenants(id) ON DELETE SET NULL,
    actor_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    target_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    role_profile_id INTEGER REFERENCES public.role_profiles(id) ON DELETE SET NULL,
    permission_code VARCHAR(120),
    action VARCHAR(80) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_log_tenant_created
    ON public.permission_audit_log(tenant_id, created_at DESC);

INSERT INTO public.permissions (code, module, resource, action, label, description, risk_level, sort_order)
VALUES
    ('dashboard.view', 'dashboard', 'summary', 'view', 'Ver dashboard', 'Permite ver el resumen ejecutivo del negocio.', 'basic', 10),
    ('dashboard.financials.view', 'dashboard', 'financials', 'view', 'Ver metricas financieras', 'Permite ver ingresos, ganancia y ticket promedio.', 'sensitive', 20),
    ('pos.access', 'pos', 'screen', 'access', 'Entrar al POS', 'Permite abrir el punto de venta.', 'basic', 100),
    ('pos.sell', 'pos', 'sales', 'create', 'Facturar ventas', 'Permite crear ventas desde el POS.', 'sensitive', 110),
    ('pos.discount.apply', 'pos', 'discounts', 'apply', 'Aplicar descuentos', 'Permite aplicar descuentos dentro del POS.', 'sensitive', 120),
    ('pos.discount.authorize', 'pos', 'discounts', 'authorize', 'Autorizar descuentos', 'Permite aprobar descuentos con PIN o autorizacion.', 'critical', 130),
    ('pos.price.override', 'pos', 'prices', 'override', 'Cambiar precio en venta', 'Permite modificar el precio de un producto durante la venta.', 'critical', 140),
    ('pos.reprint.ticket', 'pos', 'tickets', 'reprint', 'Reimprimir ticket', 'Permite reimprimir tickets de venta.', 'sensitive', 150),
    ('pos.reprint.warranty', 'pos', 'warranties', 'reprint', 'Reimprimir garantia', 'Permite reimprimir garantias PDF.', 'sensitive', 160),
    ('pos.void_sale', 'pos', 'sales', 'void', 'Anular venta', 'Permite anular o revertir ventas.', 'critical', 170),
    ('cash.view', 'cash', 'sessions', 'view', 'Ver caja', 'Permite ver la caja asignada y su estado.', 'basic', 200),
    ('cash.open', 'cash', 'sessions', 'open', 'Abrir caja', 'Permite abrir caja.', 'sensitive', 210),
    ('cash.close.blind', 'cash', 'sessions', 'close_blind', 'Cerrar caja ciega', 'Permite realizar cierre ciego.', 'sensitive', 220),
    ('cash.movements.create', 'cash', 'movements', 'create', 'Registrar movimientos de caja', 'Permite entradas, salidas y avances manuales.', 'sensitive', 230),
    ('cash.audit.view', 'cash', 'audit', 'view', 'Ver arqueo detallado', 'Permite ver informes detallados de arqueo.', 'critical', 240),
    ('cash.audit.pdf', 'cash', 'audit', 'pdf', 'Generar PDF de arqueo', 'Permite generar PDF de cierre/arqueo.', 'sensitive', 250),
    ('cash.force_close', 'cash', 'sessions', 'force_close', 'Forzar cierre de caja', 'Permite cerrar cajas de otros usuarios o resolver sesiones.', 'critical', 260),
    ('inventory.products.view', 'inventory', 'products', 'view', 'Ver productos', 'Permite ver el catalogo de productos.', 'basic', 300),
    ('inventory.products.create', 'inventory', 'products', 'create', 'Crear productos', 'Permite registrar productos.', 'sensitive', 310),
    ('inventory.products.edit', 'inventory', 'products', 'edit', 'Editar productos', 'Permite modificar productos.', 'sensitive', 320),
    ('inventory.products.delete', 'inventory', 'products', 'delete', 'Eliminar productos', 'Permite eliminar o desactivar productos.', 'critical', 330),
    ('inventory.stock.adjust', 'inventory', 'stock', 'adjust', 'Ajustar stock', 'Permite ajustes manuales de inventario.', 'critical', 340),
    ('inventory.serials.view', 'inventory', 'serials', 'view', 'Ver seriales/IMEI', 'Permite consultar seriales e IMEI.', 'basic', 350),
    ('inventory.serials.receive', 'inventory', 'serials', 'receive', 'Recibir seriales/IMEI', 'Permite registrar equipos serializados.', 'sensitive', 360),
    ('inventory.serials.delete', 'inventory', 'serials', 'delete', 'Eliminar seriales/IMEI', 'Permite eliminar o desactivar seriales.', 'critical', 370),
    ('inventory.kardex.view', 'inventory', 'kardex', 'view', 'Ver kardex', 'Permite consultar movimientos de inventario.', 'basic', 380),
    ('inventory.categories.manage', 'inventory', 'categories', 'manage', 'Gestionar categorias', 'Permite crear y editar categorias.', 'sensitive', 390),
    ('inventory.warehouses.manage', 'inventory', 'warehouses', 'manage', 'Gestionar almacenes', 'Permite crear y editar almacenes.', 'sensitive', 400),
    ('inventory.transfers.export', 'inventory', 'transfers', 'export', 'Exportar traslados', 'Permite generar archivos de traslado.', 'sensitive', 410),
    ('inventory.transfers.import', 'inventory', 'transfers', 'import', 'Importar traslados', 'Permite recibir archivos de traslado.', 'sensitive', 420),
    ('sales.quotes.view', 'sales', 'quotes', 'view', 'Ver cotizaciones', 'Permite ver cotizaciones.', 'basic', 500),
    ('sales.quotes.manage', 'sales', 'quotes', 'manage', 'Gestionar cotizaciones', 'Permite crear y editar cotizaciones.', 'sensitive', 510),
    ('sales.customers.manage', 'sales', 'customers', 'manage', 'Gestionar clientes', 'Permite crear y editar clientes.', 'sensitive', 520),
    ('sales.returns.create', 'sales', 'returns', 'create', 'Procesar devoluciones', 'Permite registrar devoluciones.', 'critical', 530),
    ('sales.returns.exchange', 'sales', 'returns', 'exchange', 'Procesar canjes', 'Permite cambiar productos en una devolucion.', 'critical', 540),
    ('sales.warranties.view', 'sales', 'warranties', 'view', 'Ver garantias', 'Permite consultar garantias.', 'basic', 550),
    ('sales.warranties.manage', 'sales', 'warranties', 'manage', 'Gestionar garantias', 'Permite crear o modificar garantias.', 'sensitive', 560),
    ('sales.credits.view', 'sales', 'credits', 'view', 'Ver cuentas por cobrar', 'Permite consultar creditos y CxC.', 'sensitive', 570),
    ('sales.credits.pay', 'sales', 'credits', 'pay', 'Registrar abonos CxC', 'Permite registrar pagos a cuentas por cobrar.', 'critical', 580),
    ('purchases.view', 'purchases', 'documents', 'view', 'Ver compras', 'Permite ver compras y proveedores.', 'basic', 600),
    ('purchases.create', 'purchases', 'documents', 'create', 'Crear compras', 'Permite registrar compras.', 'sensitive', 610),
    ('purchases.pay', 'purchases', 'payments', 'pay', 'Registrar pagos de compras', 'Permite pagar compras o abonar a proveedores.', 'critical', 620),
    ('purchases.suppliers.manage', 'purchases', 'suppliers', 'manage', 'Gestionar proveedores', 'Permite crear y editar proveedores.', 'sensitive', 630),
    ('reports.view', 'reports', 'general', 'view', 'Ver reportes', 'Permite entrar al centro de reportes.', 'sensitive', 700),
    ('reports.sales.view', 'reports', 'sales', 'view', 'Ver reportes de ventas', 'Permite consultar reportes de ventas.', 'sensitive', 710),
    ('reports.profit.view', 'reports', 'profit', 'view', 'Ver ganancias', 'Permite ver utilidad y rentabilidad.', 'critical', 720),
    ('reports.inventory.view', 'reports', 'inventory', 'view', 'Ver reportes de inventario', 'Permite consultar reportes de inventario.', 'sensitive', 730),
    ('reports.commissions.view', 'reports', 'commissions', 'view', 'Ver reportes de comisiones', 'Permite consultar comisiones.', 'sensitive', 740),
    ('config.business.manage', 'config', 'business', 'manage', 'Configurar negocio', 'Permite editar identidad y datos del negocio.', 'critical', 800),
    ('config.users.manage', 'config', 'users', 'manage', 'Gestionar usuarios', 'Permite crear, editar y desactivar usuarios.', 'critical', 810),
    ('config.permissions.manage', 'config', 'permissions', 'manage', 'Gestionar permisos', 'Permite administrar perfiles y permisos.', 'critical', 820),
    ('config.prices.manage', 'config', 'prices', 'manage', 'Configurar precios', 'Permite editar listas, margenes y politicas de precio.', 'critical', 830),
    ('config.payment_methods.manage', 'config', 'payment_methods', 'manage', 'Configurar metodos de pago', 'Permite editar metodos de pago.', 'critical', 840),
    ('config.printing.manage', 'config', 'printing', 'manage', 'Configurar impresion', 'Permite editar impresoras, plantillas y estaciones POS.', 'critical', 850),
    ('config.integrations.manage', 'config', 'integrations', 'manage', 'Configurar integraciones', 'Permite editar WhatsApp, catalogo publico e integraciones.', 'critical', 860),
    ('support.chat.use', 'support', 'chat', 'use', 'Usar chat de soporte', 'Permite abrir y responder conversaciones de soporte.', 'basic', 900),
    ('support.tickets.manage', 'support', 'tickets', 'manage', 'Gestionar tickets de soporte', 'Permite administrar solicitudes de soporte.', 'sensitive', 910),
    ('org.panel.view', 'organization', 'panel', 'view', 'Ver panel empresarial', 'Permite entrar al panel empresarial.', 'sensitive', 1000),
    ('org.tenants.manage', 'organization', 'tenants', 'manage', 'Gestionar empresas', 'Permite administrar empresas de la organizacion.', 'critical', 1010),
    ('org.members.manage', 'organization', 'members', 'manage', 'Gestionar miembros de organizacion', 'Permite invitar y editar miembros.', 'critical', 1020),
    ('org.chat.use', 'organization', 'chat', 'use', 'Usar chat de organizacion', 'Permite usar el chat entre empresas.', 'basic', 1030),
    ('restaurant.orders.manage', 'restaurant', 'orders', 'manage', 'Gestionar ordenes restaurante', 'Permite crear y gestionar ordenes.', 'sensitive', 1100),
    ('restaurant.kitchen.view', 'restaurant', 'kitchen', 'view', 'Ver cocina', 'Permite acceder a la pantalla de cocina.', 'basic', 1110),
    ('services.orders.manage', 'services', 'orders', 'manage', 'Gestionar servicios tecnicos', 'Permite crear y editar ordenes de servicio.', 'sensitive', 1200),
    ('services.technician.view', 'services', 'technician', 'view', 'Ver trabajos tecnicos', 'Permite consultar trabajos asignados.', 'basic', 1210)
ON CONFLICT (code) DO UPDATE SET
    module = EXCLUDED.module,
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    risk_level = EXCLUDED.risk_level,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE;

INSERT INTO public.role_profiles (tenant_id, code, name, description, base_role, is_system, is_active)
SELECT t.id, seed.code, seed.name, seed.description, seed.base_role, TRUE, TRUE
FROM public.tenants t
CROSS JOIN (VALUES
    ('ADMIN', 'Administrador total', 'Acceso completo al tenant.', 'ADMIN'),
    ('CASHIER', 'Cajero', 'Operacion POS y caja diaria.', 'CASHIER'),
    ('WAREHOUSE', 'Inventario / almacen', 'Gestion de inventario, compras y traslados.', 'WAREHOUSE'),
    ('WAITER', 'Mesero', 'Flujo de restaurante y ordenes.', 'WAITER'),
    ('KITCHEN', 'Cocina', 'Pantalla de cocina y preparacion.', 'KITCHEN')
) AS seed(code, name, description, base_role)
WHERE t.is_active = TRUE
ON CONFLICT (tenant_id, code) WHERE tenant_id IS NOT NULL DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    base_role = EXCLUDED.base_role,
    is_system = TRUE,
    is_active = TRUE,
    updated_at = NOW();

WITH role_permissions(role_code, permission_code) AS (
    SELECT 'ADMIN', code FROM public.permissions WHERE is_active = TRUE
    UNION ALL
    SELECT * FROM (VALUES
        ('CASHIER', 'pos.access'),
        ('CASHIER', 'pos.sell'),
        ('CASHIER', 'pos.reprint.ticket'),
        ('CASHIER', 'pos.reprint.warranty'),
        ('CASHIER', 'cash.view'),
        ('CASHIER', 'cash.open'),
        ('CASHIER', 'cash.close.blind'),
        ('CASHIER', 'cash.movements.create'),
        ('CASHIER', 'sales.customers.manage'),
        ('CASHIER', 'sales.quotes.view'),
        ('CASHIER', 'sales.credits.pay'),
        ('CASHIER', 'support.chat.use'),
        ('WAREHOUSE', 'dashboard.view'),
        ('WAREHOUSE', 'inventory.products.view'),
        ('WAREHOUSE', 'inventory.products.create'),
        ('WAREHOUSE', 'inventory.products.edit'),
        ('WAREHOUSE', 'inventory.stock.adjust'),
        ('WAREHOUSE', 'inventory.serials.view'),
        ('WAREHOUSE', 'inventory.serials.receive'),
        ('WAREHOUSE', 'inventory.kardex.view'),
        ('WAREHOUSE', 'inventory.categories.manage'),
        ('WAREHOUSE', 'inventory.warehouses.manage'),
        ('WAREHOUSE', 'inventory.transfers.export'),
        ('WAREHOUSE', 'inventory.transfers.import'),
        ('WAREHOUSE', 'purchases.view'),
        ('WAREHOUSE', 'purchases.create'),
        ('WAREHOUSE', 'purchases.suppliers.manage'),
        ('WAREHOUSE', 'reports.inventory.view'),
        ('WAREHOUSE', 'support.chat.use'),
        ('WAITER', 'pos.access'),
        ('WAITER', 'restaurant.orders.manage'),
        ('WAITER', 'sales.customers.manage'),
        ('WAITER', 'support.chat.use'),
        ('KITCHEN', 'restaurant.kitchen.view'),
        ('KITCHEN', 'support.chat.use')
    ) AS mapped(role_code, permission_code)
)
INSERT INTO public.role_profile_permissions (role_profile_id, permission_code, allowed)
SELECT rp.id, role_permissions.permission_code, TRUE
FROM public.role_profiles rp
JOIN role_permissions ON role_permissions.role_code = rp.code
ON CONFLICT (role_profile_id, permission_code) DO UPDATE SET allowed = TRUE;

INSERT INTO public.user_role_profiles (user_id, tenant_id, role_profile_id, is_primary)
SELECT u.id, u.tenant_id, rp.id, TRUE
FROM public.users u
JOIN public.role_profiles rp
  ON rp.tenant_id = u.tenant_id
 AND rp.code = u.role::text
WHERE u.tenant_id IS NOT NULL
  AND u.is_active = TRUE
ON CONFLICT (user_id, tenant_id, role_profile_id) DO UPDATE SET is_primary = TRUE;

