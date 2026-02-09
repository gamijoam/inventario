
import sys
import os

# Add project root to sys.path
sys.path.append(os.getcwd())

print("Attempting to import metadata_split...")
try:
    from backend_api.database import metadata_split
    print("Import successful!")
except ImportError as e:
    print(f"ImportError: {e}")
    import traceback
    traceback.print_exc()
except Exception as e:
    print(f"An error occurred: {e}")
    import traceback
    traceback.print_exc()
