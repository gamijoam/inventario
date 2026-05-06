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
    """Genera PDF de garantia profesional con diseno moderno."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors

    buffer = io.BytesIO()
    w, h = A4  # 210 x 297 mm
    can = canvas.Canvas(buffer, pagesize=A4)

    # ── Paleta de colores ────────────────────────────────────────────────────
    AZUL      = (0.08, 0.20, 0.45)   # azul marino oscuro
    AZUL_MED  = (0.18, 0.38, 0.70)
    AZUL_CLAR = (0.88, 0.92, 0.97)
    VERDE     = (0.08, 0.50, 0.25)
    ROJO      = (0.70, 0.10, 0.10)
    GRIS_OSC  = (0.25, 0.25, 0.25)
    GRIS_MED  = (0.55, 0.55, 0.55)
    GRIS_CLAR = (0.94, 0.94, 0.94)
    BLANCO    = (1, 1, 1)
    NEGRO     = (0, 0, 0)

    def set_color(rgb):
        can.setFillColorRGB(*rgb)

    def set_stroke(rgb):
        can.setStrokeColorRGB(*rgb)

    # ── HEADER AZUL ───────────────────────────────────────────────────────────
    set_stroke(AZUL)
    set_color(AZUL)
    can.rect(0, h - 70*mm, w, 70*mm, fill=1, stroke=0)

    # Escudo / ícono shield (simulado con texto)
    set_color(BLANCO)
    can.setFont("Helvetica-Bold", 28)
    can.drawCentredString(w / 2, h - 22*mm, "CERTIFICADO DE GARANTÍA")

    can.setFont("Helvetica", 11)
    set_color((0.75, 0.85, 0.95))
    can.drawCentredString(w / 2, h - 30*mm, "Documento oficial de cobertura post-venta")

    # Nombre del negocio en header
    set_color(BLANCO)
    can.setFont("Helvetica-Bold", 14)
    can.drawString(15*mm, h - 50*mm, business_name or "Mi Negocio")

    can.setFont("Helvetica", 9)
    set_color((0.75, 0.85, 0.95))
    info_parts = []
    if business_rif: info_parts.append(f"RIF: {business_rif}")
    if business_phone: info_parts.append(f"Tel: {business_phone}")
    if business_address: info_parts.append(business_address)
    if info_parts:
        can.drawString(15*mm, h - 57*mm, "  |  ".join(info_parts))

    # Numero de garantia alineado a la derecha en header
    set_color((0.75, 0.85, 0.95))
    can.setFont("Helvetica", 9)
    can.drawRightString(w - 15*mm, h - 50*mm, f"Garantía N° {str(sale_id).zfill(6)}")
    can.setFont("Helvetica-Bold", 11)
    set_color(BLANCO)
    can.drawRightString(w - 15*mm, h - 57*mm, f"Venta #{sale_id}")

    # ── BARRA DECORATIVA BAJO HEADER ─────────────────────────────────────────
    set_color(AZUL_MED)
    can.rect(0, h - 73*mm, w, 3*mm, fill=1, stroke=0)

    y = h - 80*mm

    # ── SECCIÓN: DATOS DE LA VENTA ────────────────────────────────────────────
    # Título sección
    set_color(AZUL)
    can.rect(15*mm, y - 1*mm, 4*mm, 6*mm, fill=1, stroke=0)
    set_color(NEGRO)
    can.setFont("Helvetica-Bold", 11)
    can.drawString(22*mm, y, "DATOS DE LA VENTA")
    y -= 8*mm

    # Caja info venta
    set_color(GRIS_CLAR)
    can.rect(15*mm, y - 12*mm, w - 30*mm, 14*mm, fill=1, stroke=0)
    set_stroke(AZUL_MED)
    can.setLineWidth(0.5)
    can.rect(15*mm, y - 12*mm, w - 30*mm, 14*mm, fill=0, stroke=1)

    set_color(GRIS_OSC)
    can.setFont("Helvetica", 9)
    tercio = (w - 30*mm) / 3
    can.drawString(18*mm, y - 5*mm, f"📋  Factura:  #{sale_id}")
    can.drawString(18*mm + tercio, y - 5*mm, f"📅  Fecha:  {sale_date}")
    can.drawString(18*mm + tercio * 2, y - 5*mm, f"💰  Total:  {sale_total}")
    y -= 18*mm

    # ── SECCIÓN: DATOS DEL CLIENTE ────────────────────────────────────────────
    set_color(AZUL)
    can.rect(15*mm, y - 1*mm, 4*mm, 6*mm, fill=1, stroke=0)
    set_color(NEGRO)
    can.setFont("Helvetica-Bold", 11)
    can.drawString(22*mm, y, "DATOS DEL CLIENTE")
    y -= 8*mm

    # Caja info cliente
    set_color(GRIS_CLAR)
    can.rect(15*mm, y - 20*mm, w - 30*mm, 22*mm, fill=1, stroke=0)
    set_stroke(AZUL_MED)
    can.setLineWidth(0.5)
    can.rect(15*mm, y - 20*mm, w - 30*mm, 22*mm, fill=0, stroke=1)

    set_color(NEGRO)
    can.setFont("Helvetica-Bold", 10)
    can.drawString(18*mm, y - 6*mm, customer_name or "Cliente")

    can.setFont("Helvetica", 9)
    set_color(GRIS_OSC)
    doc_text = f"Documento: {customer_doc}" if customer_doc else ""
    tel_text = f"Tel: {customer_phone}" if customer_phone else ""
    email_text = f"Email: {customer_email}" if customer_email else ""
    contact = "  |  ".join(filter(None, [doc_text, tel_text, email_text]))
    if contact:
        can.drawString(18*mm, y - 13*mm, contact)
    y -= 26*mm

    # ── SECCIÓN: PRODUCTOS CON GARANTÍA ───────────────────────────────────────
    set_color(AZUL)
    can.rect(15*mm, y - 1*mm, 4*mm, 6*mm, fill=1, stroke=0)
    set_color(NEGRO)
    can.setFont("Helvetica-Bold", 11)
    can.drawString(22*mm, y, "COBERTURA DE GARANTÍA")
    y -= 9*mm

    unit_map = {"DAYS": "días", "MONTHS": "meses", "YEARS": "años", "LIFETIME": "de por vida"}

    for item in imei_items:
        wp = item.get("warranty_policy")

        # Calcular altura del bloque
        desc = getattr(wp, "description", None) if wp else None
        desc_lines = 0
        if desc:
            words = desc.split()
            line_buf = ""
            for word in words:
                if len(line_buf) + len(word) + 1 <= 70:
                    line_buf = (line_buf + " " + word).strip()
                else:
                    desc_lines += 1
                    line_buf = word
            if line_buf:
                desc_lines += 1

        block_h = 14*mm
        if wp: block_h += 5*mm
        if wp and wp.duration: block_h += 5*mm
        if desc_lines: block_h += desc_lines * 4.5*mm + 2*mm
        if item.get("warranty_expiration"): block_h += 7*mm
        serials = item.get("serials", [])
        if serials: block_h += 5*mm
        block_h = max(block_h, 28*mm)

        # Fondo bloque
        set_color(BLANCO)
        can.rect(15*mm, y - block_h, w - 30*mm, block_h, fill=1, stroke=0)

        # Borde izquierdo de color
        set_color(AZUL_MED)
        can.rect(15*mm, y - block_h, 3*mm, block_h, fill=1, stroke=0)

        # Borde general
        set_stroke(AZUL_MED)
        can.setLineWidth(0.6)
        can.rect(15*mm, y - block_h, w - 30*mm, block_h, fill=0, stroke=1)

        yy = y - 7*mm

        # Nombre del producto
        set_color(AZUL)
        can.setFont("Helvetica-Bold", 11)
        can.drawString(21*mm, yy, item["product_name"])
        yy -= 6*mm

        # Cantidad y seriales
        can.setFont("Helvetica", 9)
        set_color(GRIS_OSC)
        qty_val = item.get("quantity", 1)
        try:
            qty_str = str(int(float(qty_val)))
        except Exception:
            qty_str = str(qty_val)
        can.drawString(21*mm, yy, f"Cantidad: {qty_str} unidad(es)")
        if serials:
            can.drawString(80*mm, yy, f"Serial / IMEI: {', '.join(serials)}")
        yy -= 5*mm

        # Separador interno
        set_stroke((0.80, 0.85, 0.92))
        can.setLineWidth(0.4)
        can.line(21*mm, yy, w - 18*mm, yy)
        yy -= 4*mm

        if wp:
            # Badge de garantía
            dur_text = ""
            if wp.duration:
                dur_text = f"{wp.duration} {unit_map.get(wp.type, 'días')}"
            elif wp.type == "LIFETIME":
                dur_text = "De por vida"

            # Nombre con badge
            set_color(VERDE)
            can.setFont("Helvetica-Bold", 9)
            can.drawString(21*mm, yy, f"✓  {wp.name}  —  {dur_text}")
            yy -= 5*mm

            # Descripción
            if desc:
                set_color(GRIS_MED)
                can.setFont("Helvetica-Oblique", 8)
                words = desc.split()
                line_buf = ""
                for word in words:
                    if len(line_buf) + len(word) + 1 <= 70:
                        line_buf = (line_buf + " " + word).strip()
                    else:
                        can.drawString(21*mm, yy, line_buf)
                        yy -= 4.5*mm
                        line_buf = word
                if line_buf:
                    can.drawString(21*mm, yy, line_buf)
                    yy -= 4.5*mm

        # Fecha de vencimiento destacada
        if item.get("warranty_expiration"):
            exp = item["warranty_expiration"]
            exp_str = exp.strftime("%d/%m/%Y") if isinstance(exp, datetime) else str(exp)
            yy -= 2*mm
            set_color(ROJO)
            can.setFont("Helvetica-Bold", 9)
            can.drawString(21*mm, yy, f"⚠  Fecha de vencimiento:  {exp_str}")

        y -= block_h + 4*mm

    # ── TÉRMINOS Y CONDICIONES ─────────────────────────────────────────────────
    y -= 4*mm
    set_color(GRIS_CLAR)
    can.rect(15*mm, y - 16*mm, w - 30*mm, 18*mm, fill=1, stroke=0)
    set_color(GRIS_OSC)
    can.setFont("Helvetica-Bold", 8)
    can.drawString(18*mm, y - 4*mm, "TÉRMINOS Y CONDICIONES")
    can.setFont("Helvetica", 7.5)
    set_color(GRIS_MED)
    terms = ("Esta garantía cubre exclusivamente defectos de fabricación. Quedan excluidos daños por mal uso, "
             "accidentes, caídas, líquidos, modificaciones no autorizadas o desgaste natural. "
             "Presente este certificado junto al comprobante de pago para hacer válida su garantía.")
    # Partir en 2 líneas
    mid = len(terms) // 2
    for i in range(mid, len(terms)):
        if terms[i] == " ":
            mid = i
            break
    can.drawString(18*mm, y - 9*mm,  terms[:mid])
    can.drawString(18*mm, y - 13*mm, terms[mid+1:])
    y -= 22*mm

    # ── FIRMAS ─────────────────────────────────────────────────────────────────
    if y > 25*mm:
        set_stroke(GRIS_MED)
        can.setLineWidth(0.5)
        firma_y = max(y - 5*mm, 22*mm)
        can.line(20*mm, firma_y, 80*mm, firma_y)
        can.line(w - 80*mm, firma_y, w - 20*mm, firma_y)
        set_color(GRIS_MED)
        can.setFont("Helvetica", 8)
        can.drawCentredString(50*mm, firma_y - 4*mm, "Firma del Cliente")
        can.drawCentredString(w - 50*mm, firma_y - 4*mm, "Firma Autorizada")

    # ── FOOTER ────────────────────────────────────────────────────────────────
    set_color(AZUL)
    can.rect(0, 0, w, 10*mm, fill=1, stroke=0)
    set_color(BLANCO)
    can.setFont("Helvetica", 7.5)
    can.drawCentredString(w / 2, 3.5*mm,
        f"{business_name or 'Mi Negocio'}  •  Documento generado automáticamente  •  Venta #{sale_id}")

    can.save()
    buffer.seek(0)
    return buffer.read()
