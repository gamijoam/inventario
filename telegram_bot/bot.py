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


def _is_rate_limited(chat_id: int) -> bool:
    now = time.time()
    last = _rate_limit.get(chat_id, 0.0)
    if now - last < RATE_LIMIT_SECONDS:
        return True
    _rate_limit[chat_id] = now
    return False


def _to_float(value) -> Optional[float]:
    """Safely convert str/int/float/None to float."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _format_product(product: dict) -> str:
    """Build a Telegram MarkdownV2 block for a single product."""
    name  = product.get("name", "Sin nombre")
    price = _to_float(product.get("price"))
    stock = _to_float(product.get("stock") or 0) or 0
    sku   = product.get("sku") or product.get("code") or "N/A"

    price_str = f"${price:.2f} USD" if price is not None else "Precio no disponible"
    stock_str = f"✅ En stock ({int(stock)})" if stock > 0 else "❌ Agotado"

    return (
        f"📦 *{_escape_md(name)}*\n"
        f"💲 {_escape_md(price_str)}\n"
        f"📊 {_escape_md(stock_str)}\n"
        f"🏷️ SKU: `{_escape_md(sku)}`"
    )


def _escape_md(text: str) -> str:
    """Escape MarkdownV2 special characters."""
    special = r"_*[]()~`>#+-=|{}.!"
    return "".join(f"\\{ch}" if ch in special else ch for ch in str(text))


def _get_image_url(product: dict) -> Optional[str]:
    """Return a usable image URL or None."""
    url = product.get("image_url") or product.get("imagen_url") or product.get("image")
    if not url or not isinstance(url, str):
        return None
    if url.startswith("http"):
        return url
    return f"{BACKEND_URL.rstrip('/')}{url}"


# ── Handlers ─────────────────────────────────────────────────────────

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(WELCOME_MESSAGE)


async def buscar_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /buscar <query> — direct product search, skips Gemini."""
    chat_id = update.effective_chat.id
    if _is_rate_limited(chat_id):
        await update.message.reply_text("⏳ Espera un momento antes de otra consulta.")
        return

    query = " ".join(context.args).strip() if context.args else ""
    if not query:
        await update.message.reply_text("Uso: /buscar <producto>  Ej: /buscar iPhone 13")
        return

    await update.message.chat.send_action(ChatAction.TYPING)
    api = InventoryAPI()
    products = await api.search_products(query)
    await _send_product_results(update, products, query)


