from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database.db import get_db
from ..models import models
from .. import schemas
from sqlalchemy.orm import joinedload
from ..template_presets import get_quote_58_template, get_quote_80_template
from ..dependencies import get_current_active_user

router = APIRouter(
    prefix="/quotes",
    tags=["quotes"]
)

@router.post("", response_model=schemas.QuoteRead)
def create_quote(
    quote_data: schemas.QuoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Create Header
    new_quote = models.Quote(
        customer_id=quote_data.customer_id,
        user_id=current_user.id,
        total_amount=quote_data.total_amount,
        notes=quote_data.notes
    )
    db.add(new_quote)
    db.flush()

    # Create Details
    for item in quote_data.items:
        detail = models.QuoteDetail(
            quote_id=new_quote.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
            is_box_sale=item.is_box
        )
        db.add(detail)
    
    db.commit()
    # db.refresh(new_quote)
    
    # Manually construct response
    response_data = {
        "id": new_quote.id,
        "customer_id": new_quote.customer_id,
        "user_id": new_quote.user_id,
        "total_amount": new_quote.total_amount,
        "notes": new_quote.notes,
        "date": new_quote.date,
        "status": new_quote.status
    }
    
    return response_data

@router.get("")
def read_quotes(skip: int = 0, limit: int = Query(default=500, le=5000), db: Session = Depends(get_db)):
    # Optimize query to load customer and user (creator)
    base_query = db.query(models.Quote)
    total = base_query.count()
    items = base_query\
        .options(
            joinedload(models.Quote.customer),
            joinedload(models.Quote.user),
            joinedload(models.Quote.details)
        )\
        .order_by(models.Quote.date.desc())\
        .offset(skip).limit(limit).all()
    return {"items": items, "total": total, "has_more": (skip + limit) < total}


@router.get("/{quote_id}", response_model=schemas.QuoteReadWithDetails)
def read_quote_details(quote_id: int, db: Session = Depends(get_db)):
    # Optimize query to load details and products within details
    quote = db.query(models.Quote)\
        .options(
            joinedload(models.Quote.customer),
            joinedload(models.Quote.details).joinedload(models.QuoteDetail.product)
        )\
        .filter(models.Quote.id == quote_id).first()
        
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote

@router.put("/{quote_id}/convert")
def mark_quote_converted(quote_id: int, db: Session = Depends(get_db)):
    quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    quote.status = "CONVERTED"
    db.commit()
    return {"status": "success", "message": "Quote converted to sale"}

@router.put("/{quote_id}", response_model=schemas.QuoteRead)
def update_quote(quote_id: int, quote_data: schemas.QuoteCreate, db: Session = Depends(get_db)):
    # Fetch existing header
    db_quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not db_quote:
        raise HTTPException(status_code=404, detail="Quote not found")
        
    if db_quote.status != "PENDING":
        raise HTTPException(status_code=400, detail="Cannot edit a converted or expired quote")

    # Update Header
    db_quote.customer_id = quote_data.customer_id
    db_quote.total_amount = quote_data.total_amount
    db_quote.notes = quote_data.notes
    
    # Delete existing details
    db.query(models.QuoteDetail).filter(models.QuoteDetail.quote_id == quote_id).delete()
    
    # Add new details
    for item in quote_data.items:
        detail = models.QuoteDetail(
            quote_id=db_quote.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
            is_box_sale=item.is_box
        )
        db.add(detail)
    
    # Capture data
    response_data = {
        "id": db_quote.id,
        "customer_id": db_quote.customer_id,
        "total_amount": db_quote.total_amount,
        "notes": db_quote.notes,
        "date": db_quote.date,
        "status": db_quote.status
    }

    db.commit()
    # db.refresh(db_quote)
    return response_data


@router.post("/{quote_id}/duplicate", response_model=schemas.QuoteRead)
def duplicate_quote(quote_id: int, db: Session = Depends(get_db)):
    """Duplica una cotización existente creando una nueva en estado PENDING."""
    original = db.query(models.Quote).options(
        joinedload(models.Quote.details)
    ).filter(models.Quote.id == quote_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    new_quote = models.Quote(
        customer_id=original.customer_id,
        user_id=original.user_id,
        total_amount=original.total_amount,
        notes=original.notes,
        status="PENDING",
        date=datetime.utcnow(),
        valid_until=original.valid_until,
        tenant_id=original.tenant_id,
    )
    db.add(new_quote)
    db.flush()

    for detail in original.details:
        new_detail = models.QuoteDetail(
            quote_id=new_quote.id,
            product_id=detail.product_id,
            quantity=detail.quantity,
            unit_price=detail.unit_price,
            subtotal=detail.subtotal,
        )
        db.add(new_detail)

    db.flush()
    result = schemas.QuoteRead(
        id=new_quote.id,
        customer_id=new_quote.customer_id,
        user_id=new_quote.user_id,
        total_amount=new_quote.total_amount,
        notes=new_quote.notes,
        status=new_quote.status,
        date=new_quote.date,
        valid_until=new_quote.valid_until,
    )
    db.commit()
    return result


@router.get("/{quote_id}/print/thermal")
def get_quote_thermal_payload(quote_id: int, width: str = None, db: Session = Depends(get_db)):
    """
    Generate a thermal print payload (template + context) for a quote.
    The frontend sends this payload to the Hardware Bridge via printerService.printRaw().
    Uses the same pattern as SalesService.get_sale_print_payload().
    """
    # Load quote with all relations
    quote = db.query(models.Quote)\
        .options(
            joinedload(models.Quote.customer),
            joinedload(models.Quote.details).joinedload(models.QuoteDetail.product)
        )\
        .filter(models.Quote.id == quote_id).first()

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Get business config (same as sales_service pattern)
    business_config = {}
    configs = db.query(models.BusinessConfig).all()
    for config in configs:
        business_config[config.key] = config.value

    # Quotes are always in anchor currency (USD)
    currency_symbol = "$"

    # Build context
    context = {
        "business": {
            "name": business_config.get("business_name", "MI NEGOCIO"),
            "document_id": business_config.get("business_doc", ""),
            "address": business_config.get("business_address", ""),
            "phone": business_config.get("business_phone", ""),
        },
        "quote": {
            "id": quote.id,
            "date": quote.date.strftime("%d/%m/%Y %H:%M") if quote.date else "",
            "customer": {
                "name": quote.customer.name if quote.customer else None,
                "id_number": quote.customer.id_number if quote.customer else None,
                "phone": quote.customer.phone if quote.customer else None,
            } if quote.customer else None,
            "items": [
                {
                    "product": {
                        "name": detail.product.name if detail.product else "Producto",
                        "sku": detail.product.sku if detail.product else "",
                    },
                    "quantity": float(detail.quantity),
                    "unit_price": float(detail.unit_price),
                    "subtotal": float(detail.subtotal),
                }
                for detail in (quote.details or [])
            ],
            "total": float(quote.total_amount),
            "notes": quote.notes or "",
        },
        "currency_symbol": currency_symbol,
    }

    # Choose template: explicit ?width= param takes priority, then business config
    effective_width = width if width in ("58", "80") else business_config.get("paper_width", "58")
    template = get_quote_80_template() if effective_width == "80" else get_quote_58_template()

    return {
        "status": "ready",
        "template": template,
        "context": context,
    }


@router.delete("/{quote_id}")
def delete_quote(quote_id: int, db: Session = Depends(get_db)):
    quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
        
    # Delete associated details first (though cascade might handle it, explicit is safer)
    db.query(models.QuoteDetail).filter(models.QuoteDetail.quote_id == quote_id).delete()
    db.delete(quote)
    db.commit()
    return {"status": "success", "message": "Quote deleted"}


# ── Endpoint: Enviar cotización por WhatsApp como PDF ─────────
@router.post("/{quote_id}/send-whatsapp")
async def send_quote_whatsapp(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Genera el PDF de la cotización y lo envía por WhatsApp al cliente.
    Requiere que WhatsApp esté conectado y el cliente tenga teléfono registrado.
    """
    import io, base64
    from sqlalchemy import text as _text
    from ..tenant_context import get_tenant_schema
    from ..routers.whatsapp import _get as wa_get, _set as wa_set, KEY_INSTANCE, KEY_STATUS
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, HRFlowable
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
    from datetime import datetime

    schema = get_tenant_schema()

    # ── 1. Cargar datos ─────────────────────────────────────
    quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    customer = None
    if quote.customer_id:
        customer = db.query(models.Customer).filter(models.Customer.id == quote.customer_id).first()

    if not customer or not customer.phone:
        raise HTTPException(status_code=400, detail="El cliente no tiene número de teléfono registrado")

    details = db.query(models.QuoteDetail).filter(models.QuoteDetail.quote_id == quote_id).all()

    # Cargar nombres de productos
    product_names = {}
    for d in details:
        p = db.query(models.Product).filter(models.Product.id == d.product_id).first()
        product_names[d.product_id] = p.name if p else f"Producto #{d.product_id}"

    # Cargar config del negocio
    biz_name  = db.execute(_text(f'SELECT value FROM "{schema}".business_config WHERE key=\'business_name\'')).scalar() or "Mi Inventario"
    biz_phone = db.execute(_text(f'SELECT value FROM "{schema}".business_config WHERE key=\'business_phone\'')).scalar() or ""
    biz_addr  = db.execute(_text(f'SELECT value FROM "{schema}".business_config WHERE key=\'business_address\'')).scalar() or ""

    # ── 2. Generar PDF con ReportLab ────────────────────────
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)

    styles = getSampleStyleSheet()
    INDIGO = colors.HexColor('#4F46E5')
    GRAY   = colors.HexColor('#64748B')
    LIGHT  = colors.HexColor('#F8FAFC')
    BORDER = colors.HexColor('#E2E8F0')

    s_title   = ParagraphStyle('title',   fontSize=22, textColor=INDIGO, fontName='Helvetica-Bold', spaceAfter=4)
    s_sub     = ParagraphStyle('sub',     fontSize=10, textColor=GRAY,   fontName='Helvetica')
    s_section = ParagraphStyle('section', fontSize=10, textColor=INDIGO, fontName='Helvetica-Bold', spaceBefore=12, spaceAfter=4)
    s_normal  = ParagraphStyle('normal',  fontSize=9,  textColor=colors.HexColor('#1E293B'), fontName='Helvetica')
    s_right   = ParagraphStyle('right',   fontSize=9,  textColor=GRAY,   fontName='Helvetica', alignment=TA_RIGHT)
    s_total   = ParagraphStyle('total',   fontSize=14, textColor=INDIGO, fontName='Helvetica-Bold', alignment=TA_RIGHT)

    story = []

    # Encabezado
    story.append(Paragraph(biz_name, s_title))
    if biz_phone:
        story.append(Paragraph(f"Tel: {biz_phone}", s_sub))
    if biz_addr:
        story.append(Paragraph(biz_addr, s_sub))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=2, color=INDIGO))
    story.append(Spacer(1, 8))

    # Info cotización + cliente en dos columnas
    fecha = quote.date.strftime("%d/%m/%Y") if quote.date else datetime.now().strftime("%d/%m/%Y")
    info_data = [
        [Paragraph(f"<b>COTIZACIÓN</b>", ParagraphStyle('h', fontSize=16, textColor=INDIGO, fontName='Helvetica-Bold')),
         Paragraph(f"<b>#{quote_id:04d}</b>", ParagraphStyle('h2', fontSize=16, textColor=INDIGO, fontName='Helvetica-Bold', alignment=TA_RIGHT))],
        [Paragraph(f"Fecha: {fecha}", s_normal),
         Paragraph(f"Estado: Pendiente", s_right)],
    ]
    info_tbl = Table(info_data, colWidths=['50%', '50%'])
    info_tbl.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE')]))
    story.append(info_tbl)
    story.append(Spacer(1, 12))

    # Datos del cliente
    story.append(Paragraph("CLIENTE", s_section))
    story.append(Table([
        [Paragraph(f"<b>{customer.name}</b>", s_normal), Paragraph(f"Tel: {customer.phone}", s_right)],
    ], colWidths=['60%','40%']))
    story.append(Spacer(1, 12))

    # Tabla de productos
    story.append(Paragraph("DETALLE", s_section))
    table_data = [[
        Paragraph("<b>Producto</b>", s_normal),
        Paragraph("<b>Cant.</b>", ParagraphStyle('ch', fontSize=9, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
        Paragraph("<b>Precio</b>", ParagraphStyle('ch', fontSize=9, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
        Paragraph("<b>Subtotal</b>", ParagraphStyle('ch', fontSize=9, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
    ]]
    for d in details:
        table_data.append([
            Paragraph(product_names.get(d.product_id, "?"), s_normal),
            Paragraph(f"{float(d.quantity):g}", ParagraphStyle('r', fontSize=9, fontName='Helvetica', alignment=TA_RIGHT)),
            Paragraph(f"${float(d.unit_price):,.2f}", ParagraphStyle('r', fontSize=9, fontName='Helvetica', alignment=TA_RIGHT)),
            Paragraph(f"${float(d.subtotal):,.2f}", ParagraphStyle('r', fontSize=9, fontName='Helvetica', alignment=TA_RIGHT)),
        ])

    tbl = Table(table_data, colWidths=['50%','15%','17.5%','17.5%'])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), INDIGO),
        ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (0,-1), 8),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 12))

    # Total
    story.append(Table([
        [Paragraph(f"<b>TOTAL: ${float(quote.total_amount):,.2f}</b>", s_total)]
    ], colWidths=['100%']))

    if quote.notes:
        story.append(Spacer(1, 12))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        story.append(Spacer(1, 6))
        story.append(Paragraph(f"<i>Notas: {quote.notes}</i>",
                                ParagraphStyle('notes', fontSize=8, textColor=GRAY, fontName='Helvetica-Oblique')))

    # Pie de página
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Esta cotización fue generada por Mi Inventario Fácil • Válida por 30 días",
                            ParagraphStyle('footer', fontSize=7, textColor=GRAY, fontName='Helvetica', alignment=TA_CENTER)))

    doc.build(story)
    pdf_bytes  = buffer.getvalue()
    pdf_base64 = base64.b64encode(pdf_bytes).decode()

    # ── 3. Enviar por WhatsApp ──────────────────────────────
    instance_name = wa_get(db, KEY_INSTANCE)
    status        = wa_get(db, KEY_STATUS)

    if not instance_name or status != "CONNECTED":
        raise HTTPException(status_code=400, detail="WhatsApp no está conectado. Ve a Configuración → WhatsApp para conectarlo.")

    import httpx
    WA_URL = "http://whatsapp_service:3000"
    phone  = "".join(c for c in customer.phone if c.isdigit())
    caption = f"📄 Cotización #{quote_id:04d} de {biz_name}\n💰 Total: ${float(quote.total_amount):,.2f}\n\n¡Gracias por tu preferencia! Respóndenos aquí si tienes alguna duda. 😊"

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{WA_URL}/instance/{instance_name}/send-document", json={
            "phone":    phone,
            "base64":   pdf_base64,
            "filename": f"Cotizacion_{quote_id:04d}_{biz_name.replace(' ','_')}.pdf",
            "caption":  caption
        })
        if not r.is_success:
            raise HTTPException(status_code=500, detail=f"Error enviando WhatsApp: {r.text}")

    return {"ok": True, "message": f"Cotización enviada a {customer.name} ({customer.phone})"}
