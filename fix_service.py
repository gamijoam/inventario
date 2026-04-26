#!/usr/bin/env python3
with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'r') as f:
    content = f.read()

# Add helper function after logger line
helper_code = '''

def _get_schema_by_company(db: Session, source_company: str) -> str:
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
        return None

'''

# Insert after logger definition
content = content.replace(
    'logger = logging.getLogger(__name__)\n',
    'logger = logging.getLogger(__name__)\n' + helper_code
)

with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'w') as f:
    f.write(content)

print("Done")