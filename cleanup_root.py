import os
import shutil
import glob

# Configuration
ARCHIVE_DIR = "_archive"

# Specific files to move
FILES_TO_ARCHIVE = [
    "add_unit_id_manual.sql",
    "alembic_migration_add_unit_id.py",
    "check_dashboard_logic.py",
    "check_db_type.py",
    "check_sales_today.py",
    "check_tables.py",
    "convert_migrations.py",
    "convert_to_lf.py",
    "debug_api_response.py",
    "debug_db_prefs.py",
    "debug_log.txt",
    "debug_payment.py",
    "debug_rate.py",
    "debug_rates_list.py",
    "debug_zreport.py",
    "drop_preferences_col.py",
    "fix_all_migrations.py",
    "fix_db_precision.py",
    "fix_db_preferences.py",
    "fix_enum.py",
    "fix_vps_migrations.sql",
    "migrate_cxp_postgres.py",
    "recreate_db.py",
    "scan_migrations.py",
    "seed_restaurant.py",
    "test_output.txt",
    "update_db_sale_id.py"
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

    print("-" * 30)
    print(f"Root Cleanup complete. Moved {count} files to {ARCHIVE_DIR}/")

if __name__ == "__main__":
    print("Starting Root Directory Cleanup...")
    move_files()
