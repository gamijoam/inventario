from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, date as date_type

from ..database.db import get_db
from ..models.models import User, Employee, CommissionLog, CommissionStatus, SaleDetail, Product, CashSession, CashMovement
from ..schemas.employees import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    CommissionResponse, CommissionPayoutRequest, CommissionPayoutResponse
)
from ..dependencies import get_current_user
from ..cache import get_cached, set_cached, invalidate_resource

router = APIRouter(
    prefix="/employees",
    tags=["barbershop", "employees"],
    dependencies=[Depends(get_current_user)]
)


def _invalidate_employees_cache(tenant_id: str):
    try:
        invalidate_resource(tenant_id, "employees")
    except Exception:
        pass


@router.get("", response_model=List[EmployeeResponse])
def get_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant_id = current_user.tenant_id
    """
    Retrieve all employees for the current tenant.
    """
    cached = get_cached(tenant_id, "employees", "all")
    if cached is not None:
        return cached

    employees = db.query(Employee).filter(Employee.tenant_id == tenant_id).all()
    result = [EmployeeResponse.model_validate(employee).model_dump(mode="json") for employee in employees]
    set_cached(tenant_id, "employees", result, "all", ttl=300)
    return result

@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    employee_in: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant_id = current_user.tenant_id
    """
    Register a new employee/barber/stylist.
    """
    new_employee = Employee(
        **employee_in.model_dump(),
        tenant_id=tenant_id
    )
    db.add(new_employee)
    db.flush()
    db.commit()
    _invalidate_employees_cache(tenant_id)
    return new_employee