async def text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle free-text messages — Gemini extracts intent and queries."""
    chat_id = update.effective_chat.id
    user_text = (update.message.text or "").strip()
    if not user_text:
        return

    if _is_rate_limited(chat_id):
        await update.message.reply_text("⏳ Espera un momento antes de otra consulta.")
        return

    await update.message.chat.send_action(ChatAction.TYPING)

    gemini = GeminiService()
    intent = await gemini.understand_message(user_text)

    intent_type    = intent.get("intent", "search")
    search_queries = intent.get("queries") or []
    sort_order     = intent.get("sort")  # "price_asc" | "price_desc" | null
    budget_min     = intent.get("budget_min")  # float | None
    budget_max     = intent.get("budget_max")  # float | None
    # Support single-query fallback from Gemini
    if not search_queries and intent.get("query"):
        search_queries = [intent["query"]]

    logger.info(
        "Intent: %s | Queries: %s | Sort: %s | Budget: %s-%s",
        intent_type, search_queries, sort_order, budget_min, budget_max,
    )

    if intent_type == "search" and search_queries:
        api = InventoryAPI()
        all_products = []
        searched_terms = []
        # For sorted/budget queries fetch more to have a good pool
        fetch_limit = 30 if (sort_order or budget_min or budget_max) else 5

        for q in search_queries:
            q = q.strip()
            if not q:
                continue
            products = await api.search_products(
                q, limit=fetch_limit, min_price=budget_min, max_price=budget_max,
            )
            if products:
                all_products.extend(products)
                searched_terms.append(q)
            else:
                await update.message.reply_text(
                    f"Busqué *{_escape_md(q)}* pero no encontré nada disponible 😕",
                    parse_mode=ParseMode.MARKDOWN_V2,
                )

        if all_products:
            await _send_product_results(
                update, all_products, " + ".join(searched_terms),
                sort_order=sort_order, budget_min=budget_min, budget_max=budget_max,
            )
        elif not search_queries:
            await update.message.reply_text(
                "🔍 No encontré productos. Intenta con otras palabras."
            )

    elif intent_type in ("greeting", "info", "thanks", "offtopic", "other"):
        reply = intent.get("response", "")
        if reply:
            await update.message.reply_text(reply)
        else:
            await update.message.reply_text(
                "¡Hola! 👋 Puedes preguntarme por cualquier producto. Ej: \"Tienen iPhones?\""
            )
    else:
        # Unknown intent — try searching anyway
        api = InventoryAPI()
        products = await api.search_products(user_text, limit=10)
        await _send_product_results(update, products, user_text)


async def _send_product_results(
    update: Update,
    products: list[dict],
    query: str,
    sort_order: Optional[str] = None,
    budget_min: float | None = None,
    budget_max: float | None = None,
) -> None:
    import random

    if not products:
        intros_no_result = [
            f"Mmm, busqué bien y no encontré nada para *{_escape_md(query)}* 🤔\nIntenta con otras palabras o un modelo diferente\\.",
            f"No tenemos en este momento lo que buscas para *{_escape_md(query)}* 😕\n¿Quieres intentar con otro término?",
            f"Busqué *{_escape_md(query)}* y no hay resultados disponibles 🔍\nPrueba siendo más general o escribe solo la marca\\.",
        ]
        await update.message.reply_text(
            random.choice(intros_no_result),
            parse_mode=ParseMode.MARKDOWN_V2,
        )
        return

    # Deduplicate by product id
    seen = set()
    unique = []
    for p in products:
        pid = p.get("id") or p.get("name")
        if pid not in seen:
            seen.add(pid)
            unique.append(p)

    # Sort by price if requested
    if sort_order in ("price_asc", "price_desc"):
        def price_key(p):
            try:
                return float(p.get("price") or 0)
            except (ValueError, TypeError):
                return 0
        unique.sort(key=price_key, reverse=(sort_order == "price_desc"))
        # For sorted queries only show top results (most relevant)
        show_count = min(3, MAX_PRODUCTS_PER_MESSAGE)
    else:
        show_count = MAX_PRODUCTS_PER_MESSAGE

    limited = unique[:show_count]
    total   = len(unique)

    # Build budget label for intro messages
    budget_label = ""
    if budget_min is not None and budget_max is not None:
        budget_label = f" entre ${int(budget_min)} y ${int(budget_max)}"
    elif budget_max is not None:
        budget_label = f" hasta ${int(budget_max)}"
    elif budget_min is not None:
        budget_label = f" desde ${int(budget_min)}"

    # Humanized intro message — diferente para sorted/budget vs normal
    if budget_label and sort_order == "price_desc":
        intros = [
            f"¡Lo mejor que tenemos{_escape_md(budget_label)}\\! ⭐ 👇",
            f"Estos son los top en *{_escape_md(query)}*{_escape_md(budget_label)} 🏆",
        ]
    elif budget_label:
        intros = [
            f"¡Esto encontré para tu presupuesto{_escape_md(budget_label)}\\! 💰 👇",
            f"Opciones de *{_escape_md(query)}*{_escape_md(budget_label)} 💵 👇",
            f"Con tu presupuesto{_escape_md(budget_label)}, esto es lo que hay en *{_escape_md(query)}* 👇",
        ]
    elif sort_order == "price_asc":
        intros = [
            f"¡Aquí te muestro los más económicos\\! 💰 Ordenados de menor a mayor precio 👇",
            f"Estos son los más baratos que tenemos para *{_escape_md(query)}* 💵",
            f"Mirando lo más accesible en *{_escape_md(query)}*\\.\\.\\. aquí van 👇",
        ]
    elif sort_order == "price_desc":
        intros = [
            f"¡Los más premium que tenemos\\! ⭐ De mayor a menor precio 👇",
            f"Estos son los de gama alta en *{_escape_md(query)}* 🏆",
            f"Lo mejor del inventario en *{_escape_md(query)}* 👇",
        ]
    else:
        intros = [
            f"¡Claro que sí\\! Aquí te muestro lo que encontré para *{_escape_md(query)}* 👇",
            f"Encontré *{total}* resultado\\(s\\) para *{_escape_md(query)}* ✅",
            f"Mira lo que tenemos para *{_escape_md(query)}* 📦",
            f"¡Buena elección\\! Estos son los *{_escape_md(query)}* disponibles 👇",
            f"Aquí están los resultados para *{_escape_md(query)}* 🛍️",
        ]
    await update.message.reply_text(
        random.choice(intros),
        parse_mode=ParseMode.MARKDOWN_V2,
    )

    for product in limited:
        caption   = _format_product(product)
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
                logger.warning("Photo send failed for %s, using text", product.get("name"))

        await update.message.reply_text(caption, parse_mode=ParseMode.MARKDOWN_V2)

    if total > MAX_PRODUCTS_PER_MESSAGE:
        remaining = total - MAX_PRODUCTS_PER_MESSAGE
        await update.message.reply_text(
            f"📋 Mostrando {MAX_PRODUCTS_PER_MESSAGE} de {total} resultados. "
            f"Hay {remaining} más — usa /buscar con términos más específicos."
        )


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.error("Update %s caused error: %s", update, context.error)


# ── Main ─────────────────────────────────────────────────────────────

def main() -> None:
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set. Exiting.")
        return

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start",  start_command))
    app.add_handler(CommandHandler("buscar", buscar_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_message))
    app.add_error_handler(error_handler)

    logger.info("Bot starting — polling for updates...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
