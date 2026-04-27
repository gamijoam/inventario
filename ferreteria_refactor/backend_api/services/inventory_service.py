from sqlalchemy.orm import Session
from sqlalchemy import text
from decimal import Decimal
from datetime import datetime
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
