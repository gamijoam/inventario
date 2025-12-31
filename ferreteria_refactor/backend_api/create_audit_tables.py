import sys
import os

# Add ferreteria_refactor to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

from backend_api.database.db import engine
from backend_api.models.models import AuditLog

def create_tables():
    print("Iniciando creación de tabla de Auditoría...")
    try:
        # Esto solo crea las tablas que no existen.
        # No borra ni modifica las existentes.
        AuditLog.__table__.create(engine)
        print("✅ Tabla 'audit_logs' creada exitosamente.")
    except Exception as e:
        if "already exists" in str(e):
             print("ℹ️ La tabla ya existía, no se hicieron cambios.")
        else:
             print(f"❌ Error creando tabla: {e}")

if __name__ == "__main__":
    create_tables()
