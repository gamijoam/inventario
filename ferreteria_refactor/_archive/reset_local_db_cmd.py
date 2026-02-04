"""
Script para recrear la base de datos local usando psql.exe directamente
Bypassea problemas de encoding de psycopg2 en Windows
"""
import subprocess
import os
import sys

# Configuración
DB_USER = "postgres"
DB_PASS = "password"  # CAMBIAR SI ES DIFERENTE
DB_NAME = "prueba_db"
PSQL_PATH = r"C:\Program Files\PostgreSQL\17\bin\psql.exe"

# Intentar encontrar psql si la ruta hardcodeada no existe
if not os.path.exists(PSQL_PATH):
    # Buscar en versiones comunes
    possible_paths = [
        r"C:\Program Files\PostgreSQL\18\bin\psql.exe",
        r"C:\Program Files\PostgreSQL\17\bin\psql.exe",
        r"C:\Program Files\PostgreSQL\16\bin\psql.exe",
        r"C:\Program Files\PostgreSQL\15\bin\psql.exe",
        r"C:\Program Files\PostgreSQL\14\bin\psql.exe",
        r"C:\Program Files (x86)\PostgreSQL\16\bin\psql.exe",
    ]
    for path in possible_paths:
        if os.path.exists(path):
            PSQL_PATH = path
            break

print(f"🔧 Usando psql en: {PSQL_PATH}")

if not os.path.exists(PSQL_PATH):
    print("❌ No se encontró psql.exe. Verifica la instalación de PostgreSQL.")
    sys.exit(1)

# Comandos SQL separados
cmds = [
    # 1. Terminar conexiones
    (f"""
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '{DB_NAME}'
      AND pid <> pg_backend_pid();
    """, "Terminando conexiones..."),
    
    # 2. Eliminar DB
    (f"DROP DATABASE IF EXISTS {DB_NAME};", f"Eliminando {DB_NAME}..."),
    
    # 3. Crear DB
    (f"CREATE DATABASE {DB_NAME};", f"Creando {DB_NAME}...")
]

# Configurar entorno para el subproceso
env = os.environ.copy()
env["PGPASSWORD"] = DB_PASS
env["PGCLIENTENCODING"] = "utf8" 

print("🚀 Ejecutando reset de base de datos paso a paso...")

for sql, desc in cmds:
    print(f"\n👉 {desc}")
    try:
        process = subprocess.run(
            [PSQL_PATH, "-U", DB_USER, "-d", "postgres", "-c", sql],
            env=env,
            capture_output=True,
            text=True,
            encoding='utf-8', 
            errors='ignore'
        )
        
        if process.returncode == 0:
            print("   ✅ OK")
        else:
            print(f"   ❌ Error: {process.stderr}")
            # Si falla drop (ej: no existe) no importa, pero si falla create sí
            if "CREATE DATABASE" in sql:
                sys.exit(1)

    except Exception as e:
        print(f"   ❌ Excepción: {e}")

