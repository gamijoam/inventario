"""
Product Import Service
Handles bulk product import from Excel files
"""
import pandas as pd
from typing import List, Dict, Tuple
from io import BytesIO
from sqlalchemy.orm import Session
from ..models import models


class ProductImportService:
    
    REQUIRED_COLUMNS = ['nombre', 'precio_usd', 'stock']
    OPTIONAL_COLUMNS = [
        'sku', 'descripcion', 'categoria', 'proveedor', 'tasa_cambio',
        'stock_minimo', 'ubicacion', 'descuento_porcentaje', 'descuento_activo',
        'costo', 'margen_ganancia', 'iva'
    ]
    
    @staticmethod
    def validate_excel_format(df: pd.DataFrame) -> List[str]:
        """Validate that Excel has required columns"""
        errors = []
        
        # Check required columns
        for col in ProductImportService.REQUIRED_COLUMNS:
            if col not in df.columns:
                errors.append(f"Columna requerida faltante: '{col}'")
        
        return errors
    
    @staticmethod
    def validate_product_row(row: pd.Series, row_num: int, db: Session) -> List[str]:
        """Validate a single product row"""
        errors = []
        
        # Required fields
        if pd.isna(row.get('nombre')) or str(row.get('nombre')).strip() == '':
            errors.append(f"Fila {row_num}: Nombre es requerido")
        
        # Price validation (Moved to processing phase to allow calculation from Cost + Margin)
        pass
        
        # Stock validation
        try:
            stock = float(row.get('stock', 0))
            if stock < 0:
                errors.append(f"Fila {row_num}: Stock no puede ser negativo")
        except (ValueError, TypeError):
            errors.append(f"Fila {row_num}: Stock inválido")
            
        # Cost validation (if provided)
        try:
            if not pd.isna(row.get('costo')):
                cost = float(row.get('costo', 0))
                if cost < 0:
                     errors.append(f"Fila {row_num}: Costo no puede ser negativo")
        except (ValueError, TypeError):
            errors.append(f"Fila {row_num}: Costo inválido")
        
        # SKU uniqueness (if provided)
        if not pd.isna(row.get('sku')) and str(row.get('sku')).strip() != '':
            sku = str(row.get('sku')).strip()
            existing = db.query(models.Product).filter(models.Product.sku == sku).first()
            if existing:
                errors.append(f"Fila {row_num}: SKU '{sku}' ya existe")
        
        # Category validation (if provided)
        if not pd.isna(row.get('categoria')) and str(row.get('categoria')).strip() != '':
            cat_name = str(row.get('categoria')).strip()
            category = db.query(models.Category).filter(models.Category.name == cat_name).first()
            if not category:
                errors.append(f"Fila {row_num}: Categoría '{cat_name}' no existe")
        
        # Supplier validation (if provided)
        if not pd.isna(row.get('proveedor')) and str(row.get('proveedor')).strip() != '':
            sup_name = str(row.get('proveedor')).strip()
            supplier = db.query(models.Supplier).filter(models.Supplier.name == sup_name).first()
            if not supplier:
                errors.append(f"Fila {row_num}: Proveedor '{sup_name}' no existe")
        
        # Exchange rate validation (if provided)
        if not pd.isna(row.get('tasa_cambio')) and str(row.get('tasa_cambio')).strip() != '':
            rate_name = str(row.get('tasa_cambio')).strip()
            rate = db.query(models.ExchangeRate).filter(models.ExchangeRate.name == rate_name).first()
            if not rate:
                errors.append(f"Fila {row_num}: Tasa de cambio '{rate_name}' no existe")
        
        return errors
    
    @staticmethod
    def parse_excel_to_products(file_content: bytes, db: Session) -> Tuple[List[Dict], List[str]]:
        """
        Parse Excel file and return list of product dicts and errors
        
        Returns:
            (products_to_create, errors)
        """
        try:
            df = pd.read_excel(BytesIO(file_content))
        except Exception as e:
            return [], [f"Error leyendo archivo Excel: {str(e)}"]
        
        # Validate format
        format_errors = ProductImportService.validate_excel_format(df)
        if format_errors:
            return [], format_errors
        
        products_to_create = []
        all_errors = []
        
        for idx, row in df.iterrows():
            row_num = idx + 2  # Excel row (1-indexed + header)
            
            # Skip empty rows
            if pd.isna(row.get('nombre')):
                continue
            
            # Validate row
            row_errors = ProductImportService.validate_product_row(row, row_num, db)
            if row_errors:
                all_errors.extend(row_errors)
                continue
            
            # Cost Price
            cost_price = 0.0
            if not pd.isna(row.get('costo')):
                cost_price = float(row.get('costo', 0))
            
            # Profit Margin
            profit_margin = None
            if not pd.isna(row.get('margen_ganancia')):
                profit_margin = float(row.get('margen_ganancia', 0))

            # Tax Rate (IVA)
            tax_rate = 0.0
            if not pd.isna(row.get('iva')):
                try:
                    parsed_tax = float(row.get('iva', 0))
                    if 0 <= parsed_tax <= 100:
                        tax_rate = parsed_tax
                except (ValueError, TypeError):
                    pass # Ignore invalid tax, default 0
            
            # Price Calculation Logic
            # 1. Try to read explicit price
            price = 0.0
            if not pd.isna(row.get('precio_usd')):
                try:
                    price = float(row['precio_usd'])
                except:
                    price = 0.0
            
            # 2. If explicit price is missing/invalid, try to calculate from Cost + Margin + Tax
            if price <= 0 and cost_price > 0 and profit_margin is not None:
                # Formula: Cost * (1 + Margin) * (1 + Tax)
                base_price = cost_price * (1 + profit_margin / 100)
                price = base_price * (1 + tax_rate / 100)
                # Round to 2 decimals
                price = round(price, 2)
            
            # 3. Final Validation: Price must be > 0
            if price <= 0:
                all_errors.append(f"Fila {row_num}: Precio inválido (Debe ser > 0 o proveer Costo y Margen válidos para calcularlo)")
                continue

            # Build product dict
            product_data = {
                'name': str(row['nombre']).strip(),
                'price': price,
                'stock': float(row['stock']),
                'sku': str(row.get('sku', '')).strip() if not pd.isna(row.get('sku')) else None,
                'description': str(row.get('descripcion', '')).strip() if not pd.isna(row.get('descripcion')) else None,
                'min_stock': float(row.get('stock_minimo', 5)) if not pd.isna(row.get('stock_minimo')) else 5,
                'location': str(row.get('ubicacion', '')).strip() if not pd.isna(row.get('ubicacion')) else None,
                'cost_price': cost_price,
                'profit_margin': profit_margin,
                'tax_rate': tax_rate,
                'is_active': True
            }
            
            # Category ID
            if not pd.isna(row.get('categoria')) and str(row.get('categoria')).strip() != '':
                cat_name = str(row.get('categoria')).strip()
                category = db.query(models.Category).filter(models.Category.name == cat_name).first()
                if category:
                    product_data['category_id'] = category.id
            
            # Supplier ID
            if not pd.isna(row.get('proveedor')) and str(row.get('proveedor')).strip() != '':
                sup_name = str(row.get('proveedor')).strip()
                supplier = db.query(models.Supplier).filter(models.Supplier.name == sup_name).first()
                if supplier:
                    product_data['supplier_id'] = supplier.id
            
            # Exchange Rate ID
            if not pd.isna(row.get('tasa_cambio')) and str(row.get('tasa_cambio')).strip() != '':
                rate_name = str(row.get('tasa_cambio')).strip()
                rate = db.query(models.ExchangeRate).filter(models.ExchangeRate.name == rate_name).first()
                if rate:
                    product_data['exchange_rate_id'] = rate.id
            
            # Discount
            if not pd.isna(row.get('descuento_porcentaje')):
                try:
                    discount = float(row.get('descuento_porcentaje', 0))
                    if 0 <= discount <= 100:
                        product_data['discount_percentage'] = discount
                        
                        # Discount active
                        discount_active = str(row.get('descuento_activo', 'NO')).strip().upper()
                        product_data['is_discount_active'] = discount_active in ['SI', 'SÍ', 'YES', 'TRUE', '1']
                except (ValueError, TypeError):
                    pass
            
            products_to_create.append(product_data)
        
        return products_to_create, all_errors
    
    @staticmethod
    def bulk_create_products(products_data: List[Dict], db: Session) -> int:
        """Create products in batch"""
        created_count = 0
        
        for product_data in products_data:
            try:
                product = models.Product(**product_data)
                db.add(product)
                created_count += 1
            except Exception as e:
                print(f"Error creating product {product_data.get('name')}: {e}")
                continue
        
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise Exception(f"Error guardando productos: {str(e)}")
        
        return created_count
