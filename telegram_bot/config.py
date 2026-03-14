import os

# Telegram
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

# Google Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# Backend API
BACKEND_URL = os.getenv("BACKEND_URL", "https://emprendimientomaikergimenez.miinventariofacil.com")
TENANT_SUBDOMAIN = os.getenv("TENANT_SUBDOMAIN", "emprendimientomaikergimenez")

# Bot behavior
MAX_PRODUCTS_PER_MESSAGE = int(os.getenv("MAX_PRODUCTS_PER_MESSAGE", "5"))
WELCOME_MESSAGE = os.getenv("WELCOME_MESSAGE",
    "\U0001f44b \u00a1Hola! Soy el asistente virtual de la tienda.\n\n"
    "Puedes preguntarme por cualquier producto, por ejemplo:\n"
    "\u2022 \"Tienen cargadores USB-C?\"\n"
    "\u2022 \"Busco un iPhone\"\n"
    "\u2022 \"Qu\u00e9 pinturas tienen?\"\n"
    "\u2022 \"Cu\u00e1nto cuesta un martillo?\"\n\n"
    "\u00a1Escr\u00edbeme lo que necesites! \U0001f60a"
)
