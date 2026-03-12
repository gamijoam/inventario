from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, date as date_type

from ..database.db import get_db
from ..models.models import User, Employee, Commission, SaleDetail, Product, CashSession, CashMovement
from ..schemas.employees import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    CommissionResponse, CommissionPayoutRequest, CommissionPayoutResponse
)
from ..dependencies import get_current_user

router = APIRouter(
    prefix="/employees",
    tags=["barbershop", "employees"],
    dependencies=[Depends(get_current_user)]
)

@router.get("", response_model=List[EmployeeResponse])
def get_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant_id = current_user.tenant_id
    """
    Retrieve all employees for the current tenant.
    """
    employees = db.query(Employee).filter(Employee.tenant_id == tenant_id).all()
    return employees

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
    db.commit()
    db.refresh(new_employee)
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
    db.refresh(employee)
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
    return None

@router.get("/commissions", response_model=List[CommissionResponse])
def get_commissions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant_id = current_user.tenant_id
    """
    Retrieve all barbershop commissions for the current tenant.
    Optionally filter by date range (start_date, end_date in YYYY-MM-DD).
    """
    query = db.query(Commission).filter(Commission.tenant_id == tenant_id)

    # Date range filter on created_at
    if start_date:
        try:
            sd = date_type.fromisoformat(start_date)
            query = query.filter(Commission.created_at >= datetime.combine(sd, datetime.min.time()))
        except ValueError:
            pass
    if end_date:
        try:
            from datetime import timedelta
            ed = date_type.fromisoformat(end_date)
            query = query.filter(Commission.created_at < datetime.combine(ed + timedelta(days=1), datetime.min.time()))
        except ValueError:
            pass

    commissions = query.order_by(Commission.created_at.desc()).all()
    return commissions

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


@router.post("/commissions/{commission_id}/pay", response_model=CommissionPayoutResponse)
def pay_single_commission(
    commission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fase 3 — Pay a single barbershop commission by ID.
    Marks it PAID and generates a cash register expense.
    Requires an open cash session.
    """
    tenant_id = current_user.tenant_id

    # 1. Fetch commission belonging to this tenant
    commission = db.query(Commission).filter(
        Commission.id == commission_id,
        Commission.tenant_id == tenant_id,
        Commission.status == "PENDING"
    ).first()

    if not commission:
        raise HTTPException(
            status_code=404,
            detail="Comisión no encontrada, ya pagada, o no pertenece a este tenant"
        )

    # 2. Fetch associated employee
    employee = db.query(Employee).filter(
        Employee.id == commission.employee_id,
        Employee.tenant_id == tenant_id
    ).first()

    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    amount_to_pay = commission.calculated_commission

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
            f"Pago Comisión: {employee.name} — "
            f"Comisión #{commission_id} — ${float(amount_to_pay):,.2f} "
            f"[{datetime.now().strftime('%Y%m%d-%H%M%S')}]"
        ),
    )
    db.add(expense)
    db.flush()

    # 5. Mark commission as paid
    commission.status = "PAID"

    db.commit()

    return CommissionPayoutResponse(
        success=True,
        paid_count=1,
        total_paid=amount_to_pay,
        movement_id=expense.id,
        message=f"Comisión pagada a {employee.name} por ${float(amount_to_pay):,.2f}"
    )

