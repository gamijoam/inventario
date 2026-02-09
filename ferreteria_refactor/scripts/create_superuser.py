"""
Script to create or promote a user to superuser status.

Usage:
    python create_superuser.py <username>

Example:
    python create_superuser.py admin
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_api.database.db import SessionLocal
from backend_api.models.models import User
from backend_api.security import get_password_hash

def create_or_promote_superuser(username: str):
    """Create a new superuser or promote an existing user to superuser."""
    db = SessionLocal()
    
    try:
        # Check if user exists
        user = db.query(User).filter(User.username == username).first()
        
        if user:
            # User exists, promote to superuser
            if user.is_superuser:
                print(f"✅ User '{username}' is already a superuser.")
            else:
                user.is_superuser = True
                db.commit()
                print(f"✅ User '{username}' has been promoted to superuser.")
        else:
            # User doesn't exist, create new superuser
            print(f"User '{username}' not found. Creating new superuser...")
            password = input("Enter password for new superuser: ")
            
            if len(password) < 4:
                print("❌ Password must be at least 4 characters long.")
                return
            
            new_user = User(
                username=username,
                password_hash=get_password_hash(password),
                role="ADMIN",
                is_active=True,
                is_superuser=True,
                full_name="Super Administrator"
            )
            
            db.add(new_user)
            db.commit()
            print(f"✅ Superuser '{username}' created successfully!")
        
        # Show current superusers
        print("\n📋 Current superusers:")
        superusers = db.query(User).filter(User.is_superuser == True).all()
        for su in superusers:
            print(f"   - {su.username} ({su.role}) - Active: {su.is_active}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python create_superuser.py <username>")
        print("Example: python create_superuser.py admin")
        sys.exit(1)
    
    username = sys.argv[1]
    create_or_promote_superuser(username)
