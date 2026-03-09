
import os
import subprocess
import glob
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any

# Backup Directory — uses env var for local dev, defaults to Docker path
BACKUP_DIR = os.environ.get("BACKUP_DIR", "/app/backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

import gzip

def create_backup() -> Dict[str, Any]:
    """
    Generate a full backup of the database using pg_dump.
    Returns metadata of the created file.
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.sql.gz"
    filepath = os.path.join(BACKUP_DIR, filename)

    # Get Credentials from Settings (Source of Truth)
    from ..config import settings
    from sqlalchemy.engine import make_url
    
    try:
        url = make_url(settings.DATABASE_URL)
        db_host = url.host
        db_port = str(url.port) if url.port else "5432"
        db_user = url.username
        db_pass = url.password
        db_name = url.database
        print(f"🔗 Parsed DATABASE_URL: {db_user}@**:{db_port}/{db_name}")
    except Exception as e:
        print(f"⚠️ Failed to parse DATABASE_URL: {e}. Falling back to env vars.")
        db_host = os.getenv("DB_HOST") or os.getenv("POSTGRES_HOST") or "db"
        db_port = os.getenv("DB_PORT", "5432")
        db_user = os.getenv("POSTGRES_USER") or os.getenv("DB_USER") or "postgres"
        db_name = os.getenv("POSTGRES_DB") or os.getenv("DB_NAME") or "invensoft_prod"
        db_pass = os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD")

    print(f"📦 Starting Backup: {filename}")
    print(f"🔧 Target: {db_host}:{db_port} / DB: {db_name} / User: {db_user}")

    # Prepare Environment
    env = os.environ.copy()
    if db_pass:
        env["PGPASSWORD"] = db_pass
    else:
        print("⚠️ WARNING: No password found in DATABASE_URL or env vars!")

    # Temporary plaintext path
    sql_path = filepath.replace(".gz", "")

    try:
        # Step 1: Dump to plain SQL file
        cmd = ["pg_dump", "-h", db_host, "-p", db_port, "-U", db_user, "-d", db_name]
        
        with open(sql_path, "w") as f_out:
            process = subprocess.run(
                cmd,
                stdout=f_out,
                stderr=subprocess.PIPE,
                env=env,
                text=True,
                check=False # We handle returncode manually
            )
        
        # Check STDERR for issues
        if process.stderr:
            print(f"ℹ️ pg_dump stderr: {process.stderr}")

        if process.returncode != 0:
            raise Exception(f"pg_dump failed (code {process.returncode}): {process.stderr}")

        # Step 2: Verify SQL File
        if not os.path.exists(sql_path) or os.path.getsize(sql_path) < 100:
             # Look for specific failure clues in stderr
             raise Exception(f"Backup file is too small or empty. Stderr: {process.stderr}")

        # Optional: Check for Dump Header
        with open(sql_path, "r") as f_read:
            head = f_read.read(50)
            if "PostgreSQL" not in head and "PGDMP" not in head: 
                 print(f"⚠️ Warning: File header does not look like a standard dump: {head}")

        # Step 3: Compress to .gz
        with open(sql_path, "rb") as f_in:
            with gzip.open(filepath, "wb") as f_out:
                f_out.writelines(f_in)
        
        # Cleanup plain SQL
        os.remove(sql_path)
            
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        print(f"✅ Backup created: {filename} ({size_mb:.2f} MB)")
        
        return {
            "filename": filename,
            "path": filepath,
            "size": f"{size_mb:.2f} MB",
            "created_at": timestamp
        }

    except Exception as e:
        print(f"🔥 Backup Error: {str(e)}")
        # Clean up failed files
        if os.path.exists(filepath):
            os.remove(filepath)
        if 'sql_path' in locals() and os.path.exists(sql_path):
            os.remove(sql_path)
        raise e

def list_backups() -> List[Dict[str, Any]]:
    """
    List all .sql.gz files in the backup directory.
    """
    files = glob.glob(os.path.join(BACKUP_DIR, "*.sql.gz"))
    backups = []
    
    for f in files:
        stats = os.stat(f)
        path_obj = Path(f)
        
        backups.append({
            "filename": path_obj.name,
            "size_bytes": stats.st_size,
            "size_mb": round(stats.st_size / (1024 * 1024), 2),
            "created_at": datetime.fromtimestamp(stats.st_ctime).isoformat()
        })
        
    # Sort by creation time desc
    backups.sort(key=lambda x: x["created_at"], reverse=True)
    return backups

def get_backup_path(filename: str) -> str:
    """
    Securely resolve backup file path.
    Prevents directory traversal.
    """
    # Simple validation
    if ".." in filename or "/" in filename or "\\" in filename:
        raise ValueError("Invalid filename")
        
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath):
        raise FileNotFoundError("Backup file not found")
        
    return filepath

def delete_backup(filename: str) -> bool:
    try:
        filepath = get_backup_path(filename)
        os.remove(filepath)
        return True
    except FileNotFoundError:
        return False
