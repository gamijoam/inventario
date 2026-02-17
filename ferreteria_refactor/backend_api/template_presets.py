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

# Scriban Compatibility Note:
# The C# Bridge uses Scriban. We must send templates compatible with it, NOT Jinja2.
# Scriban uses {{ val | func }} pipe syntax but different functions.
# We will pre-format numbers in standard math/string functions available in Scriban.

# Helper for C# side (Scriban doesn't have "format" filter like Python's Jinja)
# We will use basic interpolated strings for now or standard scriban math.round


# ============================================
# TICKET TEMPLATES (58mm = ~32 characters)
# ============================================

def get_classic_template() -> str:
    """
    Template optimized for 58mm thermal printers (32 chars width)
    Columns: CANT(3) | DESC(16) | TOTAL(9)
    """
    return """================================
{{ business.name }}
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
================================
Fecha: {{ sale.date }}
Ticket: #{{ sale.id }}
Cliente: {{ if sale.customer }}{{ sale.customer.name }}{{ else }}Consumidor Final{{ end }}
{{ if sale.customer && sale.customer.id_number }}
DOC: {{ sale.customer.id_number }}
{{ end }}
{{ if sale.is_credit }}
*** A CREDITO ***
Vence: {{ sale.due_date }}
{{ end }}
================================
CNT DESCRIPCION      TOTAL
--------------------------------
{{ for item in sale.products }}
{{ item.quantity | math.round 0 | string.pad_right 3 }} {{ item.product.name | string.slice 0 16 | string.pad_right 16 }} {{ currency_symbol }}{{ item.subtotal | math.format "F2" | string.pad_left 7 }}
{{ if item.discount_percentage > 0 }}
    Desc {{ item.discount_percentage | math.round 0 }}%
{{ end }}
{{ end }}
================================
SUBTOTAL:       {{ currency_symbol }}{{ sale.total | math.format "F2" | string.pad_left 9 }}
{{ if sale.discount > 0 }}
DESCUENTO:     -{{ currency_symbol }}{{ sale.discount | math.format "F2" | string.pad_left 9 }}
{{ end }}
TOTAL A PAGAR:  {{ currency_symbol }}{{ sale.total | math.format "F2" | string.pad_left 9 }}
================================
PAGOS:
{{ for p in sale.payments }}
{{ p.method | string.slice 0 20 | string.pad_right 20 }} {{ p.currency }}{{ p.amount | math.format "F2" | string.pad_left 7 }}
{{ end }}
{{ if sale.change_amount > 0 }}
--------------------------------
VUELTO:         {{ sale.change_currency }}{{ sale.change_amount | math.format "F2" | string.pad_left 9 }}
{{ end }}
================================
    Gracias por su compra
    
{{ if business.warranty_text }}{{ business.warranty_text }}{{ end }}
<cut>
"""

def get_modern_template() -> str:
    """
    Modern template with clean alignment
    """
    return """
       {{ business.name }}
   {{ business.address }}
----------------------------------
   TICKET DE VENTA #{{ sale.id }}
----------------------------------
{{ sale.date }}

CLIENTE: {{ if sale.customer }}{{ sale.customer.name | string.slice 0 22 }}{{ else }}CLIENTE GENERAL{{ end }}
{{ if sale.customer && sale.customer.id_number }}
DOC: {{ sale.customer.id_number }}
{{ end }}

ITEMS
----------------------------------
{{ for item in sale.products }}
{{ item.product.name | string.slice 0 30 }}
{{ item.quantity | math.round 0 }} x {{ currency_symbol }}{{ item.unit_price | math.format "F2" }}{{ if item.discount_percentage > 0 }} (-{{ item.discount_percentage | math.round 0 }}%){{ end }}
                  TOTAL: {{ currency_symbol }}{{ item.subtotal | math.format "F2" }}
{{ end }}
----------------------------------
SUBTOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}
{{ if sale.discount > 0 }}
DESCUENTO: -{{ currency_symbol }}{{ sale.discount | math.format "F2" }}
{{ end }}
TOTAL:    {{ currency_symbol }}{{ sale.total | math.format "F2" }}
----------------------------------
{{ for p in sale.payments }}
PAGO: {{ p.method | string.slice 0 12 }} {{ p.currency }}{{ p.amount | math.format "F2" }}
{{ end }}
{{ if sale.change_amount > 0 }}
VUELTO: {{ sale.change_currency }}{{ sale.change_amount | math.format "F2" }}
{{ end }}
----------------------------------
{{ if sale.is_credit }}
*** CUENTA POR COBRAR ***
Saldo: {{ currency_symbol }}{{ sale.balance | math.format "F2" }}
{{ else }}
*** PAGADO ***
{{ end }}

{{ if business.warranty_text }}{{ business.warranty_text }}{{ end }}
      ¡VUELVA PRONTO!
<cut>
"""

