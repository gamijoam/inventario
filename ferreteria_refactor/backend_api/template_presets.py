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

def get_classic_58_template() -> str:
    return """================================
<center>
<bold>{{ business.name }}</bold>
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
</center>
================================
Fecha: {{ sale.date }}
Ticket: #{{ sale.id }}
Cli: {{ if sale.customer }}{{ sale.customer.name | string.slice 0 20 }}{{ else }}Consumidor Final{{ end }}
{{ if sale.customer && sale.customer.id_number }}DOC: {{ sale.customer.id_number }}{{ end }}
{{ if sale.is_credit }}
<center>*** A CREDITO ***</center>
{{ end }}
================================
CANT PRODUCTO              TOTAL
--------------------------------
{{ for item in sale.products }}
{{ item.quantity | math.round 0 | string.pad_right 3 }} {{ item.product.name | string.slice 0 16 | string.pad_right 16 }} {{ currency_symbol }}{{ item.subtotal | math.format "F2" | string.pad_left 7 }}
{{ if item.discount_percentage > 0 }}    Desc {{ item.discount_percentage | math.round 0 }}%{{ end }}
{{ if item.serial_numbers && item.serial_numbers.size > 0 }}   IMEI: {{ item.serial_numbers | array.join ", " | string.slice 0 24 }}{{ end }}
{{ end }}
================================
<right>
SUBTOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}
{{ if sale.discount > 0 }}
DESCUENTO: -{{ currency_symbol }}{{ sale.discount | math.format "F2" }}
{{ end }}
<bold>TOTAL A PAGAR: {{ currency_symbol }}{{ sale.total | math.format "F2" }}</bold>
</right>
================================
PAGOS:
{{ for p in sale.payments }}
{{ p.method | string.slice 0 15 | string.pad_right 15 }} {{ p.currency }}{{ p.amount | math.format "F2" | string.pad_left 7 }}
{{ end }}
{{ if sale.change_amount > 0 }}
--------------------------------
<right>
VUELTO: {{ sale.change_currency }}{{ sale.change_amount | math.format "F2" }}
</right>
{{ end }}
================================
{{ has_warranty = false }}
{{ for item in sale.products }}{{ if item.warranty }}{{ has_warranty = true }}{{ end }}{{ end }}
{{ if has_warranty }}
GARANTIA
--------------------------------
{{ for item in sale.products }}{{ if item.warranty }}
{{ item.product.name | string.slice 0 16 }}: {{ item.warranty.name | string.slice 0 13 }}
Vigencia: {{ item.warranty.duration_text }}
{{ end }}{{ end }}
================================
{{ end }}
<center>
Gracias por su compra
{{ if business.warranty_text }}{{ business.warranty_text }}{{ end }}
</center>
<cut>
"""

def get_classic_80_template() -> str:
    return """================================================
<center>
<bold>{{ business.name }}</bold>
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
</center>
================================================
Fecha: {{ sale.date }}
Ticket: #{{ sale.id }}
Cli: {{ if sale.customer }}{{ sale.customer.name | string.slice 0 35 }}{{ else }}Consumidor Final{{ end }}
{{ if sale.customer && sale.customer.id_number }}DOC: {{ sale.customer.id_number }}{{ end }}
{{ if sale.is_credit }}
<center>*** A CREDITO ***</center>
{{ end }}
================================================
CANT DESCRIPCION                           TOTAL
------------------------------------------------
{{ for item in sale.products }}
{{ item.quantity | math.round 0 | string.pad_right 4 }} {{ item.product.name | string.slice 0 30 | string.pad_right 30 }} {{ currency_symbol }}{{ item.subtotal | math.format "F2" | string.pad_left 8 }}
{{ if item.discount_percentage > 0 }}     Desc {{ item.discount_percentage | math.round 0 }}%{{ end }}
{{ if item.serial_numbers && item.serial_numbers.size > 0 }}    IMEI: {{ item.serial_numbers | array.join ", " | string.slice 0 38 }}{{ end }}
{{ end }}
================================================
<right>
SUBTOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}
{{ if sale.discount > 0 }}
DESCUENTO: -{{ currency_symbol }}{{ sale.discount | math.format "F2" }}
{{ end }}
<bold>TOTAL A PAGAR: {{ currency_symbol }}{{ sale.total | math.format "F2" }}</bold>
</right>
================================================
PAGOS:
{{ for p in sale.payments }}
{{ p.method | string.slice 0 25 | string.pad_right 25 }} {{ p.currency }}{{ p.amount | math.format "F2" | string.pad_left 9 }}
{{ end }}
{{ if sale.change_amount > 0 }}
------------------------------------------------
<right>
VUELTO: {{ sale.change_currency }}{{ sale.change_amount | math.format "F2" }}
</right>
{{ end }}
================================================
{{ has_warranty = false }}
{{ for item in sale.products }}{{ if item.warranty }}{{ has_warranty = true }}{{ end }}{{ end }}
{{ if has_warranty }}
GARANTIA
------------------------------------------------
{{ for item in sale.products }}{{ if item.warranty }}
{{ item.product.name | string.slice 0 28 }}: {{ item.warranty.name | string.slice 0 18 }}
Vigencia: {{ item.warranty.duration_text }}
{{ end }}{{ end }}
================================================
{{ end }}
<center>
Gracias por su compra
{{ if business.warranty_text }}{{ business.warranty_text }}{{ end }}
</center>
<cut>
"""


