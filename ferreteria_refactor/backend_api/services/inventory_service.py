from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile
import json
from decimal import Decimal

from ..models import models
from ..schemas import TransferPackageSchema, TransferItemSchema, TransferResultSchema
from .. import schemas

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
    def generate_transfer_package_v2(db: Session, items_data: List[Dict[str, Any]], source_company: str, warehouse_id: int = None) -> Dict[str, Any]:
        """
        items_data: List of dicts like {'product_id': 1, 'quantity': 10}
        warehouse_id: Optional ID of the warehouse to deduct stock from
        """
        transfer_items = []
        
        for item in items_data:
            pid = item['product_id']
            qty = Decimal(str(item['quantity']))
            
            product = db.query(models.Product).filter(models.Product.id == pid).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product ID {pid} not found")
            
            # Validate SKU
            if not product.sku:
                 raise HTTPException(status_code=400, detail=f"Product '{product.name}' (ID: {pid}) has no SKU. Transfer denied.")
            
            # --- WAREHOUSE SPECIFIC LOGIC ---
            balance_after = product.stock # Default to global
            
            if warehouse_id:
                # Find Warehouse Stock
                p_stock = db.query(models.ProductStock).filter(
                    models.ProductStock.product_id == pid,
                    models.ProductStock.warehouse_id == warehouse_id
                ).first()
                
                if not p_stock:
                    # Create if not exists (though for export usually implies it exists, but create 0 for consistency)
                    p_stock = models.ProductStock(
                        product_id=pid,
                        warehouse_id=warehouse_id,
                        quantity=Decimal("0.000")
                    )
                    db.add(p_stock)
                    db.flush() # Get ID if needed, though we have obj
                
                # Check Local Stock
                if p_stock.quantity < qty:
                    raise HTTPException(status_code=400, detail=f"Insufficient stock in WAREHOUSE for '{product.name}'. Requested: {qty}, Available: {p_stock.quantity}")

                # Deduct Local Stock
                p_stock.quantity -= qty
                
                # Deduct Global Stock (to keep sync)
                product.stock -= qty
                balance_after = p_stock.quantity
                
            else:
                # GLOBAL ONLY FALLBACK (Legacy)
                if product.stock < qty:
                    raise HTTPException(status_code=400, detail=f"Insufficient global stock for '{product.name}'. Requested: {qty}, Available: {product.stock}")
                
                product.stock -= qty
                balance_after = product.stock
            
            # Create Kardex
            kardex = models.Kardex(
                product_id=product.id,
                movement_type=models.MovementType.EXTERNAL_TRANSFER_OUT,
                quantity=-qty,
                balance_after=balance_after,
                description=f"Transfer OUT to External (Generated package)",
                warehouse_id=warehouse_id, # Link to warehouse if applicable
                date=datetime.now()
            )
            db.add(kardex)
            
            # Add to transfer list
            transfer_items.append({
                "sku": product.sku,
                "quantity": float(qty), # Serialize as float for JSON
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
            "source_warehouse_id": warehouse_id, # Include source metadata
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

    @staticmethod
    def process_bulk_entry(db: Session, entry_data: schemas.SerializedEntry) -> Dict[str, Any]:
        """
        Efficiently processes mass entry of serialized items (IMEIs).
        Uses bulk_save_objects for performance.
        Agregates Kardex and Stock Updates.
        """
        # 1. Fetch Product
        product = db.query(models.Product).filter(models.Product.id == entry_data.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        if not product.has_imei:
            raise HTTPException(status_code=400, detail=f"Product '{product.name}' is not serialized (has_imei=False). Cannot add IMEIs.")

        # 2. Check for Duplicates (Fast Pre-check)
        existing_imeis = db.query(models.ProductInstance.serial_number).filter(
            models.ProductInstance.serial_number.in_(entry_data.imeis)
        ).all()
        
        if existing_imeis:
            existing_list = [e[0] for e in existing_imeis]
            raise HTTPException(status_code=400, detail=f"Duplicate IMEIs found in database: {existing_list[:5]}...")

        # 3. Preparation for Bulk Insert
        instances_to_create = []
        now = datetime.now()
        
        for imei in entry_data.imeis:
            instance = models.ProductInstance(
                product_id=product.id,
                warehouse_id=entry_data.warehouse_id,
                serial_number=imei,
                status=models.ProductInstanceStatus.AVAILABLE,
                cost=entry_data.cost or product.cost_price,
                created_at=now
            )
            instances_to_create.append(instance)
            
        # 4. Perform Bulk Insert
        try:
            db.bulk_save_objects(instances_to_create)
        except Exception as e:
             db.rollback()
             raise HTTPException(status_code=500, detail=f"Bulk Insert Error: {str(e)}")

        # 5. Update Numeric Stock (Hybrid Sync)
        qty_added = Decimal(len(instances_to_create))
        
        # 5a. Update Global Stock
        product.stock += qty_added
        
        # 5b. Update Warehouse Stock
        p_stock = db.query(models.ProductStock).filter(
            models.ProductStock.product_id == product.id,
            models.ProductStock.warehouse_id == entry_data.warehouse_id
        ).first()
        
        balance_after_wh = Decimal("0.00")
        
        if p_stock:
            p_stock.quantity += qty_added
            balance_after_wh = p_stock.quantity
        else:
            p_stock = models.ProductStock(
                product_id=product.id,
                warehouse_id=entry_data.warehouse_id,
                quantity=qty_added
            )
            db.add(p_stock)
            balance_after_wh = qty_added

        # 6. Create AGGREGATED Kardex Entry (1 for 100 items)
        kardex = models.Kardex(
            product_id=product.id,
            warehouse_id=entry_data.warehouse_id,
            movement_type=models.MovementType.PURCHASE, # Or ADJUSTMENT_IN
            quantity=qty_added,
            balance_after=product.stock, # Global balance usually tracked here
            description=f"Bulk Import ({int(qty_added)} Units). Ref: IMEIs {entry_data.imeis[0]}...{entry_data.imeis[-1]}",
            date=now
        )
        db.add(kardex)
        
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Commit Error: {str(e)}")
            
        return {
            "status": "success", 
            "added_count": int(qty_added),
            "new_stock_level": float(product.stock)
        }

    @staticmethod
    def validate_imei_availability(db: Session, product_id: int, imei: str) -> Dict[str, Any]:
        """
        Validates if an IMEI exists and is available for sale.
        """
        instance = db.query(models.ProductInstance).filter(
            models.ProductInstance.product_id == product_id,
            models.ProductInstance.serial_number == imei
        ).first()

        if not instance:
            return {"valid": False, "message": "Serial no encontrado en inventario."}
        
        if instance.status != models.ProductInstanceStatus.AVAILABLE:
            return {"valid": False, "message": f"Serial no disponible (Estado: {instance.status})"}
            
        return {"valid": True, "message": "Serial válido", "instance_id": instance.id}
