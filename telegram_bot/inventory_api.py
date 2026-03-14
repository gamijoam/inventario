import logging

import httpx

from config import BACKEND_URL, TENANT_SUBDOMAIN

logger = logging.getLogger(__name__)

# Palabras genéricas que no existen en nombres de productos.
# Se mapean a términos reales o a búsqueda vacía (todo el catálogo).
_GENERIC_TERMS: dict[str, str] = {
    # Teléfonos
    "telefono": "", "teléfono": "", "telefonos": "", "teléfonos": "",
    "celular": "", "celulares": "",
    "movil": "", "móvil": "", "moviles": "", "móviles": "",
    "smartphone": "", "smartphones": "",
    # Accesorios
    "accesorio": "", "accesorios": "",
    # Cargadores (sí existen en la BD como "cargador", dejar pasar)
}


class InventoryAPI:
    """HTTP client for the Invensoft backend API."""

    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            base_url=BACKEND_URL,
            timeout=10.0,
            headers={"X-Tenant-ID": TENANT_SUBDOMAIN},
        )

    async def search_products(self, query: str, limit: int = 20) -> list[dict]:
        """
        Search the product catalog with multi-token AND filtering.

        Strategy (works with current production backend):
          1. Send the first significant token to the backend (broad search)
          2. Filter results client-side so ALL tokens appear in name or SKU

        Example: "Redmi 15C 256"
          → backend: search=Redmi (gets all Redmi products)
          → client filter: keep only those containing "15C" AND "256"
        """
        tokens = [t.strip() for t in query.split() if t.strip()]
        if not tokens:
            return []

        # Resolve generic category words → real search terms
        # e.g. "telefono" → "" (search all), keeping other tokens as client-side filter
        first = tokens[0].lower()
        if first in _GENERIC_TERMS:
            primary_token = _GENERIC_TERMS[first]  # "" means fetch all
            remaining_tokens = tokens[1:]          # still filter by rest
        else:
            primary_token = tokens[0]
            remaining_tokens = tokens[1:]

        try:
            params: dict = {"limit": limit}
            if primary_token:  # Don't send empty search param
                params["search"] = primary_token

            response = await self.client.get(
                "/api/v1/products/catalog",
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            products = data.get("items", [])

            # Client-side AND filter for the remaining tokens
            if remaining_tokens:
                products = [
                    p for p in products
                    if _product_matches_all_tokens(p, remaining_tokens)
                ]

            return products

        except httpx.HTTPStatusError as exc:
            logger.error(
                "Backend returned %s when searching '%s': %s",
                exc.response.status_code,
                query,
                exc.response.text[:200],
            )
            return []
        except Exception as exc:
            logger.error("Error searching products for '%s': %s", query, exc)
            return []

    async def get_store_info(self) -> dict | None:
        """Fetch public store configuration (name, modules, etc.)."""
        try:
            response = await self.client.get("/api/v1/config/public")
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.error("Error fetching store info: %s", exc)
            return None

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self.client.aclose()


def _product_matches_all_tokens(product: dict, tokens: list[str]) -> bool:
    """Return True if ALL tokens appear in the product name or SKU (case-insensitive)."""
    searchable = (
        (product.get("name") or "") + " " + (product.get("sku") or "")
    ).lower()
    return all(t.lower() in searchable for t in tokens)
