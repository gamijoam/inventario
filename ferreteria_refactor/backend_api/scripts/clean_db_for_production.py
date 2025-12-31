import sys
import os
from sqlalchemy import text

# Add parent directory to path to allow imports
sys.path.append(os.getcwd())

from backend_api.database.db import SessionLocal
from backend_api.models import models

def clean_database():
    print("⚠️  ADVERTENCIA: ESTE SCRIPT BORRARÁ TODOS LOS DATOS DE PRODUCCION ⚠️")
    print("Se conservarán: Usuarios, Configuración del Negocio y Monedas.")
    print("Se eliminarán: Ventas, Productos, Clientes, Inventario, Caja, etc.")
    
    confirm = input("Escribe 'PRODUCCION' para confirmar el borrado: ")
    if confirm != "PRODUCCION":
        print("❌ Cancelado.")
        return

    db = SessionLocal()
    try:
        # 1. Transactional Data (Reverse dependency order)
        print("🗑️  Borrando Datos Transaccionales...")
        
        # Returns
        db.query(models.ReturnDetail).delete()
        db.query(models.Return).delete()
        
        # Sales & Payments
        db.query(models.SalePayment).delete()
        db.query(models.SaleDetail).delete()
        db.query(models.Sale).delete()
        
        # Quotes
        db.query(models.QuoteDetail).delete()
        db.query(models.Quote).delete()
        
        # Customer Payments
        db.query(models.Payment).delete()
        
        # Purchase Orders
        db.query(models.PurchaseOrderDetail).delete()
        db.query(models.PurchaseOrder).delete()
        
        # Cash
        db.query(models.CashMovement).delete()
        db.query(models.CashSession).delete()
        
        # Inventory / Kardex
        db.query(models.Kardex).delete()
        
        db.commit()
        print("✅ Datos Transaccionales eliminados.")

        # 2. Master Data
        print("🗑️  Borrando Catálogos Maestros...")
        
        # Dependent Master Tables
        db.query(models.PriceRule).delete()
        
        # Main Master Tables
        db.query(models.Product).delete()
        db.query(models.Category).delete()
        db.query(models.Supplier).delete()
        db.query(models.Customer).delete()

        db.commit()
        print("✅ Catálogos Maestros eliminados.")
        
        # 3. Reset Sequences (Postgres)
        print("🔄 Reseteando IDs (Secuencias)...")
        tables_to_reset = [
            "return_details", "returns",
            "sale_payments", "sale_details", "sales", 
            "quote_details", "quotes",
            "payments",
            "purchase_order_details", "purchase_orders",
            "cash_movements", "cash_sessions",
            "kardex",
            "price_rules", "products", "categories", "suppliers", "customers"
        ]
        
        for table in tables_to_reset:
            try:
                # Postgres Syntax
                db.execute(text(f"ALTER SEQUENCE {table}_id_seq RESTART WITH 1;"))
            except Exception as e:
                print(f"⚠️ No se pudo resetear secuencia para {table} (¿Quizás no es Postgres o tabla vacía?): {e}")

        db.commit()
        print("✅ Secuencias reseteadas.")
        print("🚀 BASE DE DATOS LISTA PARA PRODUCCIÓN 🚀")

    except Exception as e:
        db.rollback()
        print(f"❌ Error Crítico: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clean_database()
