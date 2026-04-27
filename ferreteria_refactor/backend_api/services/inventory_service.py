from sqlalchemy.orm import Session
from sqlalchemy import text
from decimal import Decimal
from datetime import datetime
from ..models import models
from ..models.restaurant import RestaurantRecipe, ProductModifierOption, RestaurantOrderItem
from ..utils.time_utils import get_venezuela_now
from fastapi import HTTPException

class InventoryService:
    @staticmethod
    def deduct_order_items_stock(db: Session, order_items: list, warehouse_id: int):
        """
        Deduce el stock de una lista de RestaurantOrderItem de forma inmediata.
        Maneja recetas y modificadores.
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

            # 2. Manejo de Recetas (Escandallo)
            recipes = db.query(RestaurantRecipe).filter(RestaurantRecipe.product_id == product.id).all()
            
            if recipes:
                for recipe_item in recipes:
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
