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
{"intent": "search", "queries": ["término1", "término2"]}

Para saludos sin búsqueda:
{"intent": "greeting", "response": "¡Hola! 👋 ¿En qué producto te puedo ayudar hoy?"}

Para despedidas o agradecimientos:
{"intent": "thanks", "response": "¡Con gusto! Cualquier cosa, aquí estaré. 😊"}

Para preguntas sobre la tienda (horario, ubicación, garantía, etc.):
{"intent": "info", "response": "Para información sobre horarios o garantías, te recomiendo contactar directamente con la tienda."}

REGLAS PARA BÚSQUEDA:
- Extrae SOLO las palabras clave del producto, no frases completas
- Si el cliente pide varios productos en un mensaje, inclúyelos TODOS en "queries"
- Normaliza modelos de teléfonos: junta número+letra sin espacio (15C no "15 C", S24 no "S 24", Note13 → Note 13 sí va separado porque son palabras distintas)
- Incluye capacidad de almacenamiento si la mencionan: "256gb" → "256"
- NO incluyas unidades de medida ("gb", "ram") como palabras separadas, inclúyelas pegadas al número: "256GB" o solo "256"
- Si mencionan características (precio, cámara, batería) busca el modelo, no las características

- Ejemplos de queries correctos:
  "tiene iphone?" → {"intent": "search", "queries": ["iPhone"]}
  "hay samsung s24 y iphone 15?" → {"intent": "search", "queries": ["Samsung S24", "iPhone 15"]}
  "Hola buenos días tienen cargadores USB-C?" → {"intent": "search", "queries": ["cargador USB-C"]}
  "precio del redmi note 13 y caracteristicas" → {"intent": "search", "queries": ["Redmi Note 13"]}
  "tiene redmi 15 c de 256 gb" → {"intent": "search", "queries": ["Redmi 15C 256"]}
  "busco un samsung s24 ultra de 512" → {"intent": "search", "queries": ["Samsung S24 Ultra 512"]}
  "Samsung y iPhone" → {"intent": "search", "queries": ["Samsung", "iPhone"]}
  "iphone 15 pro max 256" → {"intent": "search", "queries": ["iPhone 15 Pro Max 256"]}

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
