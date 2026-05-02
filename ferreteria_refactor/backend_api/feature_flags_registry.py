"""
Registro central de feature flags por tenant.

Para agregar una nueva feature flag:
1. Agregar una entrada a REGISTRY con label, description y category.
2. En el frontend usar: useFeatureFlag('nombre_flag')
3. En el backend (si aplica): verificar tenant.feature_flags.get('nombre_flag')
4. Activar por tenant desde el panel SaaS Admin → Features Premium.
"""

REGISTRY: dict[str, dict] = {
    "descuento_cliente_especial": {
        "label": "Descuento especial por cliente",
        "description": "Permite asignar un % de descuento fijo a clientes VIP directamente en su ficha.",
        "category": "ventas",
    },
    "exportar_excel_inventario": {
        "label": "Exportar inventario a Excel",
        "description": "Agrega botón de exportación Excel en el módulo de inventario.",
        "category": "reportes",
    },
    "precio_costo_visible_cajero": {
        "label": "Precio de costo visible para cajero",
        "description": "El cajero puede ver el precio de costo de los productos en el POS.",
        "category": "pos",
    },
    "precio_libre_pos": {
        "label": "Edición libre de precios en POS",
        "description": "Permite al cajero modificar el precio unitario de cualquier producto en el carrito y editar el total final, sin requerir autorización adicional.",
        "category": "pos",
    },
    "impresion_factura_a4": {
        "label": "Impresión factura A4 (impresora normal)",
        "description": "Habilita botón 'Imprimir Factura' en A4/Carta al finalizar venta. Para clientes con impresora de hoja normal en lugar de térmica.",
        "category": "pos",
    },
    "impresion_garantia_pdf": {
        "label": "Imprimir garantía PDF (equipos con IMEI)",
        "description": "Habilita botón 'Imprimir Garantía' al finalizar venta de equipos con serial/IMEI. Imprime el PDF de garantía personalizado del cliente con los datos de la venta inyectados.",
        "category": "pos",
    },
    "whatsapp_business": {
        "label": "WhatsApp Business 📱",
        "description": "Módulo premium de automatización WhatsApp. Envía tickets de venta, notificaciones de taller, cotizaciones en PDF y recordatorios de deuda automáticamente al cliente. Incluye editor de plantillas personalizables.",
        "category": "automatizacion",
    },
    "catalogo_publico": {
        "label": "Catálogo público de productos",
        "description": "Expone un catálogo de productos en línea accesible públicamente.",
        "category": "restaurant",
    },
}

REGISTRY["whatsapp_business"] = {
    "label": "WhatsApp Business 📱",
    "description": "Módulo premium de automatización WhatsApp. Envía tickets de venta, notificaciones de taller, cotizaciones en PDF y recordatorios de deuda automáticamente al cliente. Incluye editor de plantillas personalizables.",
    "category": "automatizacion",
}

REGISTRY["precio_margen_bruto"] = {
    "label": "Margen de ganancia bruto",
    "description": "Calcula precio de venta como: Costo / (1 - Margen%). Fórmula contable correcta basada en margen sobre venta, no sobre costo.",
    "category": "inventario",
}

CATEGORIES = ["ventas", "pos", "inventario", "reportes", "config", "automatizacion", "otros"]

REGISTRY["bloqueocelular_split_logic"] = {
    "label": "Lógica Venta Mixta (BloqueCelular) 🛡️",
    "description": "Separa bienes de crédito de accesorios al contado. El sistema prioriza el pago de accesorios con la inicial y envía a BloqueCelular solo la deuda neta de los equipos (con IMEI).",
    "category": "ventas",
}

REGISTRY["pos_multi_payment"] = {
    "label": "Pagos Múltiples en POS (Efectivo + Crédito) 💳",
    "description": "Permite al cajero dividir el cobro de una factura en múltiples métodos de pago (ej. Parte en Zelle, parte a Crédito).",
    "category": "ventas",
}
CATEGORIES = ["ventas", "pos", "inventario", "reportes", "config", "automatizacion", "restaurant", "otros"]

# ── Flags OscarCell / Celulares ──────────────────────────────────────────────
REGISTRY["precio_lista_en_inventario"] = {
    "label": "Lista de precios en inventario 💰",
    "description": "Muestra la primera lista de precios (ej. Precio Detal) junto al precio base en el catálogo de productos del inventario.",
    "category": "inventario",
}

REGISTRY["kardex_imei_mejorado"] = {
    "label": "Kardex mejorado con IMEI 📱",
    "description": "Muestra el IMEI de cada movimiento en el kardex, filtros por tipo, filas expandibles y detección automática de teléfonos serializados.",
    "category": "inventario",
}

REGISTRY["pdf_catalogo_seriales"] = {
    "label": "PDF Catálogo de equipos serializados 📄",
    "description": "Botón para generar PDF del catálogo de equipos con IMEI, mostrando precio detal, precio mayor y listas de precios asociadas.",
    "category": "inventario",
}

REGISTRY["pdf_inversion_seriales"] = {
    "label": "PDF Análisis de inversión en equipos 📊",
    "description": "Genera PDF con análisis financiero: capital invertido, venta potencial y ganancia estimada por equipo en stock.",
    "category": "reportes",
}

REGISTRY["creditos_externos"] = {
    "label": "Módulo Créditos Externos (Cashea/Krece) 🏦",
    "description": "Habilita el módulo para registrar y gestionar ventas financiadas por terceros como Cashea o Krece. Incluye botón en el POS y página de gestión independiente.",
    "category": "ventas",
}

REGISTRY["cajero_restringido_pos"] = {
    "label": "Restricciones de cajero en POS 🔒",
    "description": "Oculta al cajero: Movimientos de caja, Avance y Cerrar Caja en el POS. También oculta Devoluciones, Garantías y Créditos CxC en el Centro de Ventas.",
    "category": "pos",
}

REGISTRY["modulo_comisiones"] = {
    "label": "Módulo de Comisiones 💵",
    "description": "Habilita el sistema de comisiones para vendedores y cajeros. Permite configurar porcentajes por producto, usuario y categoría. Visible en Configuración → Comisiones.",
    "category": "ventas",
}
