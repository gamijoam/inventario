"""
Debug: Run Alembic and capture output
"""
import subprocess
import os
import sys

# Add project root path
sys.path.insert(0, os.getcwd())

from backend_api.config import settings

def run_debug():
    env = os.environ.copy()
    env["ALEMBIC_SCHEMA"] = "public"
    
    cmd = ["alembic", "upgrade", "shared@head"]
    
    print(f"Running: {' '.join(cmd)}")
    
    with open("alembic_full_debug.log", "w", encoding="utf-8") as f:
        # Use simple run with stdout redirection
        try:
            result = subprocess.run(
                cmd,
                stdout=f,
                stderr=subprocess.STDOUT, # Capture stderr too
                env=env,
                text=True,
                check=False # Don't raise on error
            )
            print(f"Done. Exit code: {result.returncode}")
        except Exception as e:
            f.write(f"\nEXCEPTION: {e}")
            print(f"Failed: {e}")

if __name__ == "__main__":
    run_debug()
