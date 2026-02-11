
import sys
import os
import inspect
from typing import get_origin, get_args, Optional, Union

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import Models and Schemas
from backend_api.models import models, tenant, payment
from backend_api.schemas import tenant as tenant_schemas
from backend_api import schemas # Imports from __init__.py
print(f"DEBUG: Loaded schemas from {schemas.__file__}")

def get_pydantic_fields(pydantic_model):
    """Reflect Pydantic fields and their optionality."""
    fields = {}
    for name, field in pydantic_model.model_fields.items():
        is_optional = False
        # Check if type is Optional manually or via annotation
        # Pydantic v2 uses annotation
        annotation = field.annotation
        if get_origin(annotation) is Union and type(None) in get_args(annotation):
            is_optional = True
            
        if name == 'is_active':
             print(f"   DEBUG: is_active -> Annotation: {annotation}, Required: {field.is_required()}, Origin: {get_origin(annotation)}")

        fields[name] = {
            'type': annotation,
            'required': field.is_required(),
            'nullable': is_optional
        }
    return fields

def get_sqlalchemy_columns(sqla_model):
    """Reflect SQLAlchemy columns and their nullability."""
    columns = {}
    for col in sqla_model.__table__.columns:
        columns[col.name] = {
            'type': col.type,
            'nullable': col.nullable,
            'default': col.default
        }
    return columns

def compare_models(sqla_model, pydantic_model, model_name):
    print(f"\n🔍 Auditing {model_name}...")
    
    sqla_cols = get_sqlalchemy_columns(sqla_model)
    pyd_fields = get_pydantic_fields(pydantic_model)
    
    issues = 0
    
    # 1. Check DB Columns vs Pydantic Fields
    for col_name, col_info in sqla_cols.items():
        if col_name not in pyd_fields:
            # Skip internal columns often not in schemas
            if col_name not in ['id', 'created_at', 'updated_at', 'tenant_id']:
                # print(f"   ℹ️ Column '{col_name}' in DB but not in Pydantic (Verify if intended)")
                pass
            continue
            
        pyd_info = pyd_fields[col_name]
        
        # Check Nullability Mismatch
        # Case A: DB is NULLABLE, Pydantic is REQUIRED -> Crash if DB has nulls
        if col_info['nullable'] and pyd_info['required'] and not pyd_info['nullable']:
             print(f"   🚩 [CRITICAL] '{col_name}' is NULLABLE in DB but REQUIRED in Pydantic.")
             print(f"       DB: {col_info['type']} (Nullable: True)")
             print(f"       API: {pyd_info['type']}")
             issues += 1

        # Case B: DB is NOT NULL, Pydantic is OPTIONAL -> Crash on Insert if no default
        if not col_info['nullable'] and not pyd_info['required'] and col_info['default'] is None:
             # This is complex because Pydantic might validly treat it as optional if the logic fills it
             # But it's a risk area.
             # print(f"   ⚠️ [RISK] '{col_name}' is NOT NULL in DB but OPTIONAL in Pydantic (No DB Default).")
             pass

    if issues == 0:
        print("   ✅ No critical discrepancies found.")

def main():
    print("🛡️ STARTING MODEL AUDIT 🛡️")
    
    # Define pairs to check
    # Structure: (SQLAlchemy Model, Pydantic Schema, Description)
    pairs = [
        # Tenant
        (tenant.Tenant, tenant_schemas.TenantOut, "Tenant (Read)"),
        (tenant.Tenant, tenant_schemas.TenantCreate, "Tenant (Create)"),
        
        # Product
        (models.Product, schemas.ProductBase, "Product (Base)"),
        
        # User
        (models.User, schemas.UserCreate, "User (Create)"),
        (models.User, schemas.UserRead, "User (Read)"),
        
        # Supplier
        (models.Supplier, schemas.SupplierBase, "Supplier (Base)"),
    ]
    
    for sqla, pyd, name in pairs:
        compare_models(sqla, pyd, name)

if __name__ == "__main__":
    main()
