from typing import List, Dict

# ============================================
# HELPER FUNCTIONS FOR COLUMN ALIGNMENT
# ============================================

def truncate_text(text: str, max_length: int) -> str:
    """Truncate text to max_length, adding ... if needed"""
    if len(text) <= max_length:
        return text
    return text[:max_length-3] + "..."

def pad_right(text: str, width: int) -> str:
    """Pad text to the right with spaces"""
    return text.ljust(width)

def pad_left(text: str, width: int) -> str:
    """Pad text to the left with spaces"""
    return text.rjust(width)

def format_money(amount: float, symbol: str = "$") -> str:
    """Format money with symbol"""
    return f"{symbol}{amount:.2f}"

SMART_FMT_MACRO = '{% macro m(v) %}{{ "%.4f"|format(v) if v|abs < 1 and v|abs > 0 else "%.2f"|format(v) }}{% endmacro %}'

# ============================================
# TICKET TEMPLATES (58mm = ~32 characters)
# ============================================

def get_classic_template() -> str:
    """
    Template optimized for 58mm thermal printers (32 chars width)
    Columns: CANT(3) | DESC(16) | TOTAL(9)
    """
    return SMART_FMT_MACRO + """================================
{{ business.name }}
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
================================
Fecha: {{ sale.date }}
Ticket: #{{ sale.id }}
Cliente: {{ sale.customer.name if sale.customer else "Consumidor Final" }}
{% if sale.customer and sale.customer.id_number %}
DOC: {{ sale.customer.id_number }}
{% endif %}
{% if sale.is_credit %}
*** A CREDITO ***
Vence: {{ sale.due_date }}
{% endif %}
================================
CNT DESCRIPCION      TOTAL
--------------------------------
{% for item in sale.products %}
{{ "%3.0f"|format(item.quantity) }} {{ item.product.name[:16].ljust(16) }} {{ currency_symbol }}{{ "%7s"|format(m(item.subtotal)) }}
{% if item.discount_percentage > 0 %}
    Desc {{ "%.0f"|format(item.discount_percentage) }}%
{% endif %}
{% endfor %}
================================
SUBTOTAL:       {{ currency_symbol }}{{ "%9s"|format(m(sale.total)) }}
{% if sale.discount > 0 %}
DESCUENTO:     -{{ currency_symbol }}{{ "%9s"|format(m(sale.discount)) }}
{% endif %}
TOTAL A PAGAR:  {{ currency_symbol }}{{ "%9s"|format(sale.total) }}
================================
PAGOS:
{% for p in sale.payments %}
{{ p.method[:20].ljust(20) }} {{ p.currency }}{{ "%7s"|format(m(p.amount)) }}
{% endfor %}
{% if sale.change_amount and sale.change_amount > 0 %}
--------------------------------
VUELTO:         {{ sale.change_currency }}{{ "%9s"|format(m(sale.change_amount)) }}
{% endif %}
================================
    Gracias por su compra
    
{{ business.warranty_text if business.warranty_text else "" }}
"""

def get_modern_template() -> str:
    """
    Modern template with clean alignment
    """
    return SMART_FMT_MACRO + """
       {{ business.name }}
   {{ business.address }}
----------------------------------
   TICKET DE VENTA #{{ sale.id }}
----------------------------------
{{ sale.date }}

CLIENTE: {{ sale.customer.name[:22] if sale.customer else "CLIENTE GENERAL" }}
{% if sale.customer and sale.customer.id_number %}
DOC: {{ sale.customer.id_number }}
{% endif %}

ITEMS
----------------------------------
{% for item in sale.products %}
{{ item.product.name[:30] }}
{{ "%3.0f"|format(item.quantity) }} x {{ currency_symbol }}{{ m(item.unit_price) }}{% if item.discount_percentage > 0 %} (-{{ "%.0f"|format(item.discount_percentage) }}%){% endif %}
                  TOTAL: {{ currency_symbol }}{{ m(item.subtotal) }}
{% endfor %}
----------------------------------
SUBTOTAL: {{ currency_symbol }}{{ m(sale.total) }}
{% if sale.discount > 0 %}
DESCUENTO: -{{ currency_symbol }}{{ m(sale.discount) }}
{% endif %}
TOTAL:    {{ currency_symbol }}{{ m(sale.total) }}
----------------------------------
{% for p in sale.payments %}
PAGO: {{ p.method[:12] }} {{ p.currency }}{{ m(p.amount) }}
{% endfor %}
{% if sale.change_amount and sale.change_amount > 0 %}
VUELTO: {{ sale.change_currency }}{{ m(sale.change_amount) }}
{% endif %}
----------------------------------
{% if sale.is_credit %}
*** CUENTA POR COBRAR ***
Saldo: {{ currency_symbol }}{{ m(sale.balance) }}
{% else %}
*** PAGADO ***
{% endif %}

{{ business.warranty_text if business.warranty_text else "" }}
      ¡VUELVA PRONTO!
"""

