import logging

import httpx

from config import BACKEND_URL, TENANT_SUBDOMAIN

logger = logging.getLogger(__name__)


class InventoryAPI:
    """HTTP client for the Invensoft backend API."""

    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            base_url=BACKEND_URL,
            timeout=10.0,
            headers={"X-Tenant-ID": TENANT_SUBDOMAIN},
        )

    async def search_products(self, query: str, limit: int = 10) -> list[dict]:
        """Search the product catalog.

        Calls GET /api/v1/products/catalog and returns the list of matching
        products.  Returns an empty list on any error so the bot can degrade
        gracefully.
        """
        try:
            response = await self.client.get(
                "/api/v1/products/catalog",
                params={"search": query, "limit": limit},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("items", [])
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

    async def get_product_image_url(self, product: dict) -> str | None:
        """Return the full image URL for a product, or None."""
        image_url = product.get("image_url")
        if not image_url:
            return None
        if image_url.startswith("http"):
            return image_url
        # Relative path — prepend the backend URL.
        return f"{BACKEND_URL.rstrip('/')}{image_url}"

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
