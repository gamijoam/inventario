from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database.db import get_db
from ..dependencies import get_current_superuser
from ..models.admin_task import AdminTask, TaskPriority
from ..schemas.admin_task import AdminTaskOut, AdminTaskCreate, AdminTaskUpdate
from ..models.models import User

router = APIRouter(
    prefix="/admin/tasks",
    tags=["Admin Tasks"]
)

@router.get("/", response_model=List[AdminTaskOut])
def list_tasks(
    status_filter: Optional[str] = None, # 'completed', 'pending' or None
    priority: Optional[TaskPriority] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    query = db.query(AdminTask)
    
    if status_filter == 'completed':
        query = query.filter(AdminTask.is_completed == True)
    elif status_filter == 'pending':
        query = query.filter(AdminTask.is_completed == False)
        
    if priority:
        query = query.filter(AdminTask.priority == priority)
        
    # Order by: Pending first, then by Due Date (soonest first), then Priority
    return query.order_by(AdminTask.is_completed.asc(), AdminTask.due_date.asc(), AdminTask.created_at.desc()).all()

@router.post("/", response_model=AdminTaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: AdminTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    new_task = AdminTask(
        title=task_in.title,
        description=task_in.description,
        priority=task_in.priority,
        due_date=task_in.due_date,
        is_completed=task_in.is_completed,
        created_by_id=current_user.id
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@router.patch("/{task_id}", response_model=AdminTaskOut)
def update_task(
    task_id: int,
    task_update: AdminTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    task = db.query(AdminTask).filter(AdminTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    update_data = task_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)
        
    db.commit()
    db.refresh(task)
    return task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    task = db.query(AdminTask).filter(AdminTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    db.delete(task)
    db.commit()
    return None
