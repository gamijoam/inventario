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

    sale_date = sale.date.strftime("%d/%m/%Y %H:%M") if sale.date else "N/A"
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
        qty = int(item['quantity']) if float(item['quantity']) == int(float(item['quantity'])) else item['quantity']
        can.drawString(72, y, f"Cantidad: {qty} unidad(es)")
        y -= 14
        serials_text = ', '.join(item['serials']) if item['serials'] else 'N/A'
        can.drawString(72, y, f"Seriales: {serials_text}")
        y -= 14

        wp = item.get('warranty_policy')
        if wp:
            unit_map = {"DAYS": "días", "MONTHS": "meses", "YEARS": "años", "LIFETIME": "de por vida"}
            dur_text = f"{wp.duration} {unit_map.get(wp.type, 'días')}" if wp.duration else unit_map.get(wp.type, "")
            # Línea 1: Nombre de la política
            can.setFont("Helvetica-Bold", 9)
            can.drawString(72, y, f"Garantía: {wp.name}")
            y -= 13
            # Línea 2: Duración
            can.setFont("Helvetica", 9)
            can.drawString(72, y, f"Duración: {dur_text}")
            y -= 13
            # Línea 3: Descripción si existe
            if hasattr(wp, 'description') and wp.description:
                can.setFont("Helvetica-Oblique", 8)
                # Cortar descripción si es muy larga (max 90 chars por línea)
                desc = wp.description
                while desc:
                    line = desc[:90]
                    desc = desc[90:]
                    can.drawString(72, y, line)
                    y -= 12
                can.setFont("Helvetica", 9)

        if item.get('warranty_expiration'):
            exp_date = item['warranty_expiration']
            if isinstance(exp_date, datetime):
                exp_str = exp_date.strftime("%d/%m/%Y")
            else:
                exp_str = str(exp_date)
            can.setFont("Helvetica-Bold", 9)
            can.drawString(72, y, f"Fecha de vencimiento: {exp_str}")
            can.setFont("Helvetica", 9)
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
    """Genera PDF de garantia minimalista — blanco, sin tintas de fondo, profesional."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm

    buffer = io.BytesIO()
    w, h = A4
    can = canvas.Canvas(buffer, pagesize=A4)

    NEGRO     = (0.10, 0.10, 0.10)
    GRIS_OSC  = (0.35, 0.35, 0.35)
    GRIS_MED  = (0.60, 0.60, 0.60)
    GRIS_CLAR = (0.96, 0.96, 0.96)
    GRIS_LINE = (0.88, 0.88, 0.88)
    BLANCO    = (1.0, 1.0, 1.0)

    def fc(*rgb): can.setFillColorRGB(*rgb)
    def sc(*rgb): can.setStrokeColorRGB(*rgb)

    # ── HEADER — solo tipografía y línea ─────────────────────────────────────
    y = h - 18*mm

    # Etiqueta pequeña
    fc(*GRIS_MED)
    can.setFont("Helvetica", 7)
    can.drawString(15*mm, y, "CERTIFICADO DE GARANTIA")
    y -= 7*mm

    # Nombre del negocio — protagonista
    fc(*NEGRO)
    can.setFont("Helvetica-Bold", 26)
    can.drawString(15*mm, y, (business_name or "Mi Negocio").upper())

    # N° de garantía alineado a la derecha
    fc(*GRIS_MED)
    can.setFont("Helvetica", 7)
    can.drawRightString(w - 15*mm, y + 14*mm, "N° GARANTIA")
    fc(*NEGRO)
    can.setFont("Helvetica-Bold", 16)
    can.drawRightString(w - 15*mm, y + 5*mm, f"#{str(sale_id).zfill(6)}")

    y -= 5*mm

    # Info del negocio
    info_parts = []
    if business_rif:     info_parts.append(f"RIF: {business_rif}")
    if business_phone:   info_parts.append(f"Tel: {business_phone}")
    if business_address: info_parts.append(business_address)
    fc(*GRIS_MED)
    can.setFont("Helvetica", 8)
    can.drawString(15*mm, y, "  |  ".join(info_parts))

    y -= 5*mm

    # Línea separadora 2pt
    sc(*NEGRO)
    can.setLineWidth(2)
    can.line(15*mm, y, w - 15*mm, y)
    y -= 10*mm

    # ── DATOS VENTA + CLIENTE en 2 columnas ──────────────────────────────────
    col_mid = w / 2

    # Etiquetas
    fc(*GRIS_MED)
    can.setFont("Helvetica", 7)
    can.drawString(15*mm, y, "VENTA")
    can.drawString(col_mid + 2*mm, y, "CLIENTE")
    y -= 5*mm

    # Línea divisora delgada entre secciones
    sc(*GRIS_LINE)
    can.setLineWidth(0.5)
    can.line(15*mm, y + 1*mm, w - 15*mm, y + 1*mm)
    y -= 2*mm

    # Venta
    fc(*NEGRO)
    can.setFont("Helvetica-Bold", 9)
    can.drawString(15*mm, y, f"Factura #{sale_id}")
    can.setFont("Helvetica", 9)
    fc(*GRIS_OSC)
    can.drawString(15*mm, y - 5*mm, f"Fecha: {sale_date}")
    can.drawString(15*mm, y - 10*mm, f"Total: {sale_total}")

    # Cliente
    fc(*NEGRO)
    can.setFont("Helvetica-Bold", 9)
    can.drawString(col_mid + 2*mm, y, customer_name or "Cliente General")
    can.setFont("Helvetica", 9)
    fc(*GRIS_OSC)
    cli_parts = []
    if customer_doc:   cli_parts.append(customer_doc)
    if customer_phone: cli_parts.append(customer_phone)
    if customer_email: cli_parts.append(customer_email)
    for i, part in enumerate(cli_parts[:3]):
        can.drawString(col_mid + 2*mm, y - (5*(i+1))*mm, part)

    y -= 18*mm

    # Línea separadora
    sc(*GRIS_LINE)
    can.setLineWidth(0.5)
    can.line(15*mm, y, w - 15*mm, y)
    y -= 8*mm

    # ── EQUIPOS CUBIERTOS ────────────────────────────────────────────────────
    fc(*GRIS_MED)
    can.setFont("Helvetica", 7)
    can.drawString(15*mm, y, "EQUIPOS CUBIERTOS")
    y -= 6*mm

    unit_map = {"DAYS": "dias", "MONTHS": "meses", "YEARS": "anos", "LIFETIME": "de por vida"}

    for item in imei_items:
        wp = item.get("warranty_policy")
        serials = item.get("serials", [])
        desc = getattr(wp, "description", None) if wp else None

        # Calcular altura del bloque
        desc_lines = 0
        if desc:
            words = desc.split()
            lb = ""
            for word in words:
                if len(lb) + len(word) + 1 <= 80:
                    lb = (lb + " " + word).strip()
                else:
                    desc_lines += 1
                    lb = word
            if lb:
                desc_lines += 1

        block_h = 22*mm
        if serials:                        block_h += 5*mm
        if wp:                             block_h += 5*mm
        if desc_lines:                     block_h += desc_lines * 4*mm + 2*mm
        if item.get("warranty_expiration"): block_h += 5*mm
        block_h = max(block_h, 24*mm)

        # Borde izquierdo negro 3pt (único acento de color)
        sc(*NEGRO)
        can.setLineWidth(3)
        can.line(15*mm, y - block_h, 15*mm, y)
        can.setLineWidth(0)

        # Borde exterior delgado
        sc(*GRIS_LINE)
        can.setLineWidth(0.5)
        can.rect(15*mm, y - block_h, w - 30*mm, block_h, fill=0, stroke=1)

        yy = y - 7*mm

        # Nombre del producto
        fc(*NEGRO)
        can.setFont("Helvetica-Bold", 11)
        can.drawString(20*mm, yy, item["product_name"])
        yy -= 5*mm

        # Cantidad e IMEI
        fc(*GRIS_OSC)
        can.setFont("Helvetica", 8.5)
        try:
            qty_str = str(int(float(item.get("quantity", 1))))
        except Exception:
            qty_str = str(item.get("quantity", 1))
        serial_text = f"  ·  IMEI: {', '.join(serials)}" if serials else ""
        can.drawString(20*mm, yy, f"Cant: {qty_str}{serial_text}")
        yy -= 5*mm

        # Separador interno delgado
        sc(*GRIS_LINE)
        can.setLineWidth(0.4)
        can.line(20*mm, yy + 1*mm, w - 18*mm, yy + 1*mm)
        yy -= 4*mm

        if wp:
            dur_text = ""
            if wp.duration:
                dur_text = f"{wp.duration} {unit_map.get(wp.type, 'dias')}"
            elif wp.type == "LIFETIME":
                dur_text = "De por vida"

            # Nombre garantía + badge duración
            fc(*NEGRO)
            can.setFont("Helvetica-Bold", 8.5)
            can.drawString(20*mm, yy, f"Garantia: {wp.name}")

            # Badge duración — fondo gris claro
            if dur_text:
                badge_w = len(dur_text) * 4.5 + 8
                badge_x = w - 15*mm - badge_w - 3*mm
                fc(*GRIS_CLAR)
                sc(*GRIS_LINE)
                can.setLineWidth(0.5)
                can.rect(badge_x, yy - 1.5*mm, badge_w, 6*mm, fill=1, stroke=1)
                fc(*GRIS_OSC)
                can.setFont("Helvetica-Bold", 7.5)
                can.drawCentredString(badge_x + badge_w / 2, yy + 0.5*mm, dur_text.upper())

            yy -= 5*mm

            if desc:
                fc(*GRIS_MED)
                can.setFont("Helvetica-Oblique", 8)
                lb = ""
                for word in desc.split():
                    if len(lb) + len(word) + 1 <= 80:
                        lb = (lb + " " + word).strip()
                    else:
                        can.drawString(20*mm, yy, lb)
                        yy -= 4*mm
                        lb = word
                if lb:
                    can.drawString(20*mm, yy, lb)
                    yy -= 4*mm

        if item.get("warranty_expiration"):
            exp = item["warranty_expiration"]
            exp_str = exp.strftime("%d/%m/%Y") if isinstance(exp, datetime) else str(exp)
            fc(*GRIS_OSC)
            can.setFont("Helvetica", 8.5)
            can.drawString(20*mm, yy, f"Vence: {exp_str}")

        y -= block_h + 5*mm

    # ── TÉRMINOS ──────────────────────────────────────────────────────────────
    y -= 2*mm
    fc(*GRIS_CLAR)
    sc(*GRIS_LINE)
    can.setLineWidth(0.5)
    can.rect(15*mm, y - 18*mm, w - 30*mm, 20*mm, fill=1, stroke=1)

    fc(*GRIS_OSC)
    can.setFont("Helvetica-Bold", 7.5)
    can.drawString(18*mm, y - 4*mm, "TERMINOS Y CONDICIONES")

    fc(*GRIS_MED)
    can.setFont("Helvetica", 7.5)
    terms = ("Esta garantia cubre exclusivamente defectos de fabricacion. Quedan excluidos danos por mal uso, "
             "accidentes, caidas, liquidos o modificaciones no autorizadas. "
             "Presente este certificado junto al comprobante de pago para hacer valida su garantia.")
    mid = len(terms) // 2
    for i in range(mid, len(terms)):
        if terms[i] == " ":
            mid = i
            break
    can.drawString(18*mm, y - 9.5*mm, terms[:mid])
    can.drawString(18*mm, y - 14*mm, terms[mid+1:])
    y -= 24*mm

    # ── FIRMAS ────────────────────────────────────────────────────────────────
    if y > 28*mm:
        firma_y = max(y - 8*mm, 28*mm)
        sc(*NEGRO)
        can.setLineWidth(1)
        can.line(20*mm, firma_y, 85*mm, firma_y)
        can.line(w - 85*mm, firma_y, w - 20*mm, firma_y)
        fc(*GRIS_MED)
        can.setFont("Helvetica", 7.5)
        can.drawCentredString(52*mm, firma_y - 4*mm, "Firma del cliente")
        can.drawCentredString(w - 52*mm, firma_y - 4*mm, "Firma autorizada")

    # ── FOOTER minimal ────────────────────────────────────────────────────────
    sc(*GRIS_LINE)
    can.setLineWidth(0.5)
    can.line(15*mm, 14*mm, w - 15*mm, 14*mm)
    fc(*GRIS_MED)
    can.setFont("Helvetica", 7)
    can.drawString(15*mm, 9*mm, f"{business_name or 'Mi Negocio'}  ·  Documento generado automaticamente")
    can.drawRightString(w - 15*mm, 9*mm, f"Venta #{sale_id}  ·  {sale_date}")

    can.save()
    buffer.seek(0)
    return buffer.read()
