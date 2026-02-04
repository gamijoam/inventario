import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

try:
    from ferreteria_refactor.backend_api.database.db import engine
    print(f"DATABASE URL: {engine.url}")
except Exception as e:
    print(f"Error: {e}")
