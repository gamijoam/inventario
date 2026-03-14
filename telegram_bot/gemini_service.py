import json
import logging
import re

import google.genai as genai
from google.genai import types as genai_types

from config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)

# ── System prompt ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Eres el asistente virtual de una tienda de tecnología y electrónica.
Tu única función es ayudar a los clientes a buscar productos disponibles en el inventario.

INSTRUCCIONES:
1. Analiza el mensaje del cliente e identifica qué tipo de respuesta dar.
2. Responde SIEMPRE en JSON válido con esta estructura exacta:

Para búsqueda de productos (uno o varios):
{"intent": "search", "queries": ["término1", "término2"], "sort": null}

Para búsqueda con orden por precio (más barato / más caro):
{"intent": "search", "queries": ["término"], "sort": "price_asc"}   ← más económico/barato
{"intent": "search", "queries": ["término"], "sort": "price_desc"}  ← más caro/premium

Para saludos sin búsqueda:
{"intent": "greeting", "response": "¡Hola! 👋 ¿En qué producto te puedo ayudar hoy?"}

Para despedidas o agradecimientos:
{"intent": "thanks", "response": "¡Con gusto! Cualquier cosa, aquí estaré. 😊"}

REGLAS PARA BÚSQUEDA:
- Preguntas sobre precio, economía, comparaciones → SIEMPRE son "search", nunca "info"
- Extrae la CATEGORÍA del producto si no mencionan modelo específico
- Normaliza modelos: 15C no "15 C", S24 no "S 24", Note 13 sí va separado
- Incluye solo el número de almacenamiento: "256gb" → "256"
- Si preguntan por el más barato/económico → sort: "price_asc"
- Si preguntan por el más caro/premium/mejor → sort: "price_desc"
- Si piden varios productos, inclúyelos TODOS en "queries"

Ejemplos:
  "tiene iphone?" → {"intent": "search", "queries": ["iPhone"], "sort": null}
  "cual es el telefono mas economico?" → {"intent": "search", "queries": ["telefono"], "sort": "price_asc"}
  "cual es el celular mas barato?" → {"intent": "search", "queries": ["celular"], "sort": "price_asc"}
  "que telefono me recomiendas?" → {"intent": "search", "queries": ["telefono"], "sort": "price_asc"}
  "tienen algo económico en teléfonos?" → {"intent": "search", "queries": ["telefono"], "sort": "price_asc"}
  "me muestras todos los telefonos?" → {"intent": "search", "queries": ["telefono"], "sort": null}
  "que celulares tienen?" → {"intent": "search", "queries": ["celular"], "sort": null}
  "cual es el samsung mas caro?" → {"intent": "search", "queries": ["Samsung"], "sort": "price_desc"}
  "hay samsung s24 y iphone 15?" → {"intent": "search", "queries": ["Samsung S24", "iPhone 15"], "sort": null}
  "tiene redmi 15 c de 256 gb" → {"intent": "search", "queries": ["Redmi 15C 256"], "sort": null}
  "precio del redmi note 13" → {"intent": "search", "queries": ["Redmi Note 13"], "sort": null}
  "busco cargadores baratos" → {"intent": "search", "queries": ["cargador"], "sort": "price_asc"}

NUNCA respondas con "info" para preguntas de precio o comparación. SIEMPRE busca.
NUNCA inventes productos ni precios. Solo extrae la búsqueda."""

# ── Helpers ──────────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    """Extract a JSON object from text that may contain markdown fences."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip ```json ... ``` fences
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    # Find first { ... } block
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from Gemini response: {text[:300]}")


def _clean_query_fallback(text: str) -> str:
    """
    Last-resort query cleaner used when Gemini is unavailable.
    Uses word-boundary regex to avoid breaking words like SAMSUNG or IPHONE.
    """
    result = re.sub(r"[¿?¡!.,;:]+", " ", text)
    # Remove greeting words
    result = re.sub(
        r"\b(?:hola|buenos?\s+d[ií]as?|buenas?\s+tardes?|buenas?\s+noches?)\b",
        " ", result, flags=re.IGNORECASE,
    )
    # Remove question/request verbs
    result = re.sub(
        r"\b(?:tienen|tienes?|tiene|hay|venden|busco|quiero|necesito|cu[aá]nto\s+cuestan?|precio\s+de[l]?|características?\s+de[l]?)\b",
        " ", result, flags=re.IGNORECASE,
    )
    # Remove articles and common prepositions
    result = re.sub(
        r"\b(?:un|una|unos|unas|el|la|los|las|de|del|para|con|en|al|por|y|e|o|u)\b",
        " ", result, flags=re.IGNORECASE,
    )
    cleaned = " ".join(result.split()).strip()
    return cleaned or text.strip()


# ── Service class ─────────────────────────────────────────────────────────────

class GeminiService:
    """Wrapper around the Google Gemini API for the Telegram store bot."""

    def __init__(self) -> None:
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.model = GEMINI_MODEL

    async def understand_message(self, user_message: str) -> dict:
        """
        Classify a customer message and extract product search keywords.

        Returns a dict like:
          {"intent": "search", "queries": ["iPhone", "Samsung"]}
          {"intent": "greeting", "response": "¡Hola! ..."}
        """
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=[
                    genai_types.Content(
                        role="user",
                        parts=[genai_types.Part.from_text(text=user_message)],
                    )
                ],
                config=genai_types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.1,
                ),
            )
            result = _extract_json(response.text)
            logger.info("Gemini intent: %s", result)
            return result

        except Exception as exc:
            logger.error("Gemini failed (%s) — using fallback", exc)
            # Fallback: clean query and search directly
            cleaned = _clean_query_fallback(user_message)
            return {"intent": "search", "queries": [cleaned]}
