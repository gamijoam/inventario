
import uvicorn
import os
import sys
import multiprocessing

# Add the project directory to sys.path to ensure modules are found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ferreteria_refactor.backend_api.main import app

if __name__ == "__main__":
    multiprocessing.freeze_support() # Necessary for PyInstaller on Windows
    
    # Run Uvicorn
    # Use '0.0.0.0' to be accessible externally if needed, or '127.0.0.1' for local only
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
