"""
Script: create_superuser.py
Description: 
    - Ensures the 'Public' tenant exists (for shared logic).
    - Ensures the 'Ferreteria' tenant exists.
    - Creates a SUPER_ADMIN user in the public schema.
    - Hashes password securely.
"""
import sys
import os
import argparse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

# Add project root to path
sys.path.insert(0, os.getcwd())

from backend_api.config import settings
from backend_api.models.models import User, UserRole
from backend_api.models.tenant import Tenant

# Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def create_superuser(username, password, email):
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # 1. Ensure 'Ferreteria' Tenant Exists
        print("Checking/Creating Default Tenant...")
        target_schema = "ferreteria"
        tenant = session.query(Tenant).filter(Tenant.schema_name == target_schema).first()
        
        if not tenant:
            print(f"Creating tenant '{target_schema}'...")
            tenant = Tenant(
                name="Ferreteria Local",
                schema_name=target_schema,
                domain="ferreteria.localhost",
                is_active=True,
                is_demo=False
            )
            session.add(tenant)
            session.commit()
            print("✓ Tenant created.")
        else:
            print(f"✓ Tenant '{target_schema}' already exists.")

        # 2. Check/Create Superuser
        print(f"Checking/Creating Superuser '{email}'...")
        user = session.query(User).filter(User.email == email).first()
        
        if not user:
            print("Creating superuser...")
            hashed_pw = get_password_hash(password)
            user = User(
                username=username, # Optional display name
                email=email,       # Login ID
                password_hash=hashed_pw,
                role=UserRole.ADMIN,
                is_superuser=True,
                is_active=True,
                full_name="Super Administrador"
            )
            session.add(user)
            session.commit()
            print(f"✓ Superuser '{email}' created successfully.")
        else:
            print(f"! User '{email}' already exists. Updating to superuser...")
            user.is_superuser = True
            user.role = UserRole.ADMIN
            session.commit()
            print("✓ User updated.")

    except Exception as e:
        print(f"Error: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a Superuser")
    parser.add_argument("--username", default="admin", help="Username")
    parser.add_argument("--password", default="admin123", help="Password")
    parser.add_argument("--email", default="admin@example.com", help="Email")
    
    args = parser.parse_args()
    create_superuser(args.username, args.password, args.email)
