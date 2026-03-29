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
}

CATEGORIES = ["ventas", "pos", "inventario", "reportes", "config", "otros"]
