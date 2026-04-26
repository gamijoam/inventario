#!/usr/bin/env python3
import re

with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'r') as f:
    content = f.read()

# Replace the _get_schema_by_company function with a better version that searches business_config
old_func = '''def _get_schema_by_company(db: Session, source_company: str) -> str:
    """
    Busca el schema_name de un tenant por nombre de empresa.
    Retorna None si no lo encuentra.
    """
    try:
        result = db.execute(
            text("SELECT schema_name FROM public.tenants WHERE name = :company LIMIT 1"),
            {"company": source_company}
        ).scalar()
        return result
    except Exception as e:
        logger.warning(f"[DEBUG] _get_schema_by_company error: {e}")
        return None'''

new_func = '''def _get_schema_by_company(db: Session, source_company: str) -> str:
    """
    Busca el schema_name de un tenant buscando business_name en business_config de cada schema.
    Retorna None si no lo encuentra.
    """
    try:
        tenants = db.execute(text("SELECT schema_name FROM public.tenants")).fetchall()
        for (schema,) in tenants:
            try:
                b_name = db.execute(
                    text(f"SELECT value FROM \\"{schema}\\"."business_config" WHERE key = 'business_name'")
                ).scalar()
                if b_name and b_name.strip().lower() == source_company.strip().lower():
                    logger.warning(f"[DEBUG] Found schema by business_name: {schema}")
                    return schema
            except:
                continue
        logger.warning(f"[DEBUG] No schema found for company: {source_company}")
        return None
    except Exception as e:
        logger.warning(f"[DEBUG] _get_schema_by_company error: {e}")
        return None'''

content = content.replace(old_func, new_func)

with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'w') as f:
    f.write(content)

print("Done")