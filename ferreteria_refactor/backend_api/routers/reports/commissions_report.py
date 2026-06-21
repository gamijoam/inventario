from fastapi import APIRouter, Depends
from ...dependencies import require_any_permission

# Commission/employee report endpoints.
# Commission calculation endpoints live in the dedicated commissions router
# (routers/commissions.py). This sub-router is reserved for future
# commission-specific report aggregations that belong under /reports.

router = APIRouter(dependencies=[Depends(require_any_permission([
    "reports.view",
    "reports.commissions.view",
]))])