def get_modern_58_template() -> str:
    return """<center>
<bold>{{ business.name }}</bold>
{{ business.address }}
--------------------------------
TICKET DE VENTA #{{ sale.id }}
--------------------------------
</center>
Fecha: {{ sale.date }}
Cliente: {{ if sale.customer }}{{ sale.customer.name | string.slice 0 20 }}{{ else }}Público General{{ end }}

ITEMS
--------------------------------
{{ for item in sale.products }}
{{ item.product.name | string.slice 0 32 }}
{{ item.quantity | math.round 0 }} x {{ currency_symbol }}{{ item.unit_price | math.format "F2" }}
<right>{{ currency_symbol }}{{ item.subtotal | math.format "F2" }}</right>
{{ end }}
--------------------------------
<right>
SUBTOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}
{{ if sale.discount > 0 }}
DESC: -{{ currency_symbol }}{{ sale.discount | math.format "F2" }}
{{ end }}
<bold>TOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}</bold>
</right>
--------------------------------
{{ for p in sale.payments }}
PAGO: {{ p.method | string.slice 0 10 }} {{ p.currency }}{{ p.amount | math.format "F2" }}
{{ end }}
{{ if sale.change_amount > 0 }}
<right>
VUELTO: {{ sale.change_currency }}{{ sale.change_amount | math.format "F2" }}
</right>
{{ end }}
--------------------------------
<center>
{{ if sale.is_credit }}*** CUENTA POR COBRAR ***{{ else }}*** PAGADO ***{{ end }}
{{ if business.warranty_text }}{{ business.warranty_text }}{{ end }}
¡VUELVA PRONTO!
</center>
<cut>
"""

def get_modern_80_template() -> str:
    return """<center>
<bold>{{ business.name }}</bold>
{{ business.address }}
------------------------------------------------
TICKET DE VENTA #{{ sale.id }}
------------------------------------------------
</center>
Fecha: {{ sale.date }}
Cliente: {{ if sale.customer }}{{ sale.customer.name | string.slice 0 35 }}{{ else }}Público General{{ end }}

ITEMS
------------------------------------------------
{{ for item in sale.products }}
{{ item.product.name | string.slice 0 48 }}
{{ item.quantity | math.round 0 }} x {{ currency_symbol }}{{ item.unit_price | math.format "F2" }}
<right>{{ currency_symbol }}{{ item.subtotal | math.format "F2" }}</right>
{{ end }}
------------------------------------------------
<right>
SUBTOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}
{{ if sale.discount > 0 }}
DESC: -{{ currency_symbol }}{{ sale.discount | math.format "F2" }}
{{ end }}
<bold>TOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}</bold>
</right>
------------------------------------------------
{{ for p in sale.payments }}
PAGO: {{ p.method | string.slice 0 20 }} {{ p.currency }}{{ p.amount | math.format "F2" }}
{{ end }}
{{ if sale.change_amount > 0 }}
<right>
VUELTO: {{ sale.change_currency }}{{ sale.change_amount | math.format "F2" }}
</right>
{{ end }}
------------------------------------------------
<center>
{{ if sale.is_credit }}*** CUENTA POR COBRAR ***{{ else }}*** PAGADO ***{{ end }}
{{ if business.warranty_text }}{{ business.warranty_text }}{{ end }}
¡VUELVA PRONTO!
</center>




<cut>
"""


