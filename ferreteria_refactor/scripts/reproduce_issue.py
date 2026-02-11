
import sys
import os
from sqlalchemy import text, Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend_api.config import settings

# Setup isolated verification 
DATABASE_URL = settings.DATABASE_URL
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class TestModel(Base):
    __tablename__ = "test_isolation_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)

def reproduce():
    db = SessionLocal()
    schema = "test_repro_schema"
    
    try:
        # 1. Setup
        print(f"🏗️ Creating schema {schema}...")
        db.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        db.execute(text(f'CREATE SCHEMA "{schema}"'))
        db.commit()
        
        # 2. Create Table in Schema (using search path logic)
        print("🏗️ Creating tables...")
        with engine.connect() as conn:
            with conn.begin():
                conn.execute(text(f'SET search_path TO "{schema}"'))
                # We artificially recreate the table here for the test
                TestModel.__table__.create(conn)
        
        # 3. Simulate Seeding with intermediate commits
        print("🌱 Seeding data...")
        
        # Set path
        db.execute(text(f'SET search_path TO "{schema}", public'))
        
        # item 1
        item1 = TestModel(name="Item 1")
        db.add(item1)
        db.commit() # Commit 1
        
        # item 2 (Should still be in schema?)
        item2 = TestModel(name="Item 2")
        db.add(item2)
        db.commit() # Commit 2
        
        # 4. Verify location
        # Check if items are in public.test_isolation_items or schema.test_isolation_items
        # (Assuming public table doesn't exist, this might fail if it tries to insert to public and table missing)
        # But if public table DOES exist (like in real app where public has same tables), it would insert there.
        
        # Create public table to simulate real scenario
        try:
            with engine.connect() as conn:
                with conn.begin():
                    conn.execute(text(f'SET search_path TO public'))
                    TestModel.__table__.create(conn)
        except:
            pass # might exist
            
        # Refetch
        cnt_schema = db.execute(text(f'SELECT count(*) FROM "{schema}".test_isolation_items')).scalar()
        cnt_public = db.execute(text(f'SELECT count(*) FROM public.test_isolation_items')).scalar()
        
        print(f"📊 Result:")
        print(f"   Schema {schema}: {cnt_schema} items")
        print(f"   Public: {cnt_public} items")
        
        if cnt_public > 0:
            print("❌ FAIL: Data leaked to public!")
        else:
            print("✅ PASS: Data stayed in schema.")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    reproduce()
