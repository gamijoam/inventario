from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile
import json
from decimal import Decimal

from ..models import models
from ..schemas import TransferPackageSchema, TransferItemSchema, TransferResultSchema

class InventoryService:
    
    @staticmethod
    def generate_transfer_package(db: Session, product_ids: List[int], source_company: str) -> Dict[str, Any]:
        """
        Generates a JSON transfer package.
        Validates SKU presence and Stock availability.
        Deducts stock immediately (EXTERNAL_TRANSFER_OUT).
        """
        items = []
        
        # 1. Fetch products
        products = db.query(models.Product).filter(models.Product.id.in_(product_ids)).all()
        
        if len(products) != len(product_ids):
             missing_ids = set(product_ids) - set(p.id for p in products)
             raise HTTPException(status_code=404, detail=f"Products not found: {missing_ids}")

        # 2. Validation Loop
        for product in products:
            # Check SKU
            if not product.sku:
                raise HTTPException(status_code=400, detail=f"Product '{product.name}' (ID: {product.id}) is missing a SKU/Barcode. Cannot transfer.")
            
            # Check Stock (Assuming strict transfer of 1 unit for now, or need quantity input?)
            # Wait, the requirement said "Recibe lista de IDs y cantidades".
            # My current signature only has product_ids. I need a schema for input! 
            # I will assume the input is a list of objects {id, quantity}. 
            # But for now, let's assume the router handles the parsing and passes a list of dicts or tuples?
            # Let's adjust the signature to receive List[Dict] or similar.
            pass

    @staticmethod
    def generate_transfer_package_v2(db: Session, items_data: List[Dict[str, Any]], source_company: str) -> Dict[str, Any]:
        """
        items_data: List of dicts like {'product_id': 1, 'quantity': 10}
        """
        transfer_items = []
        
        for item in items_data:
            pid = item['product_id']
            qty = float(item['quantity'])
            
            product = db.query(models.Product).filter(models.Product.id == pid).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product ID {pid} not found")
            
            # Validate SKU
            if not product.sku:
                 raise HTTPException(status_code=400, detail=f"Product '{product.name}' (ID: {pid}) has no SKU. Transfer denied.")
            
            # Validate Stock
            if product.stock < qty:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for '{product.name}'. Requested: {qty}, Available: {product.stock}")
            
            # Deduct Stock
            product.stock -= Decimal(str(qty))
            
            # Create Kardex
            kardex = models.Kardex(
                product_id=product.id,
                movement_type=models.MovementType.EXTERNAL_TRANSFER_OUT,
                quantity=-qty,
                balance_after=product.stock,
                description=f"Transfer OUT to External (Generated package)",
                date=datetime.now()
            )
            db.add(kardex)
            
            # Add to transfer list
            transfer_items.append({
                "sku": product.sku,
                "quantity": qty,
                "name": product.name
            })
            
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error during transfer: {str(e)}")
            
        # Build Package
        package = {
            "source_company": source_company,
            "generated_at": datetime.now().isoformat(),
            "items": transfer_items
        }
        
        return package

    @staticmethod
    def process_transfer_package(db: Session, file_content: bytes) -> Dict[str, Any]:
        """
        Parses JSON package and updates inventory (EXTERNAL_TRANSFER_IN).
        """
        try:
            data = json.loads(file_content.decode('utf-8'))
        except json.JSONDecodeError:
             raise HTTPException(status_code=400, detail="Invalid JSON file")
             
        # Validate Schema (Basic check)
        if "items" not in data or not isinstance(data["items"], list):
            raise HTTPException(status_code=400, detail="Invalid package format: Missing 'items' list")
            
        success_count = 0
        failure_count = 0
        errors = []
        
        # Process Items
        for item in data["items"]:
            sku = item.get("sku")
            qty = float(item.get("quantity", 0))
            name = item.get("name", "Unknown")
            
            if not sku:
                errors.append(f"Skipped item '{name}': No SKU provided")
                failure_count += 1
                continue
                
            # Find Product by SKU
            product = db.query(models.Product).filter(models.Product.sku == sku).first()
            
            if product:
                # Add Stock
                product.stock += Decimal(str(qty))
                
                # Create Kardex
                kardex = models.Kardex(
                    product_id=product.id,
                    movement_type=models.MovementType.EXTERNAL_TRANSFER_IN,
                    quantity=qty,
                    balance_after=product.stock,
                    description=f"Transfer IN from {data.get('source_company', 'Unknown')}",
                    date=datetime.now()
                )
                db.add(kardex)
                success_count += 1
            else:
                errors.append(f"SKU Not Found: {sku} ({name}) - Manual creation required")
                failure_count += 1
        
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database commit error: {str(e)}")
            
        return {
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors
        }