def get_detailed_58_template() -> str:
    return """================================
<center>{{ business.name }}
{{ business.document_id }}</center>
--------------------------------
Venta: #{{ sale.id }}
Fecha: {{ sale.date }}
Cli: {{ if sale.customer }}{{ sale.customer.name | string.slice 0 25 }}{{ else }}Consumidor Final{{ end }}
--------------------------------
CNT DESCRIPCION            TOTAL
--------------------------------
{{ for item in sale.products }}
{{ item.quantity | math.round 0 | string.pad_right 3 }} {{ item.product.name | string.slice 0 16 | string.pad_right 16 }} {{ currency_symbol }}{{ item.subtotal | math.format "F2" | string.pad_left 7 }}
{{ if item.product.sku }}    SKU: {{ item.product.sku }}{{ end }}
{{ if item.quantity != 1.0 }}    {{ currency_symbol }}{{ item.unit_price | math.format "F2" }} c/u{{ end }}
{{ end }}
================================
<right>
SUBTOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}
{{ if sale.discount > 0 }}DESCUENTO: -{{ currency_symbol }}{{ sale.discount | math.format "F2" }}{{ end }}
<bold>TOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}</bold>
</right>
================================
PAGOS DETALLADOS:
{{ for p in sale.payments }}
{{ p.method | string.slice 0 15 | string.pad_right 15 }} {{ p.currency }}{{ p.amount | math.format "F2" }}
{{ end }}
{{ if sale.change_amount > 0 }}
<right>
VUELTO: {{ sale.change_currency }}{{ sale.change_amount | math.format "F2" }}
</right>
{{ end }}
================================
<cut>
"""

def get_detailed_80_template() -> str:
    return """================================================
<center>{{ business.name }}
{{ business.document_id }}</center>
------------------------------------------------
Venta: #{{ sale.id }}
Fecha: {{ sale.date }}
Cliente: {{ if sale.customer }}{{ sale.customer.name | string.slice 0 35 }}{{ else }}Consumidor Final{{ end }}
{{ if sale.customer && sale.customer.id_number }}Doc: {{ sale.customer.id_number }}{{ end }}
------------------------------------------------
CANT DESCRIPCION                           TOTAL
------------------------------------------------
{{ for item in sale.products }}
{{ item.quantity | math.round 0 | string.pad_right 4 }} {{ item.product.name | string.slice 0 30 | string.pad_right 30 }} {{ currency_symbol }}{{ item.subtotal | math.format "F2" | string.pad_left 8 }}
{{ if item.product.sku }}     SKU: {{ item.product.sku }}{{ end }}
{{ if item.quantity != 1.0 }}     {{ currency_symbol }}{{ item.unit_price | math.format "F2" }} c/u{{ end }}
{{ end }}
================================================
<right>
SUBTOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}
{{ if sale.discount > 0 }}DESCUENTO: -{{ currency_symbol }}{{ sale.discount | math.format "F2" }}{{ end }}
<bold>TOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}</bold>
</right>
================================================
PAGOS DETALLADOS:
{{ for p in sale.payments }}
{{ p.method | string.slice 0 25 | string.pad_right 25 }} {{ p.currency }}{{ p.amount | math.format "F2" | string.pad_left 9 }}
{{ end }}
{{ if sale.change_amount > 0 }}
<right>
VUELTO: {{ sale.change_currency }}{{ sale.change_amount | math.format "F2" }}
</right>
{{ end }}
================================================




<cut>
"""

def get_minimal_58_template() -> str:
    return """<bold>{{ business.name }}</bold>
#{{ sale.id }} | {{ sale.date }}
Cli: {{ if sale.customer }}{{ sale.customer.name | string.slice 0 25 }}{{ else }}Público{{ end }}
--------------------------------
{{ for item in sale.products }}
{{ item.quantity | math.round 0 | string.pad_right 2 }}x {{ item.product.name | string.slice 0 16 | string.pad_right 16 }} {{ currency_symbol }}{{ item.subtotal | math.format "F2" }}
{{ end }}
--------------------------------
<bold>TOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}</bold>
<cut>
"""

