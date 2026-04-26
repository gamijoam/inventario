#!/usr/bin/env python3
import re

with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'r') as f:
    content = f.read()

# 1. Update export notification message to be more friendly
old_export_msg = '''msg = (
    f"🚚 *Traslado de Salida — {b_name}*\\n\\n"
    f"Se ha generado un paquete de traslado con {items_count} ítems.\\n"
    f"Recuerda enviar el archivo JSON al receptor."
)'''

new_export_msg = '''items_list = ", ".join([f"{i['sku']} ({i['quantity']})" for i in items_data[:5]])
extra_msg = f" y {len(items_data)-5} más" if len(items_data) > 5 else ""
friendly_time = datetime.now().strftime("%d/%m/%Y %I:%M %p")
msg = (
    f"🚚 *Traslado de Salida — {b_name}*\\n\\n"
    f"📦 *{items_count} producto(s)* confirmados\\n"
    f"📋 {items_list}{extra_msg}\\n\\n"
    f"🕐 Generado: {friendly_time}\\n\\n"
    f"✅ Paquete listo para enviar al receptor."
)'''

content = content.replace(old_export_msg, new_export_msg)

# 2. Update export package to include more fields
old_package = '''        # Build Package
        package = {
            "source_company": source_company,
            "source_warehouse_id": warehouse_id,
            "source_schema": get_tenant_schema(),
            "generated_at": datetime.now().isoformat(),
            "items": transfer_items,
            "photo_urls": photo_urls or []
        }'''

new_package = '''        # Get business name for friendly display
        business_name_row = db.execute(
            text(f"SELECT value FROM "{get_tenant_schema()}".business_config WHERE key = 'business_name'")
        ).scalar()
        business_name = business_name_row or source_company
        items_count = len(transfer_items)
        friendly_time = datetime.now().strftime("%d/%m/%Y %I:%M %p")

        # Build Package with friendly info
        package = {
            "source_company": source_company,
            "source_business_name": business_name,
            "source_warehouse_id": warehouse_id,
            "source_schema": get_tenant_schema(),
            "generated_at": datetime.now().isoformat(),
            "generated_at_friendly": friendly_time,
            "items_count": items_count,
            "items": transfer_items,
            "photo_urls": photo_urls or []
        }'''

content = content.replace(old_package, new_package)

# 3. Update import notification to be more friendly
old_import_msg = '''        msg = (
            f"✅ *Traslado Recibido*\\n\\n"
            f"Tu empresa ({source_b_name}) ha recibido la mercancía.\\n"
            f"El inventario de *{source_company}* ha sido sincronizado."
        )'''

new_import_msg = '''        items_list = ", ".join([f"{i['sku']}" for i in data.get("items", [])[:5]])
        extra_items = f" y {len(data.get('items', []))-5} más" if len(data.get('items', [])) > 5 else ""
        friendly_time = datetime.now().strftime("%d/%m/%Y %I:%M %p")
        source_business_name = data.get("source_business_name", source_company)
        msg = (
            f"✅ *Traslado Recibido*\\n\\n"
            f"📦 Tu empresa *{source_b_name}* ha recibido mercancía.\\n"
            f"🏪 De: *{source_company}* ({source_business_name})\\n\\n"
            f"📋 Productos: {items_list}{extra_items}\\n"
            f"🕐 Recibido: {friendly_time}\\n\\n"
            f"✅ Inventario sincronizado exitosamente."
        )'''

content = content.replace(old_import_msg, new_import_msg)

with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'w') as f:
    f.write(content)

print("Done" if 'items_count' in content else "Failed")