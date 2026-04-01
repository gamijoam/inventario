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
    "sistema_comisiones": {
        "label": "Sistema de Comisiones Global",
        "description": "Habilita el panel de configuración de comisiones para vendedores y técnicos. Aplica a ventas POS y Taller con reglas por categoría.",
        "category": "ventas",
    },
    "impresion_factura_a4": {
        "label": "Impresión factura A4 (impresora normal)",
        "description": "Habilita botón 'Imprimir Factura' en A4/Carta al finalizar venta. Para clientes con impresora de hoja normal en lugar de térmica.",
        "category": "pos",
    },
}

REGISTRY["whatsapp_business"] = {
    "label": "WhatsApp Business 📱",
    "description": "Módulo premium de automatización WhatsApp. Envía tickets de venta, notificaciones de taller, cotizaciones en PDF y recordatorios de deuda automáticamente al cliente. Incluye editor de plantillas personalizables.",
    "category": "automatizacion",
}

CATEGORIES = ["ventas", "pos", "inventario", "reportes", "config", "automatizacion", "otros"]
