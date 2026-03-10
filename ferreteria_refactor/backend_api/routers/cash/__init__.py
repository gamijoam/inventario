"""
routers/cash/__init__.py

Combina los tres sub-routers del módulo de Caja en un único APIRouter
con el mismo prefix ("/cash") y tag ("Caja") que el archivo original,
garantizando compatibilidad total con main.py.

Sub-módulos:
  - sessions   → cajas físicas (CashRegister) + apertura/cierre de sesión
  - movements  → ingresos, egresos, adelantos y balance de cajón
  - reports    → historial, detalles de sesión y payload Cierre-Z
"""
from fastapi import APIRouter

from .sessions import router as sessions_router
from .movements import router as movements_router
from .reports import router as reports_router

router = APIRouter(
    prefix="/cash",
    tags=["Caja"]
)

router.include_router(sessions_router)
router.include_router(movements_router)
router.include_router(reports_router)
