import json
from sqlalchemy.orm import Session
from .models.models import AuditLog

def calculate_diff(before_model, after_model):
    """
    Compares two SQLAlchemy model instances or dictionaries and returns the difference.
    """
    if not before_model and not after_model:
        return None
    
    # CASE 1: Creation (No before)
    if not before_model:
        # Convert model to dict
        data = {c.name: getattr(after_model, c.name) for c in after_model.__table__.columns}
        return json.dumps({"new": data}, default=str)

    # CASE 2: Deletion (No after)
    if not after_model:
        data = {c.name: getattr(before_model, c.name) for c in before_model.__table__.columns}
        return json.dumps({"old": data}, default=str)

    # CASE 3: Update
    changes = {}
    
    # Iterate over columns
    for column in before_model.__table__.columns:
        attr = column.name
        old_val = getattr(before_model, attr)
        new_val = getattr(after_model, attr)
        
        # Simple comparison
        if old_val != new_val:
            changes[attr] = {
                "old": old_val,
                "new": new_val
            }
            
    if not changes:
        return None
        
    return json.dumps(changes, default=str)

def log_action(db: Session, user_id: int, action: str, table_name: str, record_id: int, changes: str = None, ip_address: str = None):
    """
    Creates an Audit Log entry.
    """
    try:
        log = AuditLog(
            user_id=user_id,
            action=action,
            table_name=table_name,
            record_id=record_id,
            changes=changes,
            ip_address=ip_address
        )
        db.add(log)
        # We assume strict commit control in the caller, but for audit logs 
        # specifically, we might want to flush to get ID if needed.
        # Generally, it will be committed along with the main transaction.
        db.flush() 
        db.commit() # Ensure log is persisted immediately 
    except Exception as e:
        print(f"FAILED TO CREATE AUDIT LOG: {e}")
        # Don't crash main app for logging failure
        pass
