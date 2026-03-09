import os
from typing import Optional
from pydantic_settings import BaseSettings
from pathlib import Path

# Get the directory where this config.py file is located
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    # Pydantic leerá estas variables automáticamente del entorno (.env o Docker)
    # IMPORTANT: No default value. Must be a PostgreSQL URL (postgresql://...).
    # The application will fail to start if DATABASE_URL is not set.
    DATABASE_URL: str
    ENVIRONMENT: str = "production"
    APP_DOMAIN: str = "miinventariofacil.com"
    PROTOCOL: str = "https"
    
    # Security
    # IMPORTANT: No default value. The application will fail to start if SECRET_KEY
    # is not set in the environment or .env file. Generate with:
    #   python -c "import secrets; print(secrets.token_urlsafe(64))"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440 # 24 hours
    
    # Modules
    MODULE_RESTAURANT_ENABLED: bool = False
    MODULE_SERVICES_ENABLED: bool = False
    MODULE_LAUNDRY_ENABLED: bool = False
    
    # Timezone
    TIMEZONE: str = "America/Caracas"

    # Cookies
    COOKIE_DOMAIN: Optional[str] = None
    SECURE_COOKIES: bool = False # Default to False for dev, should be True in Prod via ENV
    
    # Media Storage
    MEDIA_ROOT: str = "/app/media"
    
    # Feature Flags
    ENABLE_LOCAL_SYNC: bool = False  # Disable local sync to prevent 400 errors in QA/Production

    # Email / SMTP Settings
    # Quitamos el '= None' para forzar a Pydantic a buscar en el entorno
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: Optional[str] = None
    EMAILS_FROM_NAME: str = "Inventario Fácil"
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False

    # CORS
    CORS_ORIGINS: str = ""  # Comma-separated extra origins

    # Frontend URL
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        # Use absolute path to .env file in backend_api directory
        env_file = str(ENV_FILE)
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()