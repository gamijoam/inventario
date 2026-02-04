import sys
import os

# Ensure current directory is in path for imports
sys.path.append(os.getcwd())

from backend_api.database.db import SessionLocal
from backend_api.models import models

def check_vip_status():
    db = SessionLocal()
    try:
        # Check specifically for any list with 'VIP' in name
        print("Searching for VIP lists...")
        vip_lists = db.query(models.PriceList).filter(models.PriceList.name.ilike("%VIP%")).all()
        
        if vip_lists:
            for v in vip_lists:
                print(f"FOUND: ID={v.id}, Name='{v.name}', Auth={v.requires_auth} (Type: {type(v.requires_auth)})")
                
                if not v.requires_auth:
                    print(f" -> UPDATING '{v.name}' to requires_auth=True")
                    v.requires_auth = True
                    db.commit()
                    print("Updated successfully.")
        else:
            print("No lists found matching 'VIP'")

        # Dump all lists for visibility
        print("\n--- All Price Lists ---")
        all_lists = db.query(models.PriceList).all()
        for x in all_lists:
            auth_icon = "[LOCKED]" if x.requires_auth else "[OPEN]"
            print(f"{x.id}: {x.name} {auth_icon}")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_vip_status()
