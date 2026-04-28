from sqlalchemy.orm import Session
from sqlalchemy import text
import asyncio
import logging
import json
import re
from typing import List, Dict, Any
from decimal import Decimal
from datetime import datetime
from typing import Dict, Any
from ..models import models
from ..models.restaurant import RestaurantRecipe, ProductModifierOption, RestaurantOrderItem, RestaurantOrder, OrderStatusDB
from ..utils.time_utils import get_venezuela_now
from fastapi import HTTPException

class InventoryService:
    @staticmethod
    def get_product_availability(db: Session, product_id: int, warehouse_id: int = None) -> dict:
        """
        Retorna disponibilidad real de un producto considerando:
        - Stock total en ProductStock
        - Reservas en RestaurantOrderItem (órdenes activas no cobradas)
        - Si tiene receta (escandallo), calcula disponibilidad basada en ingredientes
        """
        if not warehouse_id:
            warehouse = db.query(models.Warehouse).filter(models.Warehouse.is_main == True).first()
            if not warehouse:
                warehouse = db.query(models.Warehouse).filter(models.Warehouse.is_active == True).first()
            warehouse_id = warehouse.id if warehouse else None

        if not warehouse_id:
            return {"product_id": product_id, "stock_total": 0, "stock_reserved": 0, "stock_available": 0, "warehouse_id": None}

        stock_entry = db.query(models.ProductStock).filter(
            models.ProductStock.product_id == product_id,
            models.ProductStock.warehouse_id == warehouse_id
        ).first()
        stock_total = float(stock_entry.quantity) if stock_entry else 0.0

        recipes = db.query(RestaurantRecipe).filter(RestaurantRecipe.product_id == product_id).all()

        if recipes:
            min_dishes = float('inf')
            for recipe_item in recipes:
                ingredient_stock_entry = db.query(models.ProductStock).filter(
                    models.ProductStock.product_id == recipe_item.ingredient_id,
                    models.ProductStock.warehouse_id == warehouse_id
                ).first()
                ing_qty = float(ingredient_stock_entry.quantity) if ingredient_stock_entry else 0.0
                if recipe_item.quantity > 0:
                    dishes_possible = ing_qty / float(recipe_item.quantity)
                    min_dishes = min(min_dishes, dishes_possible)
            stock_total = min_dishes if min_dishes != float('inf') else 0.0

        reserved_query = db.query(RestaurantOrderItem).join(RestaurantOrder).filter(
            RestaurantOrderItem.product_id == product_id,
            RestaurantOrder.status.notin_([OrderStatusDB.PAID, OrderStatusDB.CANCELLED]),
            RestaurantOrderItem.stock_deducted == False
        )
        stock_reserved = sum(float(item.quantity) for item in reserved_query.all())

        stock_available = max(0.0, stock_total - stock_reserved)

        return {
            "product_id": product_id,
            "stock_total": stock_total,
            "stock_reserved": stock_reserved,
            "stock_available": stock_available,
            "warehouse_id": warehouse_id
        }

    @staticmethod
    def reverse_stock_for_item(db: Session, order_item) -> bool:
        """
        Reversa el stock de un RestaurantOrderItem cuando se cancela/elimina.
        Retorna True si se reversó exitosamente.
        Raises ValueError if no warehouse is configured.
        """
        if not order_item.stock_deducted:
            return False

        product = db.query(models.Product).filter(models.Product.id == order_item.product_id).first()
        if not product or product.is_service:
            return False

        warehouse = db.query(models.Warehouse).filter(models.Warehouse.is_main == True).first()
        if not warehouse:
            warehouse = db.query(models.Warehouse).filter(models.Warehouse.is_active == True).first()
        if not warehouse:
            raise ValueError(f"No hay almacén configurado para revertir stock del producto '{product.name}'")

        recipes = db.query(RestaurantRecipe).filter(RestaurantRecipe.product_id == product.id).all()
        qty = float(order_item.quantity)

        if recipes:
            for recipe_item in recipes:
                ingredient = db.query(models.Product).filter(models.Product.id == recipe_item.ingredient_id).first()
                if not ingredient: continue
                reverse_qty = Decimal(str(qty)) * Decimal(str(recipe_item.quantity))
                InventoryService._apply_reverse(db, ingredient, reverse_qty, warehouse.id, f"Cancelado: {product.name} (Orden #{order_item.order_id})")
        else:
            InventoryService._apply_reverse(db, product, Decimal(str(qty)), warehouse.id, f"Cancelado: {product.name} (Orden #{order_item.order_id})")

        order_item.stock_deducted = False
        return True

    @staticmethod
    def _apply_reverse(db: Session, product, quantity: Decimal, warehouse_id: int, description: str):
        stock_entry = db.query(models.ProductStock).filter(
            models.ProductStock.product_id == product.id,
            models.ProductStock.warehouse_id == warehouse_id
        ).first()

        if not stock_entry:
            stock_entry = models.ProductStock(product_id=product.id, warehouse_id=warehouse_id, quantity=0)
            db.add(stock_entry)
            db.flush()

        stock_entry.quantity += quantity
        product.stock += quantity

        db.add(models.Kardex(
            product_id=product.id,
            movement_type="SALE_REVERSED",
            quantity=quantity,
            balance_after=product.stock,
            description=description
        ))

    @staticmethod
    def deduct_order_items_stock(db: Session, order_items: list, warehouse_id: int, removed_ingredients_map: dict = None):
        """
        Deduce el stock de una lista de RestaurantOrderItem de forma inmediata.
        Maneja recetas y modificadores.
        removed_ingredients_map: {product_id: [ingredient_id, ...]} - ingredientes a skippear
        """
        for item in order_items:
            if item.stock_deducted:
                continue

            product = db.query(models.Product).filter(models.Product.id == item.product_id).with_for_update().first()
            if not product:
                continue

            # 1. Verificar si es servicio (no descuenta)
            if product.is_service:
                item.stock_deducted = True
                continue

            # Obtener ingredientes removidos para este producto
            removed_ids = (removed_ingredients_map or {}).get(item.product_id, [])

            # 2. Manejo de Recetas (Escandallo)
            recipes = db.query(RestaurantRecipe).filter(RestaurantRecipe.product_id == product.id).all()

            if recipes:
                for recipe_item in recipes:
                    # Skip ingredientes removidos por el cliente
                    if recipe_item.ingredient_id in removed_ids:
                        continue

                    ingredient = db.query(models.Product).filter(models.Product.id == recipe_item.ingredient_id).with_for_update().first()
                    if not ingredient: continue

                    qty_to_deduct = Decimal(str(item.quantity)) * Decimal(str(recipe_item.quantity))

                    # Deduct from warehouse
                    InventoryService._apply_deduction(db, ingredient, qty_to_deduct, warehouse_id,
                                                    f"Pedido Cocina: {product.name} (Orden #{item.order_id})")

                item.stock_deducted = True
            else:
                # 3. Producto directo (sin receta, ej: una Cerveza)
                qty_to_deduct = Decimal(str(item.quantity))
                InventoryService._apply_deduction(db, product, qty_to_deduct, warehouse_id,
                                                f"Pedido Cocina: {product.name} (Orden #{item.order_id})")
                item.stock_deducted = True

            # 4. Modificadores (Extras que consumen stock)
            if item.modifiers:
                for mod_link in item.modifiers:
                    mod_opt = mod_link.option
                    if mod_opt and mod_opt.ingredient_id and mod_opt.quantity_consumed > 0:
                        ing_mod = db.query(models.Product).filter(models.Product.id == mod_opt.ingredient_id).with_for_update().first()
                        if ing_mod:
                            mod_qty = Decimal(str(item.quantity)) * Decimal(str(mod_opt.quantity_consumed))
                            InventoryService._apply_deduction(db, ing_mod, mod_qty, warehouse_id,
                                                            f"Extra Pedido: {mod_opt.name} ({product.name})")

        db.flush()

    @staticmethod
    def _apply_deduction(db: Session, product, quantity: Decimal, warehouse_id: int, description: str):
        # Update Warehouse Stock
        stock_entry = db.query(models.ProductStock).filter(
            models.ProductStock.product_id == product.id,
            models.ProductStock.warehouse_id == warehouse_id
        ).first()

        if not stock_entry:
            stock_entry = models.ProductStock(product_id=product.id, warehouse_id=warehouse_id, quantity=0)
            db.add(stock_entry)
            db.flush()

        if stock_entry.quantity < quantity:
            raise ValueError(
                f"Stock insuficiente para '{product.name}': necesario {quantity}, disponible {stock_entry.quantity}"
            )

        stock_entry.quantity -= quantity
        product.stock -= quantity # Legacy sync

        # Kardex
        db.add(models.Kardex(
            product_id=product.id,
            movement_type="SALE",
            quantity=-quantity,
            balance_after=product.stock,
            description=description
        ))
        db.commit()
        return True

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

    @staticmethod
    def validate_imei_for_entry(db: Session, imei: str) -> Dict[str, Any]:
        """
        Check if an IMEI is ALREADY in the database.
        Used for Reception (Entry) to prevent duplicates.
        Returns: {"exists": bool, "message": str}
        """
        instance = db.query(models.ProductInstance).filter(
            models.ProductInstance.serial_number == imei
        ).first()

        if instance:
            return {"exists": True, "message": f"IMEI {imei} ya existe en el sistema para el producto {instance.product_id}"}
        
        return {"exists": False, "message": "IMEI disponible para entrada"}

    @staticmethod
    def process_bulk_entry(db: Session, entry_data) -> Dict[str, Any]:
        """
        Efficiently processes mass entry of serialized items (IMEIs).
        Uses bulk_save_objects for performance.
        Agregates Kardex and Stock Updates.
        """
        from ..schemas import SerializedEntry
        from ..models import ProductInstance, ProductStock, Kardex
        from ..models.models import MovementType, ProductInstanceStatus

        if isinstance(entry_data, dict):
            entry_data = SerializedEntry(**entry_data)

        product = db.query(models.Product).filter(models.Product.id == entry_data.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        if not product.has_imei:
            raise HTTPException(status_code=400, detail=f"Product '{product.name}' is not serialized (has_imei=False). Cannot add IMEIs.")

        existing_imeis = db.query(ProductInstance.serial_number).filter(
            ProductInstance.serial_number.in_(entry_data.imeis)
        ).all()
        
        if existing_imeis:
            existing_list = [e[0] for e in existing_imeis]
            raise HTTPException(status_code=400, detail=f"Duplicate IMEIs found in database: {existing_list[:5]}...")

        instances_to_create = []
        now = datetime.now()
        
        for imei in entry_data.imeis:
            instance = ProductInstance(
                product_id=product.id,
                warehouse_id=entry_data.warehouse_id,
                serial_number=imei,
                status=ProductInstanceStatus.AVAILABLE,
                cost=entry_data.cost or product.cost_price,
                created_at=now
            )
            instances_to_create.append(instance)
            
        try:
            db.bulk_save_objects(instances_to_create)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Bulk Insert Error: {str(e)}")

        qty_added = Decimal(len(instances_to_create))
        
        product.stock += qty_added
        
        p_stock = db.query(ProductStock).filter(
            ProductStock.product_id == product.id,
            ProductStock.warehouse_id == entry_data.warehouse_id
        ).first()
        
        if p_stock:
            p_stock.quantity += qty_added
        else:
            p_stock = ProductStock(
                product_id=product.id,
                warehouse_id=entry_data.warehouse_id,
                quantity=qty_added
            )
            db.add(p_stock)

        kardex = Kardex(
            product_id=product.id,
            warehouse_id=entry_data.warehouse_id,
            movement_type=MovementType.PURCHASE,
            quantity=qty_added,
            balance_after=product.stock,
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
            
            if not product.sku:
                 raise HTTPException(status_code=400, detail=f"Product '{product.name}' (ID: {pid}) has no SKU. Transfer denied.")
            
            balance_after = product.stock
            
            if warehouse_id:
                p_stock = db.query(models.ProductStock).filter(
                    models.ProductStock.product_id == pid,
                    models.ProductStock.warehouse_id == warehouse_id
                ).first()
                
                if not p_stock:
                    p_stock = models.ProductStock(
                        product_id=pid,
                        warehouse_id=warehouse_id,
                        quantity=Decimal("0.000")
                    )
                    db.add(p_stock)
                    db.flush()
                
                if p_stock.quantity < qty:
                    raise HTTPException(status_code=400, detail=f"Insufficient stock in WAREHOUSE for '{product.name}'. Requested: {qty}, Available: {p_stock.quantity}")

                p_stock.quantity -= qty
                product.stock -= qty
                balance_after = p_stock.quantity
                
            else:
                if product.stock < qty:
                    raise HTTPException(status_code=400, detail=f"Insufficient global stock for '{product.name}'. Requested: {qty}, Available: {product.stock}")
                
                product.stock -= qty
                balance_after = product.stock
            
            kardex = models.Kardex(
                product_id=product.id,
                movement_type=models.MovementType.EXTERNAL_TRANSFER_OUT,
                quantity=-qty,
                balance_after=balance_after,
                description=f"Transfer OUT to External (Generated package)",
                warehouse_id=warehouse_id,
                date=datetime.now()
            )
            db.add(kardex)
            
            transfer_items.append({
                "sku": product.sku,
                "quantity": float(qty),
                "name": product.name
            })
            
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error during transfer: {str(e)}")
            
        package = {
            "source_company": source_company,
            "source_warehouse_id": warehouse_id,
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
             
        if "items" not in data or not isinstance(data["items"], list):
            raise HTTPException(status_code=400, detail="Invalid package format: Missing 'items' list")
            
        success_count = 0
        failure_count = 0
        errors = []
        
        for item in data["items"]:
            sku = item.get("sku")
            qty = float(item.get("quantity", 0))
            name = item.get("name", "Unknown")
            
            if not sku:
                errors.append(f"Skipped item '{name}': No SKU provided")
                failure_count += 1
                continue
                
            product = db.query(models.Product).filter(models.Product.sku == sku).first()
            
            if product:
                product.stock += Decimal(str(qty))
                
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
    def preview_transfer_package(db: Session, file_content: bytes) -> Dict[str, Any]:
        """
        Parses a JSON transfer package and previews how items would match
        against existing products using a 4-step cascade.
        """
        from sqlalchemy import func
        
        try:
            data = json.loads(file_content.decode('utf-8'))
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON file")

        if "items" not in data or not isinstance(data["items"], list):
            raise HTTPException(status_code=400, detail="Invalid package format: Missing 'items' list")

        source_company = data.get("source_company", "Unknown")
        preview_items = []

        for item in data["items"]:
            sku = item.get("sku", "")
            name = item.get("name", "")
            qty = float(item.get("quantity", 0))

            match_type = "none"
            matched_product = None

            if sku:
                matched_product = db.query(models.Product).filter(
                    models.Product.sku == sku
                ).first()
                if matched_product:
                    match_type = "exact"

            if not matched_product and sku:
                matched_product = db.query(models.Product).filter(
                    func.lower(models.Product.sku) == sku.lower()
                ).first()
                if matched_product:
                    match_type = "fuzzy"

            if not matched_product and sku:
                normalized_sku = re.sub(r'[-\s.]', '', sku).lower()
                candidates = db.query(models.Product).filter(
                    models.Product.sku.isnot(None),
                    models.Product.sku != ''
                ).all()
                for candidate in candidates:
                    candidate_normalized = re.sub(r'[-\s.]', '', candidate.sku).lower()
                    if candidate_normalized == normalized_sku:
                        matched_product = candidate
                        match_type = "fuzzy"
                        break

            if not matched_product and name and len(name) >= 4:
                matched_product = db.query(models.Product).filter(
                    models.Product.name.ilike(f'%{name}%')
                ).first()
                if matched_product:
                    match_type = "name"

            preview_item = {
                "sku": sku,
                "name": name,
                "quantity": qty,
                "match_type": match_type,
                "matched_product_id": matched_product.id if matched_product else None,
                "matched_sku": matched_product.sku if matched_product else None,
                "matched_name": matched_product.name if matched_product else None,
                "matched_stock": float(matched_product.stock) if matched_product else None,
            }
            preview_items.append(preview_item)

        return {
            "source_company": source_company,
            "items": preview_items,
            "photo_urls": data.get("photo_urls", []),
        }

    @staticmethod
    def process_transfer_package_v2(db: Session, data: Dict[str, Any], warehouse_id: int = None) -> Dict[str, Any]:
        """
        Processes a mapped transfer import (v2).
        Each item can either be mapped to an existing product or flagged to create a new one.
        """
        success_count = 0
        failure_count = 0
        created_count = 0
        errors = []
        source_company = data.get("source_company", "Unknown")

        for item in data.get("items", []):
            sku = item.get("sku", "")
            name = item.get("name", "Unknown")
            qty = Decimal(str(item.get("quantity", 0)))
            target_product_id = item.get("target_product_id")
            create_new = item.get("create_new", False)
            item_warehouse_id = item.get("warehouse_id") or warehouse_id

            try:
                if target_product_id:
                    product = db.query(models.Product).filter(
                        models.Product.id == target_product_id
                    ).first()
                    if not product:
                        errors.append(f"Product ID {target_product_id} not found for SKU '{sku}'")
                        failure_count += 1
                        continue

                    product.stock += qty

                    kardex = models.Kardex(
                        product_id=product.id,
                        movement_type=models.MovementType.EXTERNAL_TRANSFER_IN,
                        quantity=qty,
                        balance_after=product.stock,
                        description=f"Transfer IN (v2) from {source_company}",
                        warehouse_id=item_warehouse_id,
                        date=datetime.now()
                    )
                    db.add(kardex)

                    if item_warehouse_id:
                        p_stock = db.query(models.ProductStock).filter(
                            models.ProductStock.product_id == product.id,
                            models.ProductStock.warehouse_id == item_warehouse_id
                        ).first()
                        if p_stock:
                            p_stock.quantity += qty
                        else:
                            p_stock = models.ProductStock(
                                product_id=product.id,
                                warehouse_id=item_warehouse_id,
                                quantity=qty
                            )
                            db.add(p_stock)

                    success_count += 1

                elif create_new:
                    new_product = models.Product(
                        name=name,
                        sku=sku if sku else None,
                        stock=qty,
                        price=Decimal("0.0000"),
                        cost_price=Decimal("0.0000"),
                    )
                    db.add(new_product)
                    db.flush()

                    kardex = models.Kardex(
                        product_id=new_product.id,
                        movement_type=models.MovementType.EXTERNAL_TRANSFER_IN,
                        quantity=qty,
                        balance_after=new_product.stock,
                        description=f"Transfer IN (v2 - new product) from {source_company}",
                        warehouse_id=item_warehouse_id,
                        date=datetime.now()
                    )
                    db.add(kardex)

                    if item_warehouse_id:
                        p_stock = models.ProductStock(
                            product_id=new_product.id,
                            warehouse_id=item_warehouse_id,
                            quantity=qty
                        )
                        db.add(p_stock)

                    success_count += 1
                    created_count += 1

                else:
                    errors.append(f"Skipped '{name}' (SKU: {sku}): No target product and create_new=false")
                    failure_count += 1

            except Exception as e:
                errors.append(f"Error processing '{name}' (SKU: {sku}): {str(e)}")
                failure_count += 1

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database commit error: {str(e)}")

        return {
            "success_count": success_count,
            "failure_count": failure_count,
            "created_count": created_count,
            "errors": errors
        }
