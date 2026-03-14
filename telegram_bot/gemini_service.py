import json
import logging
import re

import google.genai as genai
from google.genai import types as genai_types

from config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Eres el asistente virtual de una tienda. Tu trabajo es ayudar a los clientes a encontrar productos.

REGLAS:
1. Siempre responde en español venezolano amigable y profesional.
2. Cuando el cliente pregunta por un producto, extrae las palabras clave de búsqueda.
3. Responde SOLO en formato JSON con esta estructura:
   {"intent": "search", "query": "palabras clave del producto"}
   {"intent": "greeting", "response": "tu respuesta amigable"}
   {"intent": "info", "response": "información sobre horarios, ubicación, etc"}
   {"intent": "thanks", "response": "tu respuesta de despedida"}
   {"intent": "other", "response": "respuesta a lo que preguntó"}

4. Para búsquedas, extrae solo las palabras clave relevantes del producto.
   Ejemplo: "Hola buenas tardes, tienen cargadores para iPhone?" -> {"intent": "search", "query": "cargador iPhone"}
   Ejemplo: "quiero ver pinturas de agua" -> {"intent": "search", "query": "pintura agua"}
   Ejemplo: "cuánto cuesta un martillo?" -> {"intent": "search", "query": "martillo"}

5. Si el cliente saluda sin preguntar por un producto, responde con greeting.
6. Si no estás seguro, asume que es una búsqueda de producto.
7. NUNCA inventes productos ni precios. Solo extrae la búsqueda."""

PRODUCT_FORMAT_PROMPT = """Eres el asistente virtual de una tienda. El cliente buscó: "{query}"

Aquí están los productos encontrados:
{products_json}

Genera una respuesta amigable en español venezolano presentando estos productos.
- Usa emojis con moderación.
- Muestra nombre, precio y disponibilidad de cada producto.
- Si hay precio en USD y en Bs, muestra ambos.
- Sé conciso pero amable.
- NO uses formato markdown, solo texto plano con saltos de línea.
- Al final, invita al cliente a preguntar si necesita más información."""

NO_RESULTS_PROMPT = """Eres el asistente virtual de una tienda. El cliente buscó: "{query}" y no se encontraron resultados.

Genera una respuesta amigable en español venezolano indicando que no encontraste ese producto.
- Sugiere que intente con otros términos de búsqueda.
- Sé breve, amable y servicial.
- NO uses formato markdown, solo texto plano."""

EMPTY_SUGGEST_PROMPT = """Eres el asistente virtual de una tienda. El cliente buscó: "{query}" pero no hay productos que coincidan.

Genera una respuesta corta y amigable en español venezolano:
- Indica que no encontraste resultados exactos.
- Sugiere buscar con otras palabras o ser más específico.
- Sé breve y servicial."""


def _extract_json(text: str) -> dict:
    """Extract a JSON object from text that may contain markdown fences."""
    # Try raw parse first
    text_stripped = text.strip()
    try:
        return json.loads(text_stripped)
    except json.JSONDecodeError:
        pass

    # Strip markdown ```json ... ``` fences
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text_stripped, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Last resort: find the first { ... } block
    match = re.search(r"\{.*\}", text_stripped, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract JSON from: {text_stripped[:200]}")


class GeminiService:
    """Wrapper around the Google Gemini API for the Telegram store bot."""

    def __init__(self) -> None:
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.model = GEMINI_MODEL

    async def understand_message(
        self, user_message: str, context: list | None = None
    ) -> dict:
        """Classify a customer message and extract search keywords if applicable.

        Args:
            user_message: The raw text the customer sent.
            context: Optional list of previous message dicts for conversation
                     continuity. Each dict should have ``role`` ("user" or
                     "model") and ``parts`` keys.

        Returns:
            A dict with at least ``intent`` and either ``query`` or
            ``response`` depending on the intent.
        """
        contents: list = []

        if context:
            for msg in context:
                contents.append(
                    genai_types.Content(
                        role=msg.get("role", "user"),
                        parts=[genai_types.Part.from_text(text=msg.get("text", ""))],
                    )
                )

        contents.append(
            genai_types.Content(
                role="user",
                parts=[genai_types.Part.from_text(text=user_message)],
            )
        )

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=genai_types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.3,
                ),
            )

            result = _extract_json(response.text)
            logger.debug("Gemini understood message as: %s", result)
            return result

        except Exception as exc:
            logger.error("Gemini understand_message failed: %s", exc)
            # Fallback: treat entire message as a product search
            return {"intent": "search", "query": user_message}

    async def format_product_response(
        self, products: list, original_query: str
    ) -> str:
        """Ask Gemini to present a list of products in a friendly way.

        Args:
            products: List of product dicts coming from the backend.
            original_query: The search terms the customer used.

        Returns:
            A human-friendly string ready to be sent back to the customer.
        """
        if not products:
            return await self._generate_text(
                EMPTY_SUGGEST_PROMPT.format(query=original_query)
            )

        prompt = PRODUCT_FORMAT_PROMPT.format(
            query=original_query,
            products_json=json.dumps(products, ensure_ascii=False, indent=2),
        )
        return await self._generate_text(prompt)

    async def format_no_results(self, query: str) -> str:
        """Return a friendly 'nothing found' message for the given query."""
        return await self._generate_text(
            NO_RESULTS_PROMPT.format(query=query)
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _generate_text(self, prompt: str) -> str:
        """Send a single prompt to Gemini and return the plain-text answer."""
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=[
                    genai_types.Content(
                        role="user",
                        parts=[genai_types.Part.from_text(text=prompt)],
                    )
                ],
                config=genai_types.GenerateContentConfig(
                    temperature=0.7,
                ),
            )
            return response.text.strip()
        except Exception as exc:
            logger.error("Gemini _generate_text failed: %s", exc)
            return (
                "Disculpa, tuve un problema generando la respuesta. "
                "Por favor intenta de nuevo."
            )
