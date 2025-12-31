"""
Product Export Service
Handles bulk product export to Excel and PDF
"""
import pandas as pd
from io import BytesIO
from datetime import date
from typing import List
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from ..models import models


class ProductExportService:
    
    @staticmethod
    def export_to_excel(products: List[models.Product]) -> BytesIO:
        """
        Export products to Excel file with formatting
        
        Returns:
            BytesIO buffer with Excel file
        """
        # Prepare data
        data = []
        for p in products:
            data.append({
                'ID': p.id,
                'Nombre': p.name,
                'SKU': p.sku or '',
                'Precio USD': f"${p.price:.2f}",
                'Costo': f"${p.cost_price:.2f}",
                'Margen %': f"{p.profit_margin:.2f}%" if p.profit_margin else '',
                'IVA %': f"{p.tax_rate:.2f}%" if p.tax_rate else '0%',
                'Stock': f"{p.stock:.2f}",
                'Stock Mínimo': f"{p.min_stock:.2f}" if p.min_stock else '',
                'Categoría': p.category.name if p.category else '',
                'Proveedor': p.supplier.name if p.supplier else '',
                'Tasa de Cambio': p.exchange_rate.name if p.exchange_rate_id and hasattr(p, 'exchange_rate') else '',
                'Ubicación': p.location or '',
                'Descuento %': f"{p.discount_percentage:.0f}%" if p.discount_percentage else '',
                'Descuento Activo': 'Sí' if p.is_discount_active else 'No',
                'Descripción': p.description or ''
            })
        
        # Create DataFrame
        df = pd.DataFrame(data)
        
        # Create Excel file
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Inventario')
            
            # Get workbook and worksheet
            workbook = writer.book
            worksheet = writer.sheets['Inventario']
            
            # Format header
            for cell in worksheet[1]:
                cell.font = cell.font.copy(bold=True, color="000000")
                cell.fill = cell.fill.copy(fgColor="4472C4")
            
            # Auto-adjust column widths
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
            
            # Add filters
            worksheet.auto_filter.ref = worksheet.dimensions
        
        buffer.seek(0)
        return buffer
    
    @staticmethod
    def export_to_pdf(products: List[models.Product], business_name: str = "Inventario") -> BytesIO:
        """
        Export products to PDF file
        
        Returns:
            BytesIO buffer with PDF file
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        elements = []
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1a365d'),
            spaceAfter=30,
            alignment=1  # Center
        )
        
        # Title
        title = Paragraph(f"<b>{business_name}</b><br/>Reporte de Inventario", title_style)
        elements.append(title)
        
        # Date
        date_text = Paragraph(
            f"<b>Fecha:</b> {date.today().strftime('%d/%m/%Y')}",
            styles['Normal']
        )
        elements.append(date_text)
        elements.append(Spacer(1, 0.3*inch))
        
        # Prepare table data
        table_data = [['ID', 'Nombre', 'SKU', 'Precio', 'Stock', 'Categoría']]
        
        for p in products:
            table_data.append([
                str(p.id),
                p.name[:30] + '...' if len(p.name) > 30 else p.name,
                p.sku or '-',
                f"${p.price:.2f}",
                f"{p.stock:.0f}",
                (p.category.name[:15] if p.category else '-')
            ])
        
        # Create table
        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            
            # Body
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
        ]))
        
        elements.append(table)
        
        # Summary
        elements.append(Spacer(1, 0.3*inch))
        total_products = len(products)
        total_stock = sum(p.stock for p in products)
        total_value = sum(p.price * p.stock for p in products)
        
        summary = Paragraph(
            f"<b>Resumen:</b> {total_products} productos | "
            f"Stock total: {total_stock:.0f} unidades | "
            f"Valor total: ${total_value:,.2f}",
            styles['Normal']
        )
        elements.append(summary)
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer
    
    @staticmethod
    def generate_template() -> BytesIO:
        """
        Generate Excel template for product import
        
        Returns:
            BytesIO buffer with template Excel file
        """
        # Template data with example
        template_data = {
            'nombre': ['Ejemplo Producto'],
            'sku': ['ABC123'],
            'sku': ['ABC123'],
            'costo': [8.50],
            'margen_ganancia': [25.00],
            'iva': [16.00],
            'precio_usd': [12.33],
            'stock': [100],
            'descripcion': ['Descripción del producto'],
            'categoria': ['Ferretería'],
            'proveedor': ['Proveedor1'],
            'tasa_cambio': ['BCV'],
            'stock_minimo': [10],
            'ubicacion': ['A-1'],
            'descuento_porcentaje': [10],
            'descuento_activo': ['SI']
        }
        
        df = pd.DataFrame(template_data)
        
        # Instructions
        instructions = """
INSTRUCCIONES PARA IMPORTAR PRODUCTOS

1. Complete la hoja "Productos" con sus datos
2. Columnas marcadas con * son obligatorias
3. No modifique los nombres de las columnas
4. Categoría, Proveedor y Tasa deben existir en el sistema
5. Descuento activo: SI o NO
6. Guarde el archivo y súbalo en la aplicación

FORMATO DE DATOS:
- nombre*: Texto (máx 200 caracteres)
- sku: Texto único (opcional)
- costo: Número decimal (opcional, ej: 8.50)
- margen_ganancia: Número decimal (opcional, ej: 30.0)
- iva: Porcentaje de impuesto (opcional, ej: 16.0)
- precio_usd*: Número decimal (ej: 10.50) (Opcional si se indica costo+margen+iva)
- stock*: Número entero o decimal (ej: 100 o 10.5)
- descripcion: Texto (opcional)
- categoria: Nombre exacto de categoría existente
- proveedor: Nombre exacto de proveedor existente
- tasa_cambio: Nombre exacto de tasa existente
- stock_minimo: Número (opcional, default: 5)
- ubicacion: Texto (opcional)
- descuento_porcentaje: Número entre 0 y 100
- descuento_activo: SI o NO

EJEMPLO:
Nombre: Tornillo 1/2"
SKU: TOR-001
Costo: 0.35
Margen: 40
IVA: 16
Precio: 0.57
Stock: 1000
Categoría: Ferretería
        """
        
        instructions_df = pd.DataFrame({'Instrucciones': [instructions]})
        
        # Create Excel
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Productos')
            instructions_df.to_excel(writer, index=False, sheet_name='Instrucciones')
            
            # Format Products sheet
            worksheet = writer.sheets['Productos']
            for cell in worksheet[1]:
                cell.font = cell.font.copy(bold=True, color="000000")
                cell.fill = cell.fill.copy(fgColor="4472C4")
            
            # Auto-adjust column widths
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 30)
                worksheet.column_dimensions[column_letter].width = adjusted_width
        
        buffer.seek(0)
        return buffer
