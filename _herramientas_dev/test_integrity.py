import sys
import os

print("🔍 Testing Imports...")

try:
    print("1. Importing settings...")
    # Provide a dummy SECRET_KEY so Settings() does not raise a validation error
    # during import-only testing. This value is NEVER used to sign real tokens.
    # Do NOT copy this pattern into any production code path.
    if "SECRET_KEY" not in os.environ:
        os.environ["SECRET_KEY"] = "integrity-test-only-not-for-signing-" + "x" * 32
    
    print("2. Importing models...")
    from ferreteria_refactor.backend_api.models import models
    print("✅ Models imported.")

    print("3. Importing schemas...")
    from ferreteria_refactor.backend_api import schemas
    print("✅ Schemas imported.")

    print("4. Importing sync_client...")
    from ferreteria_refactor.backend_api.services import sync_client
    print("✅ SyncClient imported.")

    print("5. Importing main...")
    from ferreteria_refactor.backend_api import main
    print("✅ Main app imported.")

    print("🎉 All imports successful. Code structure is valid.")

except ImportError as e:
    print(f"❌ ImportError: {e}")
except IndentationError as e:
    print(f"❌ IndentationError: {e}")
except Exception as e:
    print(f"❌ Unexpected Error: {e}")
    import traceback
    traceback.print_exc()
