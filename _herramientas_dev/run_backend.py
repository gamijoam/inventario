"""
Entry point for PyInstaller packaged backend.
This file uses absolute imports instead of relative imports.
"""
import sys
import os

# CRITICAL: Set environment variables BEFORE importing the app
# This disables License Guard for packaged production
os.environ["DOCKER_CONTAINER"] = "true"
os.environ["PORT"] = os.getenv("PORT", "8001")
os.environ["DB_TYPE"] = "sqlite"
os.environ["SQLITE_DB_NAME"] = "ferreteria.db"

# DEBUG: Confirm env vars are set
print(f"[DEBUG] DOCKER_CONTAINER={os.getenv('DOCKER_CONTAINER')}")
print(f"[DEBUG] PORT={os.getenv('PORT')}")
print(f"[DEBUG] DB_TYPE={os.getenv('DB_TYPE')}")

# Add the package to the path
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    base_path = sys._MEIPASS
else:
    # Running as script
    base_path = os.path.dirname(os.path.abspath(__file__))

# Import and run the main app
from ferreteria_refactor.backend_api.main import app
import uvicorn

if __name__ == "__main__":
    # Get port from environment
    port = int(os.getenv("PORT", "8001"))
    
    # Run the server
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="debug"
    )
