"""
Prueba de Fuego - Validación de Migraciones Alembic
=====================================================

Este script ejecuta la "Prueba de Fuego" para validar que:
1. Alembic detecta TODOS los modelos (incluido Restaurant)
2. Las migraciones se generan correctamente desde cero
3. La base de datos se crea completa

PASOS:
1. Crear backup de alembic/versions
2. Borrar alembic/versions
3. Crear base de datos de prueba (ferreteria_test)
4. Generar migración inicial
5. Aplicar migración
6. Verificar tablas
"""

import os
import sys
import shutil
from datetime import datetime
from pathlib import Path

# Colores para terminal
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_step(step_num, message):
    print(f"\n{Colors.BLUE}[PASO {step_num}]{Colors.RESET} {message}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.RESET}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.RESET}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.RESET}")

def main():
    print("=" * 60)
    print("🔥 PRUEBA DE FUEGO - VALIDACIÓN DE MIGRACIONES ALEMBIC")
    print("=" * 60)
    
    # Verificar que estamos en el directorio correcto
    if not os.path.exists("alembic"):
        print_error("No se encontró la carpeta 'alembic'")
        print("Ejecuta este script desde la raíz del proyecto (ferreteria_refactor)")
        sys.exit(1)
    
    # PASO 1: Backup de alembic/versions
    print_step(1, "Creando backup de alembic/versions")
    
    versions_dir = Path("alembic/versions")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = Path(f"alembic/versions_backup_{timestamp}")
    
    if versions_dir.exists():
        try:
            shutil.copytree(versions_dir, backup_dir)
            print_success(f"Backup creado en: {backup_dir}")
        except Exception as e:
            print_error(f"Error al crear backup: {e}")
            sys.exit(1)
    else:
        print_warning("No existe alembic/versions (primera vez)")
    
    # PASO 2: Borrar alembic/versions
    print_step(2, "Borrando alembic/versions")
    
    if versions_dir.exists():
        try:
            # Borrar solo archivos .py (mantener __pycache__ si existe)
            for file in versions_dir.glob("*.py"):
                file.unlink()
                print(f"   Borrado: {file.name}")
            print_success("Archivos de migración borrados")
        except Exception as e:
            print_error(f"Error al borrar archivos: {e}")
            sys.exit(1)
    
    # PASO 3: Instrucciones para crear DB de prueba
    print_step(3, "Crear base de datos de prueba")
    print("\n" + "=" * 60)
    print("⚠️  ACCIÓN MANUAL REQUERIDA")
    print("=" * 60)
    print("\nEjecuta estos comandos en PostgreSQL:")
    print(f"\n{Colors.YELLOW}psql -U postgres{Colors.RESET}")
    print(f"{Colors.YELLOW}CREATE DATABASE ferreteria_test;{Colors.RESET}")
    print(f"{Colors.YELLOW}\\q{Colors.RESET}")
    print("\nLuego, actualiza tu .env:")
    print(f"{Colors.YELLOW}DB_NAME=ferreteria_test{Colors.RESET}")
    print("\n" + "=" * 60)
    
    input(f"\n{Colors.GREEN}Presiona ENTER cuando hayas creado la DB...{Colors.RESET}")
    
    # PASO 4: Generar migración inicial
    print_step(4, "Generando migración inicial")
    print("\nEjecuta manualmente:")
    print(f"{Colors.YELLOW}alembic revision --autogenerate -m \"initial_full_schema\"{Colors.RESET}")
    
    input(f"\n{Colors.GREEN}Presiona ENTER cuando hayas generado la migración...{Colors.RESET}")
    
    # PASO 5: Aplicar migración
    print_step(5, "Aplicando migración")
    print("\nEjecuta manualmente:")
    print(f"{Colors.YELLOW}alembic upgrade head{Colors.RESET}")
    
    input(f"\n{Colors.GREEN}Presiona ENTER cuando hayas aplicado la migración...{Colors.RESET}")
    
    # PASO 6: Verificar tablas
    print_step(6, "Verificar tablas en la base de datos")
    print("\nEjecuta en PostgreSQL:")
    print(f"\n{Colors.YELLOW}psql -U postgres -d ferreteria_test{Colors.RESET}")
    print(f"{Colors.YELLOW}\\dt{Colors.RESET}")
    print("\nBusca estas tablas:")
    print(f"{Colors.GREEN}✓ users{Colors.RESET}")
    print(f"{Colors.GREEN}✓ products{Colors.RESET}")
    print(f"{Colors.GREEN}✓ restaurant_tables{Colors.RESET}")
    print(f"{Colors.GREEN}✓ restaurant_orders{Colors.RESET}")
    print(f"{Colors.GREEN}✓ restaurant_order_items{Colors.RESET}")
    print(f"{Colors.GREEN}✓ restaurant_recipes{Colors.RESET}")
    print(f"{Colors.GREEN}✓ restaurant_menu_sections{Colors.RESET}")
    print(f"{Colors.GREEN}✓ restaurant_menu_items{Colors.RESET}")
    
    print("\n" + "=" * 60)
    print("🎯 RESULTADO ESPERADO")
    print("=" * 60)
    print(f"\n{Colors.GREEN}✅ ÉXITO:{Colors.RESET} Todas las tablas están presentes")
    print(f"{Colors.RED}❌ FALLO:{Colors.RESET} Faltan tablas de Restaurant → Revisar env.py")
    
    print("\n" + "=" * 60)
    print("📝 NOTAS FINALES")
    print("=" * 60)
    print(f"\n1. Backup guardado en: {backup_dir}")
    print("2. Para restaurar el backup:")
    print(f"   {Colors.YELLOW}rm -rf alembic/versions/*.py{Colors.RESET}")
    print(f"   {Colors.YELLOW}cp {backup_dir}/*.py alembic/versions/{Colors.RESET}")
    print("\n3. Para volver a tu DB original:")
    print(f"   {Colors.YELLOW}Cambia DB_NAME en .env a tu DB original{Colors.RESET}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}⚠️  Prueba cancelada por el usuario{Colors.RESET}")
        sys.exit(0)