def get_minimal_80_template() -> str:
    return """<bold>{{ business.name }}</bold>
Ticket #{{ sale.id }} | Fecha: {{ sale.date }}
Cliente: {{ if sale.customer }}{{ sale.customer.name | string.slice 0 35 }}{{ else }}Público General{{ end }}
------------------------------------------------
{{ for item in sale.products }}
{{ item.quantity | math.round 0 | string.pad_right 3 }}x {{ item.product.name | string.slice 0 30 | string.pad_right 30 }} {{ currency_symbol }}{{ item.subtotal | math.format "F2" | string.pad_left 9 }}
{{ end }}
------------------------------------------------
<right><bold>TOTAL: {{ currency_symbol }}{{ sale.total | math.format "F2" }}</bold></right>




<cut>
"""


def get_all_presets() -> List[Dict[str, str]]:
    return [
        {
            "id": "classic_58",
            "name": "Clásico",
            "paper_width": 58,
            "description": "Formato estándar alineado para 58mm",
            "template": get_classic_58_template()
        },
        {
            "id": "classic_80",
            "name": "Clásico Ancho",
            "paper_width": 80,
            "description": "Formato expandido para facturación 80mm",
            "template": get_classic_80_template()
        },
        {
            "id": "modern_58",
            "name": "Moderno", 
            "paper_width": 58,
            "description": "Diseño limpio y centrado para 58mm",
            "template": get_modern_58_template()
        },
        {
            "id": "modern_80",
            "name": "Moderno Ancho", 
            "paper_width": 80,
            "description": "Diseño espacioso y centrado para 80mm",
            "template": get_modern_80_template()
        },
        {
            "id": "detailed_58",
            "name": "Detallado",
            "paper_width": 58,
            "description": "Incluye códigos SKU (58mm)",
            "template": get_detailed_58_template()
        },
        {
            "id": "detailed_80",
            "name": "Detallado Ancho",
            "paper_width": 80,
            "description": "Muestra códigos SKU e Info extendida (80mm)",
            "template": get_detailed_80_template()
        },
        {
            "id": "minimal_58",
            "name": "Ecológico",
            "paper_width": 58,
            "description": "Ahorra extremo de papel",
            "template": get_minimal_58_template()
        },
        {
            "id": "minimal_80",
            "name": "Ecológico Ancho",
            "paper_width": 80,
            "description": "Impresión sin márgenes en 80mm",
            "template": get_minimal_80_template()
        },
        # ── Servicios / Equipos Tecnológicos ──────────────────────────
        {
            "id": "services_sale_58",
            "name": "Equipos Tec.",
            "paper_width": 58,
            "category": "services",
            "description": "Muestra IMEI y garantía para venta de equipos (58mm)",
            "template": get_services_sale_58_template()
        },
        {
            "id": "services_sale_80",
            "name": "Equipos Tec. Ancho",
            "paper_width": 80,
            "category": "services",
            "description": "Muestra IMEI y garantía para venta de equipos (80mm)",
            "template": get_services_sale_80_template()
        },
    ]

# ============================================
# LAUNDRY / LAVANDERIA TEMPLATES
# Context uses "order" key
# ============================================

def get_laundry_58_template() -> str:
    return """================================
<center>
<bold>{{ business.name }}</bold>
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
</center>
================================
<center>
<bold>ORDEN DE LAVANDERIA</bold>
<bold>Ticket: {{ order.ticket_number }}</bold>
</center>
Fecha: {{ order.date }}
================================
CLIENTE
--------------------------------
Nombre: {{ order.customer.name | string.slice 0 28 }}
{{ if order.customer.phone }}Tel: {{ order.customer.phone }}{{ end }}
================================
ITEMS
--------------------------------
{{ for item in order.items }}
{{ item.quantity | math.round 0 | string.pad_right 2 }}x {{ item.description | string.slice 0 18 | string.pad_right 18 }} ${{ item.subtotal | math.format "F2" | string.pad_left 5 }}
{{ if item.observations }}   Nota: {{ item.observations | string.slice 0 26 }}{{ end }}
{{ end }}
================================
<right>
<bold>TOTAL: ${{ order.total | math.format "F2" }}</bold>
</right>
================================
Piezas: {{ order.pieces }}
Bolsa/ID: {{ order.bag_color }}
{{ if order.priority == "URGENT" }}
<center><bold>*** URGENTE ***</bold></center>
{{ end }}
{{ if order.diagnosis_notes }}
Nota: {{ order.diagnosis_notes | string.slice 0 28 }}
{{ end }}
================================
<center>
Conserve este ticket para retirar.
¡Gracias por su preferencia!
</center>




<cut>
"""