def get_detailed_template() -> str:
    """
    Detailed template with SKU codes
    """
    return """================================
{{ business.name }}
{{ business.document_id }}
--------------------------------
Venta: #{{ sale.id }}
Fecha: {{ sale.date }}
Cliente: {{ if sale.customer }}{{ sale.customer.name | string.slice 0 22 }}{{ else }}Consumidor Final{{ end }}
{{ if sale.customer && sale.customer.id_number }}
Doc: {{ sale.customer.id_number }}
{{ end }}
--------------------------------
CNT DESCRIPCION      TOTAL
--------------------------------
{{ for item in sale.products }}
{{ item.quantity | math.round 0 | string.pad_right 3 }} {{ item.product.name | string.slice 0 16 | string.pad_right 16 }} {{ currency_symbol }}{{ item.subtotal | math.format "F2" | string.pad_left 7 }}
{{ if item.product.sku }}
    SKU: {{ item.product.sku }}
{{ end }}
{{ if item.quantity != 1.0 }}
    {{ currency_symbol }}{{ item.unit_price | math.format "F2" }} c/u
{{ end }}
{{ end }}
================================
SUBTOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}
{{ if sale.discount > 0 }}
DESCUENTO: -{{ currency_symbol }}{{ sale.discount | math.format "F2" }}
{{ end }}
TOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}
================================
PAGOS DETALLADOS:
{{ for p in sale.payments }}
{{ p.method | string.slice 0 20 | string.pad_right 20 }} {{ p.currency }}{{ p.amount | math.format "F2" }}
{{ end }}
{{ if sale.change_amount > 0 }}
VUELTO: {{ sale.change_currency }}{{ sale.change_amount | math.format "F2" }}
{{ end }}
================================
{{ if business.warranty_text }}{{ business.warranty_text }}{{ end }}
<cut>
"""

def get_minimal_template() -> str:
    """
    Minimal template to save paper
    """
    return """{{ business.name }}
Ticket #{{ sale.id }}
{{ sale.date }}
Cli: {{ if sale.customer }}{{ sale.customer.name | string.slice 0 22 }}{{ else }}Consumidor Final{{ end }}
--------------------------------
{{ for item in sale.products }}
{{ item.quantity | math.round 0 | string.pad_right 3 }} {{ item.product.name | string.slice 0 15 | string.pad_right 15 }} {{ currency_symbol }}{{ item.subtotal | math.format "F2" | string.pad_left 7 }}
{{ end }}
--------------------------------
{{ if sale.discount > 0 }}
Sub: {{ currency_symbol }}{{ (sale.total + sale.discount) | math.format "F2" }}
Dsc: -{{ currency_symbol }}{{ sale.discount | math.format "F2" }}
{{ end }}
TOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}
--------------------------------
{{ for p in sale.payments }}
{{ p.method | string.slice 0 15 }}: {{ p.currency }}{{ p.amount | math.format "F2" }}
{{ end }}
{{ if sale.change_amount > 0 }}
Vuelto: {{ sale.change_currency }}{{ sale.change_amount | math.format "F2" }}
{{ end }}
<cut>
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
