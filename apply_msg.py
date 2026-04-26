#!/usr/bin/env python3

with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'r') as f:
    content = f.read()

# Fix export notification message (line 69)
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

# Fix import notification message (line 132)
old_import_msg = '''msg = (
    f"✅ *Traslado Recibido*\\n\\n"
    f"Tu empresa ({source_b_name}) ha recibido la mercancía.\\n"
    f"El inventario de *{source_company}* ha sido sincronizado."
)'''

new_import_msg = '''items_list = ", ".join([f"{i['sku']}" for i in data.get("items", [])[:5]])
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

print("Done" if '📦' in content else "Failed")