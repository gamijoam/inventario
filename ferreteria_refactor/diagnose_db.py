"""
Script de diagnóstico para identificar el problema de encoding
"""
import os
import sys

print("=" * 60)
print("DIAGNÓSTICO DE CONFIGURACIÓN DE BASE DE DATOS")
print("=" * 60)

# 1. Verificar encoding del sistema
print(f"\n1. Encoding del sistema:")
print(f"   - sys.getdefaultencoding(): {sys.getdefaultencoding()}")
print(f"   - sys.getfilesystemencoding(): {sys.getfilesystemencoding()}")

# 2. Verificar variables de entorno
print(f"\n2. Variables de entorno relevantes:")
env_vars = ['DB_TYPE', 'DATABASE_URL', 'PGPASSWORD', 'PGUSER', 'PGHOST']
for var in env_vars:
    value = os.getenv(var, 'NO DEFINIDA')
    if 'PASSWORD' in var or 'URL' in var:
        # Ocultar contraseñas
        if value != 'NO DEFINIDA':
            print(f"   - {var}: ***OCULTO*** (longitud: {len(value)})")
        else:
            print(f"   - {var}: {value}")
    else:
        print(f"   - {var}: {value}")

# 3. Intentar cargar .env manualmente
print(f"\n3. Intentando cargar .env:")
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    print(f"   - Ruta .env: {env_path}")
    print(f"   - Existe: {os.path.exists(env_path)}")
    
    if os.path.exists(env_path):
        # Leer archivo con diferentes encodings
        encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        for enc in encodings:
            try:
                with open(env_path, 'r', encoding=enc) as f:
                    content = f.read()
                print(f"   - ✅ Lectura exitosa con encoding: {enc}")
                print(f"   - Tamaño: {len(content)} bytes")
                break
            except UnicodeDecodeError as e:
                print(f"   - ❌ Fallo con {enc}: {e}")
    
    load_dotenv(env_path)
    print(f"   - load_dotenv() ejecutado")
    
except Exception as e:
    print(f"   - ❌ Error: {e}")

# 4. Intentar construir DATABASE_URL
print(f"\n4. Construyendo DATABASE_URL:")
try:
    db_type = os.getenv('DB_TYPE', 'postgres')
    print(f"   - DB_TYPE: {db_type}")
    
    if db_type == 'postgres':
        db_url = os.getenv('DATABASE_URL')
        if db_url:
            print(f"   - DATABASE_URL encontrado (longitud: {len(db_url)})")
            # Intentar decodificar
            try:
                decoded = db_url.encode('utf-8').decode('utf-8')
                print(f"   - ✅ DATABASE_URL es válido UTF-8")
            except UnicodeDecodeError as e:
                print(f"   - ❌ DATABASE_URL tiene problema de encoding: {e}")
                print(f"   - Bytes problemáticos en posición {e.start}: {db_url[e.start:e.end+10]}")
        else:
            print(f"   - ❌ DATABASE_URL no definido")
            
except Exception as e:
    print(f"   - ❌ Error: {e}")

# 5. Intentar conectar a PostgreSQL
print(f"\n5. Intentando conexión a PostgreSQL:")
try:
    import psycopg2
    
    # Construir parámetros de conexión manualmente
    conn_params = {
        'user': 'postgres',
        'password': 'postgres',
        'host': 'localhost',
        'port': '5432',
        'database': 'prueba_db'
    }
    
    print(f"   - Parámetros: user={conn_params['user']}, host={conn_params['host']}, db={conn_params['database']}")
    
    conn = psycopg2.connect(**conn_params)
    print(f"   - ✅ Conexión exitosa!")
    
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    version = cursor.fetchone()
    print(f"   - PostgreSQL version: {version[0][:50]}...")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"   - ❌ Error de conexión: {e}")
    print(f"   - Tipo de error: {type(e).__name__}")

print("\n" + "=" * 60)
print("FIN DEL DIAGNÓSTICO")
print("=" * 60)
