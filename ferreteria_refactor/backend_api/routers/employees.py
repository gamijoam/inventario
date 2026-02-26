from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List

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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant_id = current_user.tenant_id
    """
    Retrieve all barbershop commissions for the current tenant.
    """
    # Simply order by recent
    commissions = db.query(Commission).filter(Commission.tenant_id == tenant_id).order_by(Commission.created_at.desc()).all()
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

