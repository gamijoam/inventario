"""
Servicio para generación de PDFs de garantía.
Toma un PDF template subido por el cliente e inyecta los datos de la venta.
"""
import os
import io
import tempfile
from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile

from ..models import models
from ..utils.time_utils import get_venezuela_now

MEDIA_DIR = "/app/media/warranty_templates"
ALLOWED_EXTENSIONS = {".pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


async def upload_warranty_template(
    file: UploadFile,
    policy_id: int,
    db: Session,
    current_user: models.User,
) -> models.WarrantyPolicy:
    """Sube un PDF template y lo asocia a una WarrantyPolicy."""
    # Validate file type
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    # Validate file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="El archivo excede el tamaño máximo de 10 MB")

    # Verify policy exists
    policy = db.query(models.WarrantyPolicy).filter(
        models.WarrantyPolicy.id == policy_id
    ).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Warranty Policy not found")

    # Create directory if not exists
    os.makedirs(MEDIA_DIR, exist_ok=True)

    # Save file
    filename = f"warranty_policy_{policy_id}_{get_venezuela_now().strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join(MEDIA_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    # Delete old template if exists
    if policy.pdf_template_path and os.path.exists(policy.pdf_template_path):
        try:
            os.remove(policy.pdf_template_path)
        except OSError:
            pass

    # Update policy
    policy.pdf_template_path = filepath
    db.commit()
    db.refresh(policy)

    return policy


def generate_warranty_pdf(
    sale_id: int,
    db: Session,
    current_user: models.User,
) -> bytes:
    """
    Genera el PDF de garantía para una venta con productos IMEI.
    Usa el PDF template de la WarrantyPolicy asociada al producto.
    Si no hay template, genera un PDF básico con reportlab.
    """
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject, NumberObject, ArrayObject
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    # Get sale with details
    from sqlalchemy.orm import joinedload
    sale = db.query(models.Sale).options(
        joinedload(models.Sale.details).joinedload(models.SaleDetail.product).joinedload(models.Product.warranty_policy),
        joinedload(models.Sale.details).joinedload(models.SaleDetail.instances).joinedload(models.SaleDetailInstance.product_instance),
        joinedload(models.Sale.customer),
    ).filter(models.Sale.id == sale_id).first()

    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    # Buscar productos con política de garantía asignada (no solo IMEI)
    imei_items = []
    for detail in sale.details:
        if not detail.product:
            continue

        warranty_policy = getattr(detail.product, 'warranty_policy', None)
        # Incluir si tiene política de garantía O si tiene IMEI
        has_imei = getattr(detail.product, 'has_imei', False)
        if not warranty_policy and not has_imei:
            continue

        serials = []
        try:
            serials = [
                sdi.product_instance.serial_number
                for sdi in (detail.instances or [])
                if sdi.product_instance and sdi.product_instance.serial_number
            ]
        except Exception:
            pass

        imei_items.append({
            "product_name": detail.description or detail.product.name,
            "serials": serials,
            "quantity": detail.quantity,
            "warranty_policy": warranty_policy,
            "warranty_expiration": detail.warranty_expiration_date,
        })

    if not imei_items:
        raise HTTPException(
            status_code=400,
            detail="La venta no contiene productos con garantía asignada. Asigna una política de garantía al producto."
        )

    # Business info
    business_config = {}
    for config in db.query(models.BusinessConfig).all():
        business_config[config.key] = config.value

    business_name = business_config.get("business_name", "")
    business_rif = business_config.get("business_rif", "")
    business_address = business_config.get("business_address", "")
    business_phone = business_config.get("business_phone", "")
    business_logo = business_config.get("business_logo", "")

    # Customer info
    customer_name = sale.customer.name if sale.customer else "Cliente Genérico"
    customer_doc = sale.customer.id_number if sale.customer else "N/A"
    customer_phone = sale.customer.phone if sale.customer else ""
    customer_email = sale.customer.email if sale.customer else ""

    sale_date = sale.created_at.strftime("%d/%m/%Y %H:%M") if sale.created_at else "N/A"
    sale_total = f"${sale.total_amount:,.2f}" if sale.currency == "USD" else f"Bs {sale.total_amount_bs:,.2f}"

    # ── Check if any item has a PDF template ──
    # Use the first policy that has a PDF template
    template_policy = None
    for item in imei_items:
        wp = item.get("warranty_policy")
        if wp and wp.pdf_template_path and os.path.exists(wp.pdf_template_path):
            template_policy = wp
            break

    if template_policy and template_policy.pdf_template_path:
        return _fill_template_pdf(
            template_policy.pdf_template_path,
            imei_items,
            business_name, business_rif, business_address, business_phone,
            customer_name, customer_doc, customer_phone, customer_email,
            sale_date, sale_total, sale_id,
        )
    else:
        return _generate_basic_pdf(
            imei_items,
            business_name, business_rif, business_address, business_phone,
            customer_name, customer_doc, customer_phone, customer_email,
            sale_date, sale_total, sale_id,
        )


def _fill_template_pdf(
    template_path: str,
    imei_items: list,
    business_name, business_rif, business_address, business_phone,
    customer_name, customer_doc, customer_phone, customer_email,
    sale_date, sale_total, sale_id,
) -> bytes:
    """Rellena un PDF template existente con los datos de la venta."""
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import mm

    reader = PdfReader(template_path)
    writer = PdfWriter()
    page = reader.pages[0]

    # Create overlay with warranty data
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    can.setFont("Helvetica", 10)

    y = 750  # Starting Y position (top of page)

    # Title
    can.setFont("Helvetica-Bold", 14)
    can.drawString(72, y, "CERTIFICADO DE GARANTÍA")
    y -= 30

    # Business info
    can.setFont("Helvetica-Bold", 11)
    can.drawString(72, y, business_name)
    y -= 15
    can.setFont("Helvetica", 9)
    if business_rif:
        can.drawString(72, y, f"RIF: {business_rif}")
        y -= 13
    if business_address:
        can.drawString(72, y, business_address)
        y -= 13
    if business_phone:
        can.drawString(72, y, f"Tel: {business_phone}")
        y -= 20

    # Separator
    can.setStrokeColorRGB(0.7, 0.7, 0.7)
    can.line(72, y, 540, y)
    y -= 20

    # Sale info
    can.setFont("Helvetica-Bold", 10)
    can.drawString(72, y, "Datos de la Venta")
    y -= 15
    can.setFont("Helvetica", 9)
    can.drawString(72, y, f"Venta #{sale_id}")
    can.drawString(300, y, f"Fecha: {sale_date}")
    y -= 15
    can.drawString(72, y, f"Total: {sale_total}")
    y -= 20

    # Customer info
    can.setFont("Helvetica-Bold", 10)
    can.drawString(72, y, "Datos del Cliente")
    y -= 15
    can.setFont("Helvetica", 9)
    can.drawString(72, y, f"Nombre: {customer_name}")
    can.drawString(300, y, f"Documento: {customer_doc}")
    y -= 15
    if customer_phone:
        can.drawString(72, y, f"Teléfono: {customer_phone}")
        y -= 15
    if customer_email:
        can.drawString(72, y, f"Email: {customer_email}")
        y -= 20

    # Separator
    can.setStrokeColorRGB(0.7, 0.7, 0.7)
    can.line(72, y, 540, y)
    y -= 20

    # Equipment details (IMEI items)
    can.setFont("Helvetica-Bold", 10)
    can.drawString(72, y, "Equipos Cubiertos por esta Garantía")
    y -= 18

    for item in imei_items:
        can.setFont("Helvetica-Bold", 9)
        can.drawString(72, y, f"Producto: {item['product_name']}")
        y -= 14
        can.setFont("Helvetica", 9)
        can.drawString(72, y, f"Cantidad: {item['quantity']}")
        y -= 14
        can.drawString(72, y, f"Seriales: {', '.join(item['serials'])}")
        y -= 14

        wp = item.get('warranty_policy')
        if wp:
            unit_map = {"DAYS": "días", "MONTHS": "meses", "YEARS": "años", "LIFETIME": "De por vida"}
            dur_text = f"{wp.duration} {unit_map.get(wp.type, '')}" if wp.duration else unit_map.get(wp.type, "")
            can.drawString(72, y, f"Cobertura: {wp.name} ({dur_text})")
            y -= 14

        if item.get('warranty_expiration'):
            exp_date = item['warranty_expiration']
            if isinstance(exp_date, datetime):
                exp_str = exp_date.strftime("%d/%m/%Y")
            else:
                exp_str = str(exp_date)
            can.drawString(72, y, f"Vence: {exp_str}")
            y -= 14

        # Separator between items
        can.setStrokeColorRGB(0.85, 0.85, 0.85)
        can.setDash(3, 3)
        can.line(72, y, 540, y)
        can.setDash([])
        y -= 16

    # Terms placeholder
    y -= 10
    can.setFont("Helvetica-Oblique", 8)
    can.drawString(72, y, "Esta garantía cubre defectos de fabricación. No cubre daños por mal uso, accidentes o modificaciones no autorizadas.")

    can.save()
    packet.seek(0)

    overlay = PdfReader(packet)
    page.merge_page(overlay.pages[0])
    writer.add_page(page)

    # Copy remaining pages (if any) without modification
    for i in range(1, len(reader.pages)):
        writer.add_page(reader.pages[i])

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return output.read()


def _generate_basic_pdf(
    imei_items: list,
    business_name, business_rif, business_address, business_phone,
    customer_name, customer_doc, customer_phone, customer_email,
    sale_date, sale_total, sale_id,
) -> bytes:
    """Genera un PDF básico de garantía cuando no hay template subido."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import mm

    buffer = io.BytesIO()
    can = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Header
    can.setFont("Helvetica-Bold", 18)
    can.drawCentredString(width / 2, height - 60, "CERTIFICADO DE GARANTÍA")

    can.setStrokeColorRGB(0.2, 0.4, 0.6)
    can.setLineWidth(2)
    can.line(72, height - 75, width - 72, height - 75)

    y = height - 100

    # Business info
    can.setFont("Helvetica-Bold", 13)
    can.drawString(72, y, business_name or "Mi Negocio")
    y -= 18
    can.setFont("Helvetica", 10)
    if business_rif:
        can.drawString(72, y, f"RIF: {business_rif}")
        y -= 14
    if business_address:
        can.drawString(72, y, business_address)
        y -= 14
    if business_phone:
        can.drawString(72, y, f"Tel: {business_phone}")
        y -= 22

    # Sale info
    can.setFont("Helvetica-Bold", 11)
    can.drawString(72, y, "Datos de la Venta")
    can.setFillColorRGB(0.9, 0.92, 0.95)
    can.rect(70, y - 40, width - 140, 35, fill=1)
    can.setFillColorRGB(0, 0, 0)
    y -= 16
    can.setFont("Helvetica", 10)
    can.drawString(80, y, f"Venta #{sale_id}    |    Fecha: {sale_date}    |    Total: {sale_total}")
    y -= 28

    # Customer info
    can.setFont("Helvetica-Bold", 11)
    can.drawString(72, y, "Datos del Cliente")
    can.setFillColorRGB(0.9, 0.92, 0.95)
    can.rect(70, y - 40, width - 140, 35, fill=1)
    can.setFillColorRGB(0, 0, 0)
    y -= 16
    can.setFont("Helvetica", 10)
    can.drawString(80, y, f"Nombre: {customer_name}    |    Documento: {customer_doc}")
    y -= 16
    if customer_phone or customer_email:
        contact = " | ".join(filter(None, [f"Tel: {customer_phone}", f"Email: {customer_email}"]))
        can.drawString(80, y, contact)
        y -= 28

    # Equipment details
    can.setFont("Helvetica-Bold", 11)
    can.drawString(72, y, "Equipos Cubiertos por esta Garantía")
    y -= 20

    for item in imei_items:
        # Box for each item
        item_height = 70
        can.setStrokeColorRGB(0.7, 0.7, 0.7)
        can.setLineWidth(0.5)
        can.roundRect(70, y - item_height + 10, width - 140, item_height, 4, fill=0)

        can.setFont("Helvetica-Bold", 10)
        can.drawString(80, y - 8, item['product_name'])

        can.setFont("Helvetica", 9)
        can.drawString(80, y - 22, f"Cantidad: {item['quantity']}")
        can.drawString(80, y - 36, f"Seriales: {', '.join(item['serials'])}")

        wp = item.get('warranty_policy')
        if wp:
            unit_map = {"DAYS": "días", "MONTHS": "meses", "YEARS": "años", "LIFETIME": "De por vida"}
            dur_text = f"{wp.duration} {unit_map.get(wp.type, '')}" if wp.duration else unit_map.get(wp.type, "")
            can.drawString(80, y - 50, f"Cobertura: {wp.name} ({dur_text})")

        if item.get('warranty_expiration'):
            exp = item['warranty_expiration']
            exp_str = exp.strftime("%d/%m/%Y") if isinstance(exp, datetime) else str(exp)
            exp_x = 400 if wp else 80
            can.drawString(exp_x, y - 50, f"Vence: {exp_str}")

        y -= item_height + 10

    # Terms
    y -= 20
    can.setFont("Helvetica-Oblique", 8)
    can.setFillColorRGB(0.4, 0.4, 0.4)
    terms = (
        "Esta garantía cubre defectos de fabricación. No cubre daños por mal uso, "
        "accidentes, caídas, líquidos, o modificaciones no autorizadas. "
        "Para hacer efectiva la garantía, presente este certificado junto con el comprobante de pago."
    )
    can.drawString(72, y, terms)

    y -= 30
    can.setStrokeColorRGB(0.3, 0.3, 0.3)
    can.setLineWidth(0.5)
    can.line(72, y, 250, y)
    can.line(350, y, 520, y)
    can.drawCentredString(161, y - 14, "Firma del Cliente")
    can.drawCentredString(435, y - 14, "Firma Autorizada")

    can.save()
    buffer.seek(0)
    return buffer.read()
