import psycopg2
import os

# Parametros de conexión para el contenedor db_qa_server desde el contenedor de backend_qa
DB_HOST = os.environ.get("DB_HOST", "db_qa_server")
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASS = os.environ.get("DB_PASSWORD", "postgres")
DB_NAME = os.environ.get("DB_NAME", "invensoft_qa")

def migrate():
    try:
        conn = psycopg2.connect(host=DB_HOST, user=DB_USER, password=DB_PASS, dbname=DB_NAME)
        conn.autocommit = True
        cur = conn.cursor()
        
        # Get all schemas
        cur.execute("SELECT schema_name FROM information_schema.schemata;")
        schemas = [row[0] for row in cur.fetchall()]
        
        for schema in schemas:
            # Skip system schemas
            if schema in ['pg_catalog', 'information_schema', 'pg_toast'] or schema.startswith('pg_temp') or schema.startswith('pg_toast'):
                continue
                
            print(f"Checking schema: {schema}")
            
            # Check if sales table exists in this schema
            cur.execute(f"SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_schema = '{schema}' AND table_name = 'sales');")
            if not cur.fetchone()[0]:
                continue
                
            print(f"Applying migration to {schema}.sales...")
            
            alter_commands = [
                f'ALTER TABLE "{schema}".sales ADD COLUMN IF NOT EXISTS bloqueo_cliente_id INTEGER;',
                f'ALTER TABLE "{schema}".sales ADD COLUMN IF NOT EXISTS bloqueo_dispositivo_id INTEGER;',
                f'ALTER TABLE "{schema}".sales ADD COLUMN IF NOT EXISTS bloqueo_codigo_activacion VARCHAR(20);',
                f'ALTER TABLE "{schema}".sales ADD COLUMN IF NOT EXISTS bloqueo_sincronizado BOOLEAN DEFAULT FALSE;',
                f'ALTER TABLE "{schema}".sales ADD COLUMN IF NOT EXISTS bloqueo_estado VARCHAR(20);',
                f'ALTER TABLE "{schema}".sales ADD COLUMN IF NOT EXISTS bloqueo_error TEXT;'
            ]
            
            for cmd in alter_commands:
                try:
                    cur.execute(cmd)
                except Exception as e:
                    print(f"Error executing {cmd}: {e}")
                    
        print("Migration completed successfully.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
