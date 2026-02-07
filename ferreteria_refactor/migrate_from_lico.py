"""
Script de Migración: Base de Datos Legacy "lico" → Nueva Estructura con Warehouses

Este script migra datos de una base de datos antigua que NO tenía soporte para warehouses
a la nueva estructura que SÍ tiene warehouses.

IMPORTANTE:
- Todo el inventario se asignará al warehouse_id = 1 (Almacen1)
- Asegúrate de tener ambas bases de datos corriendo
- Revisa las credenciales antes de ejecutar

Uso:
    python migrate_from_lico.py
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

# ============================================
# CONFIGURACIÓN DE BASES DE DATOS
# ============================================

# Base de datos ORIGEN (lico - antigua)
SOURCE_DB = {
    'host': 'localhost',
    'port': 5432,
    'database': 'lico',
    'user': 'postgres',
    'password': 'password'  # ⚠️ CAMBIAR ESTO
}

# Base de datos DESTINO (nueva con warehouses)
TARGET_DB = {
    'host': 'localhost',
    'port': 5432,
    'database': 'pruebita2_db',
    'user': 'postgres',
    'password': 'password'  # ⚠️ CAMBIAR ESTO
}

# Warehouse por defecto donde se asignará todo el inventario
DEFAULT_WAREHOUSE_ID = 1

# ============================================
# FUNCIONES DE MIGRACIÓN
# ============================================

def connect_db(config):
    """Conecta a una base de datos PostgreSQL"""
    try:
        conn = psycopg2.connect(**config)
        print(f"✅ Conectado a: {config['database']}")
        return conn
    except Exception as e:
        print(f"❌ Error conectando a {config['database']}: {e}")
        return None


def get_products_from_lico(source_conn):
    """Obtiene todos los productos de la BD antigua"""
    cursor = source_conn.cursor(cursor_factory=RealDictCursor)
    
    # ⚠️ Query simplificada con solo columnas esenciales
    # Si tu BD tiene más columnas (supplier_id, location, etc.), agrégalas aquí
    query = """
        SELECT 
            id,
            name,
            description,
            sku,
            price,
            cost_price as cost,
            stock,
            category_id,
            is_active
        FROM products
        WHERE is_active = true
        ORDER BY id
    """
    
    cursor.execute(query)
    products = cursor.fetchall()
    cursor.close()
    
    print(f"📦 Encontrados {len(products)} productos en BD antigua")
    return products


def migrate_product(product, target_conn, warehouse_id):
    """
    Migra un producto individual a la nueva BD.
    
    Estrategia:
    1. Insertar/actualizar en tabla 'products'
    2. Crear registro en 'product_stocks' con warehouse_id = 1
    """
    cursor = target_conn.cursor()
    
    try:
        # 1. Insertar producto preservando el ID original
        # Primero verificamos si ya existe un producto con el mismo ID
        check_query = "SELECT id FROM products WHERE id = %(id)s LIMIT 1"
        cursor.execute(check_query, {'id': product['id']})
        existing = cursor.fetchone()
        
        if existing:
            # Si existe, actualizamos
            product_id = existing[0]
            update_query = """
                UPDATE products SET
                    name = %(name)s,
                    description = %(description)s,
                    sku = %(sku)s,
                    price = %(price)s,
                    cost_price = %(cost)s,
                    category_id = %(category_id)s
                WHERE id = %(id)s
            """
            cursor.execute(update_query, {
                'id': product['id'],
                'name': product['name'],
                'description': product.get('description'),
                'sku': product.get('sku'),
                'price': product.get('price', 0),
                'cost': product.get('cost', 0),
                'category_id': product.get('category_id')
            })
            new_product_id = product_id
        else:
            # Si no existe, insertamos con el ID original
            insert_product_query = """
                INSERT INTO products (
                    id, name, description, sku, price, cost_price, 
                    category_id, is_active
                ) VALUES (
                    %(id)s, %(name)s, %(description)s, %(sku)s, %(price)s, %(cost)s,
                    %(category_id)s, %(is_active)s
                )
            """
            
            cursor.execute(insert_product_query, {
                'id': product['id'],  # ← Preservar ID original
                'name': product['name'],
                'description': product.get('description'),
                'sku': product.get('sku'),
                'price': product.get('price', 0),
                'cost': product.get('cost', 0),
                'category_id': product.get('category_id'),
                'is_active': product.get('is_active', True)
            })
            
            new_product_id = product['id']  # ← Usar el ID original
        
        # 2. Crear/actualizar registro de stock en warehouse_id = 1
        stock_quantity = product.get('stock', 0)
        
        # Verificar si ya existe un registro de stock para este producto y warehouse
        check_stock_query = """
            SELECT id FROM product_stocks 
            WHERE product_id = %(product_id)s AND warehouse_id = %(warehouse_id)s
        """
        cursor.execute(check_stock_query, {
            'product_id': new_product_id,
            'warehouse_id': warehouse_id
        })
        existing_stock = cursor.fetchone()
        
        if existing_stock:
            # Actualizar stock existente
            update_stock_query = """
                UPDATE product_stocks SET
                    quantity = %(quantity)s
                WHERE product_id = %(product_id)s AND warehouse_id = %(warehouse_id)s
            """
            cursor.execute(update_stock_query, {
                'product_id': new_product_id,
                'warehouse_id': warehouse_id,
                'quantity': stock_quantity
            })
        else:
            # Insertar nuevo registro de stock
            insert_stock_query = """
                INSERT INTO product_stocks (
                    product_id, warehouse_id, quantity, location
                ) VALUES (
                    %(product_id)s, %(warehouse_id)s, %(quantity)s, %(location)s
                )
            """
            cursor.execute(insert_stock_query, {
                'product_id': new_product_id,
                'warehouse_id': warehouse_id,
                'quantity': stock_quantity,
                'location': None
            })
        
        target_conn.commit()
        print(f"  ✅ Migrado: {product['name']} (Stock: {stock_quantity})")
        return True
        
    except Exception as e:
        target_conn.rollback()
        print(f"  ❌ Error migrando {product.get('name', 'Unknown')}: {e}")
        return False
    finally:
        cursor.close()


def verify_warehouse_exists(target_conn, warehouse_id):
    """Verifica que el warehouse existe en la BD destino"""
    cursor = target_conn.cursor()
    cursor.execute("SELECT id, name FROM warehouses WHERE id = %s", (warehouse_id,))
    warehouse = cursor.fetchone()
    cursor.close()
    
    if warehouse:
        print(f"✅ Warehouse encontrado: ID={warehouse[0]}, Nombre='{warehouse[1]}'")
        return True
    else:
        print(f"❌ ERROR: No existe warehouse con ID={warehouse_id}")
        return False


# ============================================
# SCRIPT PRINCIPAL
# ============================================

def main():
    print("=" * 60)
    print("🔄 MIGRACIÓN DE BASE DE DATOS LEGACY → NUEVA ESTRUCTURA")
    print("=" * 60)
    print()
    
    # 1. Conectar a ambas bases de datos
    print("📡 Conectando a bases de datos...")
    source_conn = connect_db(SOURCE_DB)
    target_conn = connect_db(TARGET_DB)
    
    if not source_conn or not target_conn:
        print("\n❌ No se pudo conectar a las bases de datos. Abortando.")
        return
    
    print()
    
    # 2. Verificar que existe el warehouse destino
    print(f"🏢 Verificando warehouse ID={DEFAULT_WAREHOUSE_ID}...")
    if not verify_warehouse_exists(target_conn, DEFAULT_WAREHOUSE_ID):
        print("\n⚠️  Crea el warehouse primero o ajusta DEFAULT_WAREHOUSE_ID")
        source_conn.close()
        target_conn.close()
        return
    
    print()
    
    # 3. Obtener productos de BD antigua
    print("📦 Obteniendo productos de BD antigua...")
    products = get_products_from_lico(source_conn)
    
    if not products:
        print("\n⚠️  No se encontraron productos para migrar.")
        source_conn.close()
        target_conn.close()
        return
    
    print()
    
    # 4. Migrar cada producto
    print(f"🚀 Iniciando migración de {len(products)} productos...")
    print()
    
    success_count = 0
    error_count = 0
    
    for i, product in enumerate(products, 1):
        print(f"[{i}/{len(products)}]", end=" ")
        if migrate_product(product, target_conn, DEFAULT_WAREHOUSE_ID):
            success_count += 1
        else:
            error_count += 1
    
    # 5. Actualizar la secuencia de IDs para evitar conflictos futuros
    print()
    print("🔄 Actualizando secuencia de IDs...")
    cursor = target_conn.cursor()
    cursor.execute("SELECT setval('products_id_seq', (SELECT MAX(id) FROM products))")
    target_conn.commit()
    cursor.close()
    print("✅ Secuencia actualizada")
    
    # 6. Resumen
    print()
    print("=" * 60)
    print("📊 RESUMEN DE MIGRACIÓN")
    print("=" * 60)
    print(f"✅ Productos migrados exitosamente: {success_count}")
    print(f"❌ Errores: {error_count}")
    print(f"📦 Total procesado: {len(products)}")
    print()
    
    # 6. Cerrar conexiones
    source_conn.close()
    target_conn.close()
    print("🔒 Conexiones cerradas.")
    print()
    print("✨ Migración completada!")


if __name__ == "__main__":
    # Confirmación antes de ejecutar
    print()
    print("⚠️  ADVERTENCIA: Este script modificará la base de datos destino.")
    print(f"   Origen: {SOURCE_DB['database']}")
    print(f"   Destino: {TARGET_DB['database']}")
    print()
    
    confirm = input("¿Deseas continuar? (escribe 'SI' para confirmar): ")
    
    if confirm.strip().upper() == 'SI':
        main()
    else:
        print("\n❌ Migración cancelada por el usuario.")
