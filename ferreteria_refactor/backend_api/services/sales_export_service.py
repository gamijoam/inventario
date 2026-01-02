
from sqlalchemy.orm import Session
from sqlalchemy import func
import pandas as pd
import io
from datetime import datetime, date
from ..models import models

def generate_sales_excel(db: Session, start_date: date, end_date: date) -> io.BytesIO:
    """
    Generates a professional Excel file with detailed sales financial data.
    Columns: Date, Ticket, Customer, Total USD, Cost Total, Profit, Total VES, Implied Rate, Payments, Change, Cashier.
    """
    
    # 1. Fetch Sales with localized date filter
    # Converting date to datetime boundaries
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())
    
    query = (
        db.query(models.Sale)
        .filter(models.Sale.date >= start_dt)
        .filter(models.Sale.date <= end_dt)
        .filter(models.Sale.status != "VOIDED") # Exclude voided methods if status property works in filter (it doesn't usually work directly in SQL)
        # Assuming we filter by returns existence or just fetch all and process in pandas
        .order_by(models.Sale.date.desc())
    )
    
    sales = query.all()
    
    data = []
    
    for sale in sales:
        # Exclude Voided in Python (since status is a property)
        if sale.status == "VOIDED":
            continue
            
        # 1. Basic Info
        ticket_id = f"#{sale.id:06d}"
        sale_date = sale.date # Already local if using get_venezuela_now, or need conversion
        customer_name = sale.customer.name if sale.customer else "Cliente General"
        
        # 2. Financials USD
        total_usd = float(sale.total_amount)
        
        # Calculate Cost & Profit
        # Cost is sum of (detail.cost_at_sale * detail.quantity)
        total_cost = sum(
            (float(d.cost_at_sale or 0) * float(d.quantity)) 
            for d in sale.details
        )
        
        real_profit = total_usd - total_cost
        
        # 3. Financials VES & Change
        # Use simple field access. If None (legacy sales), fallback to calc? 
        # But for new sales it's reliable.
        total_ves = float(sale.total_amount_bs or 0)
        
        implied_rate = 0.0
        if total_usd > 0 and total_ves > 0:
            implied_rate = total_ves / total_usd
            
        # 4. Change Info
        change_amt = float(sale.change_amount or 0)
        change_curr = sale.change_currency or "VES"
        change_str = f"{change_curr} {change_amt:,.2f}" if change_amt > 0 else "N/A"
        
        # 5. Payment Methods String
        # "Zelle: $10 | Efec: 500Bs"
        payments_list = []
        for p in sale.payments:
            curr_sym = "$" if p.currency in ["USD", "$"] else "Bs"
            p_amt = float(p.amount)
            payments_list.append(f"{p.payment_method}: {curr_sym}{p_amt:,.2f}")
            
        payment_methods_str = " | ".join(payments_list)
        
        # 6. Cashier (User)
        # Currently User ID is missing in model, using placeholder
        cashier = "Sistema"
        
        data.append({
            "Fecha/Hora": sale_date,
            "# Ticket": ticket_id,
            "Cliente": customer_name,
            "Total Venta ($)": total_usd,
            "Costo Total ($)": total_cost,
            "Ganancia Real ($)": real_profit,
            "Total Cobrado (Bs)": total_ves,
            "Tasa Implícita": implied_rate,
            "Métodos de Pago": payment_methods_str,
            "Vuelto Entregado": change_str,
            "Cajero": cashier
        })
        
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Generate Excel
    output = io.BytesIO()
    
    if df.empty:
        # Create empty excel with columns
        df = pd.DataFrame(columns=[
            "Fecha/Hora", "# Ticket", "Cliente", "Total Venta ($)", 
            "Costo Total ($)", "Ganancia Real ($)", "Total Cobrado (Bs)", 
            "Tasa Implícita", "Métodos de Pago", "Vuelto Entregado", "Cajero"
        ])
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Ventas Detalladas')
        
        # Auto-adjust column widths (Basic approximation)
        worksheet = writer.sheets['Ventas Detalladas']
        for idx, col in enumerate(df.columns):
            series = df[col]
            # Max length of data or header
            max_len = max(
                series.astype(str).map(len).max(),
                len(str(col))
            ) + 2
            worksheet.column_dimensions[chr(65 + idx)].width = min(max_len, 50)
            
        # Format Currency Columns (D, E, F, G)
        # D=TotalUSD, E=Cost, F=Profit, G=TotalBs, H=Rate
        # openpyxl indices are 1-based (A=1)
        # D=4, E=5, F=6, G=7, H=8
        currency_format = '#,##0.00'
        rate_format = '#,##0.00'
        
        for row in range(2, len(df) + 2):
            worksheet.cell(row=row, column=4).number_format = currency_format # Total $
            worksheet.cell(row=row, column=5).number_format = currency_format # Cost $
            worksheet.cell(row=row, column=6).number_format = currency_format # Profit $
            worksheet.cell(row=row, column=7).number_format = '#,##0.00 "Bs"' # Total Bs
            worksheet.cell(row=row, column=8).number_format = rate_format # Rate
            
    output.seek(0)
    return output
