from fastapi import APIRouter
from .sales_report import router as sales_router
from .inventory_report import router as inventory_router
from .cash_report import router as cash_router
from .commissions_report import router as commissions_router

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
)

router.include_router(sales_router)
router.include_router(inventory_router)
router.include_router(cash_router)
router.include_router(commissions_router)
from .intelligence_report import router as intelligence_router
router.include_router(intelligence_router)
