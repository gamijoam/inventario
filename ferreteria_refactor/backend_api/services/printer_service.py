from datetime import datetime
from ..models import restaurant as rest_models
from ..models import models

class PrinterService:
    @staticmethod
    def generate_kitchen_ticket(order: rest_models.RestaurantOrder, new_items: list):
        """
        Generates a Kitchen Ticket (Comanda) for the specific new items.
        Target: KITCHEN
        """
        template = """
<center>
<bold>COMANDA DE COCINA</bold>
</center>
<cut>
MESA: {{ table_name }}
MESERO: {{ waiter_name }}
HORA: {{ time }}
PEDIDO #: {{ order_id }}
------------------------------------------------
<bold>CANT  PRODUCTO</bold>
------------------------------------------------
{% for item in items %}
<bold>{{ item.quantity }} x {{ item.product_name }}</bold>
{% if item.notes %}
   (NOTA: {{ item.notes }})
{% endif %}
{% endfor %}
------------------------------------------------
<cut>
"""
        context = {
            "table_name": order.table.name if order.table else "??",
            "waiter_name": order.waiter.username if order.waiter else "Mesero",
            "time": datetime.now().strftime("%H:%M"),
            "order_id": order.id,
            "items": [
                {
                    "quantity": float(item.quantity) if item.quantity % 1 != 0 else int(item.quantity),
                    "product_name": item.product.name,
                    "notes": item.notes
                }
                for item in new_items
            ]
        }
        
        return {
            "target": "kitchen",
            "template": template,
            "context": context
        }

    @staticmethod
    def generate_pre_check_ticket(order: rest_models.RestaurantOrder):
        """
        Generates a Pre-Check Ticket (Preliminary Bill).
        Target: CASHIER (or default)
        """
        template = """
<center>
<bold>PRE-CUENTA</bold>
</center>
<center>
* NO FISCAL *
</center>
------------------------------------------------
MESA: {{ table_name }}
FECHA: {{ date }}
------------------------------------------------
CANT  DESCRIPCION          PRECIO    TOTAL
------------------------------------------------
{% for item in items %}
{{ item.quantity }} {{ item.product_name }}
      {{ item.unit_price }}      {{ item.subtotal }}
{% endfor %}
------------------------------------------------
<right>
<bold>TOTAL: {{ total }}</bold>
</right>
------------------------------------------------
<center>
PROPINA NO INCLUIDA
¡GRACIAS POR SU VISITA!
</center>
<cut>
"""
        # Calculate totals
        total = sum(item.subtotal for item in order.items if item.status != 'CANCELLED')
        
        context = {
            "table_name": order.table.name if order.table else "??",
            "date": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "items": [
                {
                    "quantity": float(item.quantity) if item.quantity % 1 != 0 else int(item.quantity),
                    "product_name": item.product.name[:20], # Truncate for receipt
                    "unit_price": f"{item.unit_price:.2f}",
                    "subtotal": f"{item.subtotal:.2f}"
                }
                for item in order.items if item.status != 'CANCELLED'
            ],
            "total": f"${total:.2f}"
        }
        
        return {
            "target": "caja", # Or 'default'
            "template": template,
            "context": context
        }