def get_detailed_template() -> str:
    """
    Detailed template with SKU codes
    """
    return SMART_FMT_MACRO + """================================
{{ business.name }}
{{ business.document_id }}
--------------------------------
Venta: #{{ sale.id }}
Fecha: {{ sale.date }}
Cliente: {{ sale.customer.name[:22] if sale.customer else "Consumidor Final" }}
{% if sale.customer and sale.customer.id_number %}
Doc: {{ sale.customer.id_number }}
{% endif %}
--------------------------------
CNT DESCRIPCION      TOTAL
--------------------------------
{% for item in sale.products %}
{{ "%3.0f"|format(item.quantity) }} {{ item.product.name[:16].ljust(16) }} {{ currency_symbol }}{{ "%7s"|format(m(item.subtotal)) }}
{% if item.product.sku %}
    SKU: {{ item.product.sku }}
{% endif %}
{% if item.quantity != 1.0 %}
    {{ currency_symbol }}{{ m(item.unit_price) }} c/u
{% endif %}
{% endfor %}
================================
SUBTOTAL: {{ currency_symbol }}{{ m(sale.total) }}
{% if sale.discount > 0 %}
DESCUENTO: -{{ currency_symbol }}{{ m(sale.discount) }}
{% endif %}
TOTAL: {{ currency_symbol }}{{ m(sale.total) }}
================================
PAGOS DETALLADOS:
{% for p in sale.payments %}
{{ p.method[:20].ljust(20) }} {{ p.currency }}{{ m(p.amount) }}
{% endfor %}
{% if sale.change_amount and sale.change_amount > 0 %}
VUELTO: {{ sale.change_currency }}{{ m(sale.change_amount) }}
{% endif %}
================================
{{ business.warranty_text if business.warranty_text else "" }}
"""

def get_minimal_template() -> str:
    """
    Minimal template to save paper
    """
    return SMART_FMT_MACRO + """{{ business.name }}
Ticket #{{ sale.id }}
{{ sale.date }}
Cli: {{ sale.customer.name[:22] if sale.customer else "Consumidor Final" }}
--------------------------------
{% for item in sale.products %}
{{ "%3.0f"|format(item.quantity) }} {{ item.product.name[:15].ljust(15) }} {{ currency_symbol }}{{ "%7s"|format(m(item.subtotal)) }}
{% endfor %}
--------------------------------
{% if sale.discount > 0 %}
Sub: {{ currency_symbol }}{{ m(sale.total + sale.discount) }}
Dsc: -{{ currency_symbol }}{{ m(sale.discount) }}
{% endif %}
TOTAL: {{ currency_symbol }}{{ m(sale.total) }}
--------------------------------
{% for p in sale.payments %}
{{ p.method[:15] }}: {{ p.currency }}{{ m(p.amount) }}
{% endfor %}
{% if sale.change_amount and sale.change_amount > 0 %}
Vuelto: {{ sale.change_currency }}{{ m(sale.change_amount) }}
{% endif %}
"""

def get_all_presets() -> List[Dict[str, str]]:
    return [
        {
            "id": "classic",
            "name": "Clásico",
            "description": "Formato estándar con columnas alineadas (58mm)",
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
            "description": "Incluye códigos SKU y detalles",
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