def get_laundry_80_template() -> str:
    return """================================================
<center>
<bold>{{ business.name }}</bold>
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
</center>
================================================
<center>
<bold>ORDEN DE LAVANDERIA</bold>
<bold>Ticket: {{ order.ticket_number }}</bold>
</center>
Fecha: {{ order.date }}
================================================
DATOS DEL CLIENTE
------------------------------------------------
Nombre: {{ order.customer.name | string.slice 0 38 }}
{{ if order.customer.phone }}Telefono: {{ order.customer.phone }}{{ end }}
{{ if order.customer.id_number }}Doc: {{ order.customer.id_number }}{{ end }}
================================================
CANT DESCRIPCION                           TOTAL
------------------------------------------------
{{ for item in order.items }}
{{ item.quantity | math.round 0 | string.pad_right 4 }} {{ item.description | string.slice 0 30 | string.pad_right 30 }} ${{ item.subtotal | math.format "F2" | string.pad_left 8 }}
{{ if item.observations }}     Nota: {{ item.observations | string.slice 0 38 }}{{ end }}
{{ end }}
================================================
<right>
<bold>TOTAL ESTIMADO: ${{ order.total | math.format "F2" }}</bold>
</right>
================================================
Piezas: {{ order.pieces }}    |    Bolsa/ID: {{ order.bag_color }}
{{ if order.priority == "URGENT" }}
<center><bold>*** ORDEN URGENTE ***</bold></center>
{{ end }}
{{ if order.diagnosis_notes }}
Observaciones: {{ order.diagnosis_notes | string.slice 0 44 }}
{{ end }}
================================================
<center>
Conserve este ticket para retirar su ropa.
¡Gracias por su preferencia!
</center>




<cut>
"""


def get_preset_by_id(preset_id: str) -> Dict[str, str]:
    presets = get_all_presets()
    for p in presets:
        if p["id"] == preset_id:
            return p
    return None


# ============================================
# QUOTE / COTIZACION TEMPLATES
# Context uses "quote" key instead of "sale"
# ============================================

def get_quote_58_template() -> str:
    return """================================
<center>
<bold>{{ business.name }}</bold>
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
</center>
================================
<center>
<bold>COTIZACION #{{ quote.id }}</bold>
</center>
Fecha: {{ quote.date }}
Cli: {{ if quote.customer }}{{ quote.customer.name | string.slice 0 20 }}{{ else }}Cliente General{{ end }}
{{ if quote.customer && quote.customer.id_number }}DOC: {{ quote.customer.id_number }}{{ end }}
================================
CANT PRODUCTO              TOTAL
--------------------------------
{{ for item in quote.items }}
{{ item.quantity | math.round 0 | string.pad_right 3 }} {{ item.product.name | string.slice 0 16 | string.pad_right 16 }} {{ currency_symbol }}{{ item.subtotal | math.format "F2" | string.pad_left 7 }}
{{ end }}
================================
<right>
<bold>TOTAL: {{ currency_symbol }}{{ quote.total | math.format "F2" }}</bold>
</right>
================================
{{ if quote.notes }}
Nota: {{ quote.notes | string.slice 0 28 }}
================================
{{ end }}
<center>
* Documento no fiscal *
¡Gracias por preferirnos!
</center>
<cut>
"""


def get_quote_80_template() -> str:
    return """================================================
<center>
<bold>{{ business.name }}</bold>
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
</center>
================================================
<center>
<bold>COTIZACION #{{ quote.id }}</bold>
</center>
Fecha: {{ quote.date }}
Cli: {{ if quote.customer }}{{ quote.customer.name | string.slice 0 35 }}{{ else }}Cliente General{{ end }}
{{ if quote.customer && quote.customer.id_number }}DOC: {{ quote.customer.id_number }}{{ end }}
================================================
CANT DESCRIPCION                           TOTAL
------------------------------------------------
{{ for item in quote.items }}
{{ item.quantity | math.round 0 | string.pad_right 4 }} {{ item.product.name | string.slice 0 30 | string.pad_right 30 }} {{ currency_symbol }}{{ item.subtotal | math.format "F2" | string.pad_left 8 }}
{{ end }}
================================================
<right>
<bold>TOTAL: {{ currency_symbol }}{{ quote.total | math.format "F2" }}</bold>
</right>
================================================
{{ if quote.notes }}
Nota: {{ quote.notes | string.slice 0 42 }}
================================================
{{ end }}
<center>
* Documento no fiscal *
¡Gracias por preferirnos!
</center>
<cut>
"""


