from .products import router as products_router
from .customers import router as customers_router
from .quotes import router as quotes_router
from .cash import router as cash_router
from .suppliers import router as suppliers_router
from .inventory import router as inventory_router
from .returns import router as returns_router
from .reports import router as reports_router
from .purchases import router as purchases_router
from .users import router as users_router
from .config import router as config_router
from .auth import router as auth_router
from .categories import router as categories_router
from .websocket import router as websocket_router
from .audit import router as audit_router
from .system import router as system_router

# Export objects for easier import
products = products_router
customers = customers_router
quotes = quotes_router
cash = cash_router
suppliers = suppliers_router
inventory = inventory_router
returns = returns_router
reports = reports_router
purchases = purchases_router
users = users_router
config = config_router
auth = auth_router
categories = categories_router
websocket = websocket_router
audit = audit_router
system = system_router
