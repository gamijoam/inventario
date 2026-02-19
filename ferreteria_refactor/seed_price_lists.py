from backend_api.database.db import engine
from sqlalchemy import text, inspect

def seed_price_lists():
    inspector = inspect(engine)
    schemas = inspector.get_schema_names()
    tenant_schemas = [s for s in schemas if s not in ['public', 'information_schema'] and not s.startswith('pg_')]

    print(f"🌍 Found Schemas: {tenant_schemas}")

    with engine.connect() as conn:
        for schema in tenant_schemas:
            print(f"🌱 Seeding {schema}...")
            
            # Check if lists exist
            result = conn.execute(text(f"SELECT COUNT(*) FROM \"{schema}\".price_lists"))
            count = result.scalar()
            
            if count == 0:
                print(f"   Creating default lists for {schema}...")
                conn.execute(text(f"""
                    INSERT INTO \"{schema}\".price_lists (name, requires_auth, is_active) VALUES 
                    ('Mayorista', FALSE, TRUE),
                    ('Estudiante', FALSE, TRUE),
                    ('VIP', TRUE, TRUE)
                """))
                conn.commit()
                print("   ✅ Seeded.")
            else:
                print(f"   ℹ️  Already has {count} lists.")

if __name__ == "__main__":
    seed_price_lists()
