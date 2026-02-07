import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Pydantic leerá estas variables automáticamente del entorno (.env o Docker)
    DATABASE_URL: str = "sqlite:///./ferreteria.db" # Si existe DB_URL en .env, lo sobreescribe
    ENVIRONMENT: str = "production"
    
    # Security
    SECRET_KEY: str = "temporary_key_for_build"
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

    # Frontend URL
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        # Esto es vital: le dice a Pydantic que busque en el archivo .env
        env_file = ".env"
        extra = "ignore" # Ignora variables extrañas en el .env

settings = Settings()