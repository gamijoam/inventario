import os
import shutil
import glob

# Configuration
ARCHIVE_DIR = "_archive"
ROOT_DIR = "."

# Specific files to move
FILES_TO_ARCHIVE = [
    "check_columns.py",
    "check_db.py",
    "check_payments.py",
    "check_users_db.py",
    "debug_cash_movements.py",
    "debug_db.py",
    "debug_pm.py",
    "debug_services.py",
    "diagnose_db.py",
    "fix_audit_seq.py",
    "fix_enum.py",
    "fix_db_manual.py",
    "fix_service_data.py",
    "reproduce_422.py",
    "reproduce_issue.py",
    "simple_diag.py",
    "test_service.py",
    "test_ws.py",
    "verificar_prueba.py",
    # Generated during recent debugging
    "debug_alembic_error.py",
    "find_encoding_issues.py",
    "find_latin1.py",
    "find_models_latin1.py",
    "fix_db_creds.py",
    
    # Logs and output files
    "alembic_error_log.txt",
    "test_output.txt",
    
    # One-off scripts and tests
    "apply_unit_id.sql",
    "apply_unit_id_migration.py",
    "check_vip.py",
    "cleanup_laundry.py",
    "create_laundry_product.py",
    "create_laundry_product_v2.py",
    "locustfile.py",
    "prueba_de_fuego.py",
    "reset_local_db.py",
    "reset_local_db.sql",
    "reset_local_db_cmd.py",
    "seed_laundry.py",
    "seed_price_lists.py",
    "setup_license_system.py",
    "test_auth_endpoint.py",
    "test_cookie_auth.py",
    "verificar_prueba_vps.py"
]

def ensure_archive_dir():
    if not os.path.exists(ARCHIVE_DIR):
        os.makedirs(ARCHIVE_DIR)
        print(f"Created archive directory: {ARCHIVE_DIR}")

def move_files():
    count = 0
    ensure_archive_dir()
    
    # 1. Move specific files
    for filename in FILES_TO_ARCHIVE:
        if os.path.exists(filename):
            try:
                shutil.move(filename, os.path.join(ARCHIVE_DIR, filename))
                print(f"Moved: {filename}")
                count += 1
            except Exception as e:
                print(f"Error moving {filename}: {e}")
        else:
            # Check recursively if not in root (simple check in current, assumption based on list)
            # For this specific request, we'll stick to root and immediate subdirs if needed, 
            # but usually these are root scripts.
            pass

    # 2. Move files starting with verify_
    verify_files = glob.glob("verify_*.py")
    for filename in verify_files:
        if os.path.exists(filename): # glob shouldn't return non-existent, but good architecture
             try:
                target = os.path.join(ARCHIVE_DIR, filename)
                if os.path.exists(target):
                    os.remove(target) # Overwrite if exists in archive
                shutil.move(filename, target)
                print(f"Moved (pattern verify_*): {filename}")
                count += 1
             except Exception as e:
                print(f"Error moving {filename}: {e}")

    print("-" * 30)
    print(f"Cleanup complete. Moved {count} files to {ARCHIVE_DIR}/")

if __name__ == "__main__":
    print("Starting Project Cleanup...")
    move_files()
