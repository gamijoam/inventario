"""
Script para recrear la base de datos local desde cero
Ejecutar con: python reset_local_db.py
"""
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Configuración
DB_USER = "postgres"
DB_PASSWORD = "postgres"  # Cambia esto si tu contraseña es diferente
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "prueba_db"

print("🔧 Recreando base de datos local...")

try:
    # Conectar a la base de datos postgres (default)
    # Windows suele usar latin1/cp1252 por defecto
    conn = psycopg2.connect(
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        database="postgres",
        client_encoding="latin1"
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    # Terminar conexiones activas
    print(f"📌 Terminando conexiones activas a {DB_NAME}...")
    cursor.execute(f"""
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '{DB_NAME}'
          AND pid <> pg_backend_pid();
    """)
    
    # Eliminar base de datos si existe
    print(f"🗑️  Eliminando base de datos {DB_NAME} si existe...")
    cursor.execute(f"DROP DATABASE IF EXISTS {DB_NAME};")
    
    # Crear base de datos limpia
    print(f"✨ Creando base de datos {DB_NAME}...")
    cursor.execute(f"CREATE DATABASE {DB_NAME};")
    
    cursor.close()
    conn.close()
    
    print(f"\n✅ Base de datos {DB_NAME} recreada exitosamente!")
    print("\n📝 Próximos pasos:")
    print("1. Asegúrate de que tu .env tenga:")
    print(f"   DATABASE_URL=postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")
    print("2. Reinicia el servidor FastAPI:")
    print("   python -m uvicorn ferreteria_refactor.backend_api.main:app --reload --port 8000")
    print("\n🎯 Las migraciones se ejecutarán automáticamente al iniciar")
    
except psycopg2.Error as e:
    print(f"\n❌ Error: {e}")
    print("\n💡 Verifica:")
    print("1. PostgreSQL está corriendo")
    print("2. Usuario y contraseña son correctos")
    print("3. Tienes permisos para crear/eliminar bases de datos")
except Exception as e:
    print(f"\n❌ Error inesperado: {e}")
