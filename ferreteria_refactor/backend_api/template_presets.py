from typing import List, Dict

def get_classic_template() -> str:
    return """=== TICKET DE VENTA ===
{{ business.name }}
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
================================
Fecha: {{ sale.date }}
Factura: #{{ sale.id }}
Cliente: {{ sale.customer.name if sale.customer else "Consumidor Final" }}
DOC: {{ sale.customer.id_number if sale.customer else "" }}
{% if sale.is_credit %}
CONDICION: A CREDITO
Vence: {{ sale.due_date }}
{% endif %}
================================
CANT   PRODUCTO         TOTAL
--------------------------------
{% for item in sale.products %}
{{ "%.0f"|format(item.quantity) }} x {{ item.product.name }}
{% if item.discount_percentage > 0 %}
       {{ currency_symbol }}{{ "%.2f"|format(item.unit_price) }} -{{ "%.0f"|format(item.discount_percentage) }}% = {{ currency_symbol }}{{ "%.2f"|format(item.subtotal) }}
{% elif item.quantity == 1.0 %}
       {{ currency_symbol }}{{ "%.2f"|format(item.subtotal) }}
{% else %}
       {{ currency_symbol }}{{ "%.2f"|format(item.unit_price) }} c/u  =  {{ currency_symbol }}{{ "%.2f"|format(item.subtotal) }}
{% endif %}
{% endfor %}
================================
SUBTOTAL:       {{ currency_symbol }}{{ "%.2f"|format(sale.total) }}
{% if sale.discount > 0 %}
DESCUENTO:     -{{ currency_symbol }}{{ "%.2f"|format(sale.discount) }}
{% endif %}
TOTAL A PAGAR:  {{ currency_symbol }}{{ "%.2f"|format(sale.total) }}
================================
PAGOS:
{% for p in sale.payments %}
- {{ p.method }}: {{ p.currency }}{{ "%.2f"|format(p.amount) }}
{% endfor %}
================================
      Gracias por su compra
"""

def get_modern_template() -> str:
    return """
           {{ business.name }}
   {{ business.address }}
----------------------------------
       TICKET DE VENTA #{{ sale.id }}
----------------------------------
{{ sale.date }}

CLIENTE: {{ sale.customer.name if sale.customer else "CLIENTE GENERAL" }}
DOC: {{ sale.customer.id_number if sale.customer else "" }}

ITEMS
----------------------------------
{% for item in sale.products %}
* {{ item.product.name }}
{% if item.discount_percentage > 0 %}
   {{ "%.0f"|format(item.quantity) }} x {{ currency_symbol }}{{ "%.2f"|format(item.unit_price) }} (-{{ "%.0f"|format(item.discount_percentage) }}%)
   TOTAL: {{ currency_symbol }}{{ "%.2f"|format(item.subtotal) }}
{% elif item.quantity == 1.0 %}
   TOTAL: {{ currency_symbol }}{{ "%.2f"|format(item.subtotal) }}
{% else %}
   {{ "%.0f"|format(item.quantity) }} x {{ currency_symbol }}{{ "%.2f"|format(item.unit_price) }}
   TOTAL: {{ currency_symbol }}{{ "%.2f"|format(item.subtotal) }}
{% endif %}
{% endfor %}
----------------------------------
TOTAL ......... {{ currency_symbol }}{{ "%.2f"|format(sale.total) }}
----------------------------------
{% for p in sale.payments %}
PAGO: {{ p.method }} {{ p.currency }}{{ "%.2f"|format(p.amount) }}
{% endfor %}
----------------------------------
{% if sale.is_credit %}
*** CUENTA POR COBRAR ***
Saldo Pendiente: {{ currency_symbol }}{{ "%.2f"|format(sale.balance) }}
{% else %}
*** PAGADO ***
{% endif %}

      ¡VUELVA PRONTO!
"""

def get_detailed_template() -> str:
    return """================================
{{ business.name }}
{{ business.document_id }}
--------------------------------
Venta: #{{ sale.id }}
Fecha: {{ sale.date }}
Cliente: {{ sale.customer.name if sale.customer else "Consumidor Final" }}
Doc: {{ sale.customer.id_number if sale.customer else "" }}
--------------------------------
{% for item in sale.products %}
[{{ item.product.sku }}] {{ item.product.name }}
{% if item.quantity == 1.0 %}
   Precio: {{ currency_symbol }}{{ "%.2f"|format(item.subtotal) }}
{% else %}
   Cant: {{ "%.0f"|format(item.quantity) }} x {{ currency_symbol }}{{ "%.2f"|format(item.unit_price) }}
   Subtotal: {{ currency_symbol }}{{ "%.2f"|format(item.subtotal) }}
{% endif %}
- - - - - - - - - - - - - - - -
{% endfor %}
================================
================================
TOTAL: {{ currency_symbol }}{{ "%.2f"|format(sale.total) }}
================================
PAGOS DETALLADOS:
{% for p in sale.payments %}
* {{ p.method }}: {{ p.currency }} {{ "%.2f"|format(p.amount) }}
{% endfor %}
================================
"""

def get_minimal_template() -> str:
    return """{{ business.name }}
Ticket #{{ sale.id }}
{{ sale.date }}
Cli: {{ sale.customer.name if sale.customer else "Consumidor Final" }}
{{ sale.customer.id_number if sale.customer else "" }}
--------------------------------
{% for item in sale.products %}
{{ "%.0f"|format(item.quantity) }} {{ item.product.name[:15] }} {{ currency_symbol }}{{ "%.2f"|format(item.subtotal) }}
{% endfor %}
--------------------------------
TOTAL: {{ currency_symbol }}{{ "%.2f"|format(sale.total) }}
--------------------------------
{% for p in sale.payments %}
{{ p.method }}: {{ p.currency }}{{ "%.2f"|format(p.amount) }}
{% endfor %}
"""

def get_all_presets() -> List[Dict[str, str]]:
    return [
        {
            "id": "classic",
            "name": "Clásico",
            "description": "Formato estándar balanceado",
            "template": get_classic_template()
        },
        {
            "id": "modern",
            "name": "Moderno", 
            "description": "Diseño limpio y centrado",
            "template": get_modern_template()
        },
        {
            "id": "detailed",
            "name": "Detallado",
            "description": "Incluye códigos y detalles línea por línea",
            "template": get_detailed_template()
        },
        {
            "id": "minimal",
            "name": "Minimalista",
            "description": "Ahorra papel, solo información esencial",
            "template": get_minimal_template()
        }
    ]

def get_preset_by_id(preset_id: str) -> Dict[str, str]:
    presets = get_all_presets()
    for p in presets:
        if p["id"] == preset_id:
            return p
    return None