@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    employee_in: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant_id = current_user.tenant_id
    """
    Update an existing employee.
    """
    employee = db.query(Employee).filter(Employee.id == employee_id, Employee.tenant_id == tenant_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_data = employee_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(employee, key, value)

    db.commit()
    _invalidate_employees_cache(tenant_id)
    return employee

@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant_id = current_user.tenant_id
    """
    Logically delete an employee by setting status to INACTIVE.
    """
    employee = db.query(Employee).filter(Employee.id == employee_id, Employee.tenant_id == tenant_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    employee.status = "INACTIVE"
    db.commit()
    _invalidate_employees_cache(tenant_id)
    return None

@router.get("/commissions", response_model=List[CommissionResponse])
def get_commissions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all commission logs. Uses CommissionLog (general system).
    """
    query = db.query(CommissionLog)

    if status_filter and status_filter != "ALL":
        try:
            query = query.filter(CommissionLog.status == CommissionStatus(status_filter))
        except ValueError:
            pass

    if start_date:
        try:
            sd = date_type.fromisoformat(start_date)
            query = query.filter(CommissionLog.created_at >= datetime.combine(sd, datetime.min.time()))
        except ValueError:
            pass
    if end_date:
        try:
            from datetime import timedelta
            ed = date_type.fromisoformat(end_date)
            query = query.filter(CommissionLog.created_at < datetime.combine(ed + timedelta(days=1), datetime.min.time()))
        except ValueError:
            pass

    logs = query.order_by(CommissionLog.created_at.desc()).all()

    # Map to response with user_name
    results = []
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first()
        results.append(CommissionResponse(
            id=log.id,
            user_id=log.user_id,
            user_name=user.username if user else f"User #{log.user_id}",
            sale_detail_id=log.sale_detail_id,
            source_type=log.source_type,
            amount=log.amount,
            percentage_applied=log.percentage_applied,
            status=log.status.value if hasattr(log.status, 'value') else str(log.status),
            created_at=log.created_at,
            paid_at=log.paid_at,
            notes=log.notes,
        ))
    return results

@router.post("/payout", response_model=CommissionPayoutResponse)
def payout_commissions(
    payout_data: CommissionPayoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Pay selected commissions and record an expense in the cash register.
    """
    tenant_id = current_user.tenant_id
    
    # 1. Fetch the employee
    employee = db.query(Employee).filter(Employee.id == payout_data.employee_id, Employee.tenant_id == tenant_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # 2. Fetch selected pending commissions
    commissions = db.query(Commission).filter(
        Commission.id.in_(payout_data.commission_ids),
        Commission.employee_id == payout_data.employee_id,
        Commission.tenant_id == tenant_id,
        Commission.status == "PENDING"
    ).all()

    if not commissions:
        raise HTTPException(status_code=400, detail="No pending commissions found for the selected IDs")

    total_to_pay = sum(c.calculated_commission for c in commissions)

    # 3. Handle Cash Session (Drawer)
    # We look for the current user's open session
    session = db.query(CashSession).filter(
        CashSession.user_id == current_user.id,
        CashSession.status == "OPEN"
    ).first()

    if not session:
        # Fallback for admins: pick any open session if they don't have their own open
        session = db.query(CashSession).filter(CashSession.status == "OPEN").first()
    
    if not session:
        raise HTTPException(status_code=400, detail="No active cash session found. Open the register first.")

    # 4. Create the Cash Movement (Expense)
    expense = CashMovement(
        session_id=session.id,
        type="EXPENSE",
        amount=total_to_pay,
        currency="USD", # Default to USD for simple logic
        description=f"Pago Comisiones: {employee.name} ({len(commissions)} servicios)",
        reference=payout_data.reference or f"Barbershop Payout {datetime.now().strftime('%Y%m%d')}",
    )
    db.add(expense)
    db.flush() # To get the movement ID

    # 5. Update Commissions Status
    for comm in commissions:
        comm.status = "PAID"

    db.commit()

    return CommissionPayoutResponse(
        success=True,
        paid_count=len(commissions),
        total_paid=total_to_pay,
        movement_id=expense.id,
        message=f"Pagadas {len(commissions)} comisiones a {employee.name} por un total de ${total_to_pay:,.2f}"
    )


@router.post("/commissions/{commission_id}/pay")
def pay_single_commission(
    commission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Pay a single commission log by ID.
    Marks it PAID and generates a cash register expense.
    Requires an open cash session.
    """
    # 1. Fetch commission log
    commission = db.query(CommissionLog).filter(
        CommissionLog.id == commission_id,
        CommissionLog.status == CommissionStatus.PENDING
    ).first()

    if not commission:
        raise HTTPException(
            status_code=404,
            detail="Comisión no encontrada, ya pagada, o no pertenece a este tenant"
        )

    # 2. Fetch associated user
    user = db.query(User).filter(User.id == commission.user_id).first()
    user_name = user.username if user else f"User #{commission.user_id}"

    amount_to_pay = commission.amount

    # 3. Locate open cash session (current user first, fallback to any open)
    session = db.query(CashSession).filter(
        CashSession.user_id == current_user.id,
        CashSession.status == "OPEN"
    ).first()

    if not session:
        session = db.query(CashSession).filter(CashSession.status == "OPEN").first()

    if not session:
        raise HTTPException(
            status_code=400,
            detail="No hay caja abierta. Abra la caja antes de liquidar comisiones."
        )

    # 4. Create cash movement (expense)
    expense = CashMovement(
        session_id=session.id,
        type="EXPENSE",
        amount=float(amount_to_pay),
        currency="USD",
        description=(
            f"Pago Comisión: {user_name} — "
            f"Comisión #{commission_id} — ${float(amount_to_pay):,.2f} "
            f"[{datetime.now().strftime('%Y%m%d-%H%M%S')}]"
        ),
    )
    db.add(expense)
    db.flush()

    # 5. Mark commission as paid
    commission.status = CommissionStatus.PAID
    commission.paid_at = datetime.now()

    db.commit()

    return {
        "success": True,
        "paid_count": 1,
        "total_paid": float(amount_to_pay),
        "movement_id": expense.id,
        "message": f"Comisión pagada a {user_name} por ${float(amount_to_pay):,.2f}"
    }

