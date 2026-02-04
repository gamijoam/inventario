import os
from dotenv import load_dotenv

import sys

# Determine base path for .env
if getattr(sys, 'frozen', False):
    # Valid for PyInstaller compiled executable
    base_path = os.path.dirname(sys.executable)
else:
    # Valid for development script
    base_path = os.path.dirname(os.path.abspath(__file__))

# Try loading from base path (priority)
env_path = os.path.join(base_path, ".env")
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path)
else:
    # Fallback to CWD
    load_dotenv()

class Settings:
    # Support both naming conventions
    DATABASE_URL: str = os.getenv("DB_URL", os.getenv("DATABASE_URL", "sqlite:///./ferreteria.db"))
    
    # Security - CRITICAL: SECRET_KEY must be set in environment
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    if not SECRET_KEY:
        raise ValueError(
            "CRITICAL SECURITY ERROR: SECRET_KEY environment variable is not set.\n"
            "Please generate a secure key using 'python generate_key.py' and add it to your .env file:\n"
            "SECRET_KEY=<your-generated-key-here>"
        )
    
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    
    # Modules
    MODULE_RESTAURANT_ENABLED: bool = os.getenv("MODULE_RESTAURANT_ENABLED", "false").lower() == "true"
    MODULE_SERVICES_ENABLED: bool = os.getenv("MODULE_SERVICES_ENABLED", "false").lower() == "true"
    MODULE_LAUNDRY_ENABLED: bool = os.getenv("MODULE_LAUNDRY_ENABLED", "false").lower() == "true"
    
    # Timezone
    TIMEZONE: str = os.getenv("TIMEZONE", "America/Caracas")

settings = Settings()