# ============================================
# SERVICE REPAIR / SERVICIO TÉCNICO TEMPLATES
# Context uses "order" key (same endpoint as laundry but service_type=REPAIR)
# ============================================

def get_service_repair_58_template() -> str:
    return """================================
<center>
<bold>{{ business.name }}</bold>
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
</center>
================================
<center>
<bold>RECEPCION DE SERVICIO TECNICO</bold>
<bold>Ticket: {{ order.ticket_number }}</bold>
</center>
Fecha: {{ order.date }}
================================
CLIENTE
--------------------------------
Nombre: {{ order.customer.name | string.slice 0 28 }}
{{ if order.customer.phone }}Tel: {{ order.customer.phone }}{{ end }}
{{ if order.customer.id_number }}Doc: {{ order.customer.id_number }}{{ end }}
================================
EQUIPO
--------------------------------
Tipo:   {{ order.device_type | string.slice 0 24 }}
Marca:  {{ order.brand | string.slice 0 24 }}
Modelo: {{ order.model | string.slice 0 24 }}
{{ if order.serial_imei }}IMEI/Serial:
{{ order.serial_imei | string.slice 0 30 }}{{ end }}
================================
PROBLEMA REPORTADO
--------------------------------
{{ order.problem_description | string.slice 0 90 }}
{{ if order.physical_condition }}Cond: {{ order.physical_condition | string.slice 0 26 }}{{ end }}
{{ if order.priority == "URGENT" }}
<center><bold>*** URGENTE ***</bold></center>
{{ end }}
{{ if order.warranty }}
================================
GARANTIA DEL SERVICIO
--------------------------------
{{ order.warranty.name | string.slice 0 30 }}
{{ if order.warranty.duration_text }}Vigencia: {{ order.warranty.duration_text }}{{ end }}
{{ if order.warranty.description }}{{ order.warranty.description | string.slice 0 90 }}{{ end }}
{{ end }}
================================
<center>
Conserve este ticket para retirar
su equipo. ¡Gracias por elegirnos!
</center>




<cut>
"""


def get_service_repair_80_template() -> str:
    return """================================================
<center>
<bold>{{ business.name }}</bold>
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
</center>
================================================
<center>
<bold>RECEPCION DE SERVICIO TECNICO</bold>
<bold>Ticket: {{ order.ticket_number }}</bold>
</center>
Fecha: {{ order.date }}
================================================
DATOS DEL CLIENTE
------------------------------------------------
Nombre: {{ order.customer.name | string.slice 0 38 }}
{{ if order.customer.phone }}Telefono: {{ order.customer.phone }}{{ end }}
{{ if order.customer.id_number }}Documento: {{ order.customer.id_number }}{{ end }}
================================================
DATOS DEL EQUIPO
------------------------------------------------
Tipo:    {{ order.device_type | string.slice 0 38 }}
Marca:   {{ order.brand | string.slice 0 38 }}
Modelo:  {{ order.model | string.slice 0 38 }}
{{ if order.serial_imei }}IMEI/Serial: {{ order.serial_imei | string.slice 0 34 }}{{ end }}
================================================
PROBLEMA REPORTADO
------------------------------------------------
{{ order.problem_description | string.slice 0 140 }}
{{ if order.physical_condition }}Condicion: {{ order.physical_condition | string.slice 0 44 }}{{ end }}
{{ if order.priority == "URGENT" }}
<center><bold>*** ORDEN URGENTE ***</bold></center>
{{ end }}
{{ if order.warranty }}
================================================
GARANTIA DEL SERVICIO
------------------------------------------------
{{ order.warranty.name | string.slice 0 46 }}
{{ if order.warranty.duration_text }}Vigencia: {{ order.warranty.duration_text }}{{ end }}
{{ if order.warranty.description }}{{ order.warranty.description | string.slice 0 140 }}{{ end }}
{{ end }}
================================================
<center>
Conserve este ticket para retirar su equipo.
¡Gracias por elegirnos!
</center>




<cut>
"""


