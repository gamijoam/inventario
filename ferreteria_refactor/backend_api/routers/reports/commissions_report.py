from fastapi import APIRouter, Depends
from ...dependencies import admin_only

# Commission/employee report endpoints.
# Commission calculation endpoints live in the dedicated commissions router
# (routers/commissions.py). This sub-router is reserved for future
# commission-specific report aggregations that belong under /reports.

router = APIRouter(dependencies=[Depends(admin_only)])
