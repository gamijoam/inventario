"""
Telegram bot for inventory product search.
Uses Google Gemini for natural language understanding
and the backend API for product lookups.
"""

import logging
import time
from typing import Optional

from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from dotenv import load_dotenv
load_dotenv()

from config import (
    TELEGRAM_BOT_TOKEN,
    BACKEND_URL,
    MAX_PRODUCTS_PER_MESSAGE,
    WELCOME_MESSAGE,
)
from gemini_service import GeminiService
from inventory_api import InventoryAPI

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# Per-user rate limiting: chat_id -> last request timestamp
_rate_limit: dict[int, float] = {}
RATE_LIMIT_SECONDS = 2.0

# Conversation context: chat_id -> dict with last search results, etc.
_conversation_context: dict[int, dict] = {}


def _is_rate_limited(chat_id: int) -> bool:
    """Return True if the user should be throttled."""
    now = time.time()
    last = _rate_limit.get(chat_id, 0.0)
    if now - last < RATE_LIMIT_SECONDS:
        return True
    _rate_limit[chat_id] = now
    return False


def _format_product(product: dict) -> str:
    """Build a text block for a single product."""
    name = product.get("name", "Sin nombre")
    price = product.get("price")
    stock = product.get("stock", 0)
    sku = product.get("sku") or product.get("code") or "N/A"

    price_str = f"${price:.2f} USD" if price is not None else "Precio no disponible"
    stock_str = (
        f"\u2705 En stock ({stock})" if stock and stock > 0 else "\u274c Agotado"
    )

    return (
        f"\U0001f4e6 *{_escape_md(name)}*\n"
        f"\U0001f4b2 {_escape_md(price_str)}\n"
        f"\U0001f4ca {_escape_md(stock_str)}\n"
        f"\U0001f3f7\ufe0f SKU: `{_escape_md(sku)}`"
    )


def _escape_md(text: str) -> str:
    """Escape MarkdownV2 special characters."""
    special = r"_*[]()~`>#+-=|{}.!"
    escaped = []
    for ch in str(text):
        if ch in special:
            escaped.append(f"\\{ch}")
        else:
            escaped.append(ch)
    return "".join(escaped)


def _get_image_url(product: dict) -> Optional[str]:
    """Extract the first usable image URL from a product dict."""
    url = product.get("image_url") or product.get("imagen_url") or product.get("image")
    if not url or not isinstance(url, str):
        return None
    if url.startswith("http"):
        return url
    # Relative path — prepend the backend URL
    return f"{BACKEND_URL.rstrip('/')}{url}"


# ── Handlers ────────────────────────────────────────────────────────

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    await update.message.reply_text(WELCOME_MESSAGE)


async def buscar_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /buscar <query> command — direct product search."""
    chat_id = update.effective_chat.id

    if _is_rate_limited(chat_id):
        await update.message.reply_text(
            "\u23f3 Por favor espera unos segundos antes de hacer otra consulta."
        )
        return

    query = " ".join(context.args) if context.args else ""
    if not query.strip():
        await update.message.reply_text(
            "Usa el comando as\u00ed: /buscar cargador USB\\-C",
        )
        return

    await update.message.chat.send_action(ChatAction.TYPING)

    try:
        api = InventoryAPI()
        products = await api.search_products(query)
        await _send_product_results(update, products, query)
    except Exception:
        logger.exception("Error in /buscar command")
        await update.message.reply_text(
            "\u26a0\ufe0f Ocurri\u00f3 un error al buscar productos. Intenta de nuevo m\u00e1s tarde."
        )


async def text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle any plain-text message using Gemini + product search."""
    chat_id = update.effective_chat.id
    user_text = update.message.text or ""

    if _is_rate_limited(chat_id):
        await update.message.reply_text(
            "\u23f3 Por favor espera unos segundos antes de hacer otra consulta."
        )
        return

    await update.message.chat.send_action(ChatAction.TYPING)

    gemini = GeminiService()

    try:
        intent = await gemini.understand_message(user_text)
    except Exception:
        logger.exception("Gemini intent extraction failed")
        await update.message.reply_text(
            "\u26a0\ufe0f No pude procesar tu mensaje. Intenta de nuevo."
        )
        return

    # intent is a dict: {"intent": "search"|"greeting"|"info"|"thanks"|"other", "query"|"response": "..."}
    intent_type = intent.get("intent", "other")
    search_query = intent.get("query", "")

    if intent_type == "search" and search_query:
        try:
            await update.message.chat.send_action(ChatAction.TYPING)
            api = InventoryAPI()
            products = await api.search_products(search_query)
            await _send_product_results(update, products, search_query)
        except Exception:
            logger.exception("Product search failed")
            await update.message.reply_text(
                "\u26a0\ufe0f Ocurri\u00f3 un error al buscar productos. Intenta de nuevo m\u00e1s tarde."
            )
    else:
        # Greeting, info, thanks, or other — use Gemini's response directly
        reply = intent.get("response", "")
        if reply:
            await update.message.reply_text(reply)
        else:
            await update.message.reply_text(
                "No entendí tu mensaje. ¿Puedes reformular tu pregunta?"
            )


async def _send_product_results(
    update: Update,
    products: list[dict],
    query: str,
) -> None:
    """Format and send product results to the user."""
    chat_id = update.effective_chat.id

    # Store in conversation context
    _conversation_context[chat_id] = {
        "last_query": query,
        "last_results": products,
        "timestamp": time.time(),
    }

    if not products:
        gemini = GeminiService()
        try:
            no_results_msg = await gemini.format_no_results(query)
        except Exception:
            no_results_msg = (
                f"\U0001f50d No encontr\u00e9 productos para \"{query}\".\n"
                "Intenta con otras palabras o pregunta de otra forma."
            )
        await update.message.reply_text(no_results_msg)
        return

    limited = products[:MAX_PRODUCTS_PER_MESSAGE]
    total = len(products)

    for product in limited:
        caption = _format_product(product)
        image_url = _get_image_url(product)

        if image_url:
            try:
                await update.message.reply_photo(
                    photo=image_url,
                    caption=caption,
                    parse_mode=ParseMode.MARKDOWN_V2,
                )
                continue
            except Exception:
                logger.warning(
                    "Failed to send photo for product %s, falling back to text",
                    product.get("name"),
                )

        # Fallback: text-only
        await update.message.reply_text(caption, parse_mode=ParseMode.MARKDOWN_V2)

    if total > MAX_PRODUCTS_PER_MESSAGE:
        remaining = total - MAX_PRODUCTS_PER_MESSAGE
        await update.message.reply_text(
            f"\U0001f4cb Mostrando {MAX_PRODUCTS_PER_MESSAGE} de {total} resultados. "
            f"Hay {remaining} producto(s) m\u00e1s. Intenta ser m\u00e1s espec\u00edfico para refinar la b\u00fasqueda."
        )


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Log errors raised by handlers."""
    logger.error("Update %s caused error: %s", update, context.error)


# ── Main ────────────────────────────────────────────────────────────

def main() -> None:
    """Create the bot application and start polling."""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN is not set. Exiting.")
        return

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Commands
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("buscar", buscar_command))

    # Plain text messages (not commands)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_message))

    # Error handler
    app.add_error_handler(error_handler)

    logger.info("Bot starting — polling for updates...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
