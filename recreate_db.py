
import os
import sys
import subprocess

# Define paths
# Script location: .../ferreteria/ferreteria_refactor/scripts (or root if placed there)
# We will place this in project root: .../ferreteria
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "ferreteria.db")
ALEMBIC_DIR = os.path.join(BASE_DIR, "ferreteria_refactor")

def recreate_db():
    print("=========================================")
    print("   RECREANDO BASE DE DATOS FERRETERIA    ")
    print("=========================================")
    
    # 1. Delete DB
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
            print(f"[OK] Base de datos eliminada: {DB_PATH}")
        except Exception as e:
            print(f"[ERROR] No se pudo eliminar la BD: {e}")
            print("Asegurate de cerrar el servidor backend primero.")
            return
    else:
        print("[INFO] No se encontro base de datos previa.")

    # 2. Run Alembic Migrations
    print("\n[INFO] Ejecutando migraciones (Alembic)...")
    try:
        # Run alembic upgrade head from the directory containing alembic.ini
        # We need to use 'python -m alembic' or just 'alembic' if in path
        CMD = ["alembic", "upgrade", "head"]
        
        # subprocess.run requires cwd to be where alembic.ini is
        result = subprocess.run(CMD, cwd=ALEMBIC_DIR, check=True, shell=True)
        
        if result.returncode == 0:
            print("[OK] Base de datos creada exitosamente y actualizada a la ultima version.")
        else:
            print(f"[ERROR] Fallo al ejecutar migraciones. Codigo: {result.returncode}")
            
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Error ejecutando comando: {e}")
    except Exception as e:
        print(f"[ERROR] Ocurrio un error inesperado: {e}")

    print("\n=========================================")
    print("   PROCESO TERMINADO")
    print("=========================================")

if __name__ == "__main__":
    recreate_db()
