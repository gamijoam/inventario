"""
Registro central de feature flags por tenant.

Para agregar una nueva feature flag:
1. Agregar una entrada a REGISTRY con label, description y category.
2. En el frontend usar: useFeatureFlag('nombre_flag')
3. En el backend (si aplica): verificar tenant.feature_flags.get('nombre_flag')
4. Activar por tenant desde el panel SaaS Admin → Features Premium.
"""

REGISTRY: dict[str, dict] = {
    # Ejemplo de estructura — descomentar cuando se implemente la primera feature real
    # "descuento_especial": {
    #     "label": "Descuento especial por cliente",
    #     "description": "Permite asignar un % de descuento fijo a clientes VIP.",
    #     "category": "ventas",
    # },
}

CATEGORIES = ["ventas", "pos", "inventario", "reportes", "config", "otros"]
