import os
from typing import Optional
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
    load_dotenv(dotenv_path=env_path, override=True)
else:
    # Fallback to CWD
    load_dotenv(override=True)

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Support both naming conventions
    DATABASE_URL: str = os.getenv("DB_URL", "sqlite:///./ferreteria.db")
    ENVIRONMENT: str = "production"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "temporary_key_for_build")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Modules
    MODULE_RESTAURANT_ENABLED: bool = False
    MODULE_SERVICES_ENABLED: bool = False
    MODULE_LAUNDRY_ENABLED: bool = False
    
    # Timezone
    TIMEZONE: str = "America/Caracas"

    # Cookies
    COOKIE_DOMAIN: Optional[str] = None
    SECURE_COOKIES: bool = True
    
    # Media Storage
    MEDIA_ROOT: str = "/app/media" if os.getenv("DOCKER_CONTAINER") else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "media")

    # Email / SMTP Settings (Real Connection)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: Optional[str] = None
    EMAILS_FROM_NAME: str = "Inventario Fácil"
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False

    # Frontend URL
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        # Permite cargar variables del sistema si no están en .env
        case_sensitive = True

settings = Settings()