# ============================================
# SERVICES SALE TEMPLATES (POS — Equipos Tec.)
# Context: same as classic sale ("sale" key)
# Auto-used when sale has serialized items (IMEI)
# ============================================

def get_services_sale_58_template() -> str:
    return """================================
<center>
<bold>{{ business.name }}</bold>
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
</center>
================================
<center>
<bold>VENTA - EQUIPO TECNOLOGICO</bold>
<bold>Factura N\u00b0 {{ sale.id }}</bold>
</center>
Fecha: {{ sale.date }}
================================
CLIENTE
--------------------------------
{{ if sale.customer && sale.customer.name }}Nombre: {{ sale.customer.name | string.slice 0 26 }}
{{ if sale.customer.id_number }}Doc:    {{ sale.customer.id_number }}{{ end }}
{{ else }}Consumidor Final{{ end }}
================================
ARTICULOS
--------------------------------
{{ for item in sale.products }}{{ item.product.name | string.slice 0 30 }}
  Cant: {{ item.quantity }}   Total: {{ item.formatted_total }}
{{ if item.serial_numbers && item.serial_numbers.size > 0 }}  IMEI/Serial:
  {{ item.serial_numbers | array.join ", " | string.slice 0 28 }}
{{ end }}{{ if item.warranty }}  Garantia: {{ item.warranty.name | string.slice 0 20 }}
  Vigencia: {{ item.warranty.duration_text }}
{{ end }}{{ end }}================================
<bold>TOTAL: {{ sale.formatted_total }}</bold>
{{ if sale.is_usd }}Ref Bs: {{ sale.formatted_total_ref }}
Tasa:   {{ sale.exchange_rate }} Bs/${{ end }}
================================
PAGO
--------------------------------
{{ for p in sale.payments }}{{ p.method }}: {{ p.formatted_amount }}
{{ end }}{{ if sale.change_amount && sale.change_amount > 0 }}Cambio: {{ sale.formatted_change }}{{ end }}
================================
<center>
Gracias por su compra!
Conserve su factura y ticket.
</center>




<cut>
"""


def get_services_sale_80_template() -> str:
    return """================================================
<center>
<bold>{{ business.name }}</bold>
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
</center>
================================================
<center>
<bold>VENTA - EQUIPO TECNOLOGICO</bold>
<bold>Factura N\u00b0 {{ sale.id }}</bold>
</center>
Fecha: {{ sale.date }}
================================================
DATOS DEL CLIENTE
------------------------------------------------
{{ if sale.customer && sale.customer.name }}Nombre:    {{ sale.customer.name | string.slice 0 38 }}
{{ if sale.customer.id_number }}Documento: {{ sale.customer.id_number }}{{ end }}
{{ else }}Consumidor Final{{ end }}
================================================
ARTICULOS VENDIDOS
------------------------------------------------
{{ for item in sale.products }}{{ item.product.name | string.slice 0 44 }}
  Cantidad: {{ item.quantity }}          Total: {{ item.formatted_total }}
{{ if item.serial_numbers && item.serial_numbers.size > 0 }}  IMEI/Serial: {{ item.serial_numbers | array.join ", " | string.slice 0 30 }}
{{ end }}{{ if item.warranty }}  Garantia:  {{ item.warranty.name | string.slice 0 35 }}
  Vigencia:  {{ item.warranty.duration_text }}
{{ end }}{{ end }}================================================
<bold>TOTAL: {{ sale.formatted_total }}</bold>
{{ if sale.is_usd }}Referencia Bs: {{ sale.formatted_total_ref }}
Tasa BCV:      {{ sale.exchange_rate }} Bs/${{ end }}
================================================
FORMA DE PAGO
------------------------------------------------
{{ for p in sale.payments }}{{ p.method | string.pad_right 20 }} {{ p.formatted_amount }}
{{ end }}{{ if sale.change_amount && sale.change_amount > 0 }}Cambio entregado: {{ sale.formatted_change }}{{ end }}
================================================
<center>
Gracias por su compra!
Conserve esta factura para reclamaciones.
</center>




<cut>
"""
