"""
Plantillas visuales para el PDF de Certificado de Garantía.

Cada plantilla es una función que recibe los MISMOS argumentos y devuelve
los bytes del PDF generado. El cliente elige cuál usar desde
business_config.warranty_pdf_style.

Plantillas disponibles:
    - moderno       — Cards coloridas, secciones cobertura/exclusiones, formato completo
    - clasico       — Formal, marco doble, monocromo, tipografía clásica
    - minimalista   — Máximo blanco, líneas finas, solo lo esencial
"""
import io
from datetime import datetime
from typing import Optional


# ── Metadatos de plantillas (expuesto en API) ─────────────────────────────────
TEMPLATES = [
    {
        "id": "moderno",
        "name": "Moderno",
        "description": "Diseño completo con colores, secciones de cobertura y exclusiones, cards detalladas. Pro-business.",
        "is_default": True,
    },
    {
        "id": "clasico",
        "name": "Clásico",
        "description": "Formato tradicional con marco doble, tipografía formal, sin colores. Ideal para negocios serios.",
        "is_default": False,
    },
    {
        "id": "minimalista",
        "name": "Minimalista",
        "description": "Espacios amplios, solo lo esencial, monocromo. Estética premium.",
        "is_default": False,
    },
    {
        "id": "corporativo",
        "name": "Corporativo",
        "description": "Banda azul ejecutiva, acentos dorados, tipografía formal. Ideal para empresas que buscan imagen profesional alta.",
        "is_default": False,
    },
    {
        "id": "colorido",
        "name": "Colorido",
        "description": "Vibrante y amigable con gradientes y emojis. Para tiendas modernas, gaming, tecnología juvenil.",
        "is_default": False,
    },
    {
        "id": "premium",
        "name": "Premium",
        "description": "Negro y dorado, elegante y lujoso. Perfecto para productos de gama alta y joyería.",
        "is_default": False,
    },
    {
        "id": "legal",
        "name": "Legal (2 páginas)",
        "description": "Documento formal de 2 páginas con datos del cliente/equipo/venta + términos y condiciones legales completos. Ideal para celulares y equipos de alto valor.",
        "is_default": False,
    },
]


# ── Helpers compartidos ───────────────────────────────────────────────────────

UNIT_MAP = {"DAYS": "dias", "MONTHS": "meses", "YEARS": "anos", "LIFETIME": "de por vida"}


def _logo_scale(size: str) -> float:
    """Multiplicador de tamaño según preferencia del tenant.
    small/medium/large/xlarge/gigante."""
    return {
        "small":   0.7,
        "medium":  1.0,
        "large":   1.6,
        "xlarge":  2.5,
        "gigante": 3.5,
    }.get(size or "medium", 1.0)


def _resolve_logo_path(logo_url: str) -> str:
    """Convierte '/media/.../logo.png' a path absoluto en disco. Devuelve '' si no existe."""
    import os as _os
    if not logo_url:
        return ""
    if logo_url.startswith("http://") or logo_url.startswith("https://"):
        return ""  # remotos no soportados por simplicidad
    rel = logo_url.lstrip("/")
    if rel.startswith("media/"):
        rel = rel[len("media/"):]
    path = _os.path.join("/app/media", rel)
    return path if _os.path.exists(path) else ""


def _draw_logo(can, logo_path: str, x: float, y: float, max_w: float, max_h: float, center_x: bool = False) -> bool:
    """Dibuja el logo en el canvas. Devuelve True si se dibujó."""
    if not logo_path:
        return False
    try:
        from reportlab.lib.utils import ImageReader
        img = ImageReader(logo_path)
        iw, ih = img.getSize()
        if iw <= 0 or ih <= 0:
            return False
        # Escalar manteniendo aspect ratio
        ratio = min(max_w / iw, max_h / ih)
        dw, dh = iw * ratio, ih * ratio
        draw_x = x - dw/2 if center_x else x
        can.drawImage(img, draw_x, y - dh, dw, dh, mask='auto')
        return True
    except Exception as e:
        print(f"[warranty logo] error: {e}")
        return False


def _wrap_text(text: str, max_chars: int):
    """Divide texto en líneas respetando palabras."""
    if not text:
        return []
    lines, line = [], ""
    for word in text.split():
        if len(line) + len(word) + 1 <= max_chars:
            line = (line + " " + word).strip()
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines
def _hex_to_rgb(hex_value: str):
    value = (hex_value or "").strip().lstrip("#")
    if len(value) != 6:
        return None
    try:
        return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except ValueError:
        return None


def _primary_color_meta(item: dict):
    for detail in item.get("serial_details") or []:
        color_name = (detail.get("color_name") or "").strip()
        color_hex = (detail.get("color_hex") or "").strip()
        if color_name or color_hex:
            return color_name or color_hex, color_hex
    return (item.get("color_text") or "").strip(), ""


# ══════════════════════════════════════════════════════════════════════════════
# PLANTILLA 1: MODERNO (formato completo, colorido)
# ══════════════════════════════════════════════════════════════════════════════

def render_moderno(
    imei_items, business_name, business_rif, business_address, business_phone, business_logo, business_logo_size,
    customer_name, customer_doc, customer_phone, customer_email,
    sale_date, sale_total, sale_id,
) -> bytes:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm

    buffer = io.BytesIO()
    w, h = A4
    can = canvas.Canvas(buffer, pagesize=A4)

    NEGRO     = (0.10, 0.10, 0.10)
    GRIS_OSC  = (0.30, 0.30, 0.30)
    GRIS_MED  = (0.55, 0.55, 0.55)
    GRIS_LINE = (0.85, 0.85, 0.85)
    AZUL_AC   = (0.18, 0.32, 0.60)
    VERDE_OK  = (0.20, 0.55, 0.30)
    ROJO_ERR  = (0.70, 0.20, 0.20)
    AZUL_BG   = (0.94, 0.96, 0.99)
    VERDE_BG  = (0.94, 0.98, 0.94)
    ROJO_BG   = (0.99, 0.95, 0.95)
    AMARILLO_BG = (0.99, 0.97, 0.90)

    def fc(*rgb): can.setFillColorRGB(*rgb)
    def sc(*rgb): can.setStrokeColorRGB(*rgb)

    margen = 16*mm
    cx = w / 2
    inner_w = w - 2*margen

    # ── Header ──
    y = h - 14*mm
    sc(*NEGRO); can.setLineWidth(3); can.line(margen, y, w - margen, y)
    y -= 8*mm

    _logo_path = _resolve_logo_path(business_logo)
    _logo_s = _logo_scale(business_logo_size)
    if _logo_path:
        _draw_logo(can, _logo_path, margen, h - 10*mm, 22*mm*_logo_s, 18*mm*_logo_s)
    fc(*GRIS_MED); can.setFont("Helvetica", 7.5)
    can.drawCentredString(cx, y, "CERTIFICADO DE GARANTIA OFICIAL")
    y -= 8*mm
    fc(*NEGRO); can.setFont("Helvetica-Bold", 24)
    can.drawCentredString(cx, y, (business_name or "Mi Negocio").upper())
    y -= 6*mm

    info_parts = []
    if business_rif:     info_parts.append(f"RIF: {business_rif}")
    if business_phone:   info_parts.append(f"Tel: {business_phone}")
    if business_address: info_parts.append(business_address)
    if info_parts:
        fc(*GRIS_OSC); can.setFont("Helvetica", 8.5)
        can.drawCentredString(cx, y, "   ·   ".join(info_parts))
    y -= 9*mm

    # N° de garantía cartouche
    cart_w, cart_h = 70*mm, 12*mm
    cart_x = cx - cart_w/2
    fc(*NEGRO); can.roundRect(cart_x, y - cart_h, cart_w, cart_h, 2*mm, fill=1, stroke=0)
    fc(1,1,1); can.setFont("Helvetica", 7)
    can.drawCentredString(cx, y - 4*mm, "N° DE GARANTIA")
    can.setFont("Helvetica-Bold", 14)
    can.drawCentredString(cx, y - 9*mm, f"#{str(sale_id).zfill(6)}")
    y -= cart_h + 3*mm

    fc(*GRIS_OSC); can.setFont("Helvetica", 8)
    can.drawCentredString(cx, y, f"Emitido: {sale_date}")
    y -= 8*mm

    sc(*GRIS_LINE); can.setLineWidth(0.5)
    can.line(margen, y, w - margen, y); y -= 7*mm

    # 2 columnas venta/cliente
    col_w = (inner_w - 6*mm) / 2
    cl, cr = margen, margen + col_w + 6*mm
    fc(*AZUL_AC); can.setFont("Helvetica-Bold", 8)
    can.drawString(cl, y, "DATOS DE LA VENTA")
    can.drawString(cr, y, "DATOS DEL CLIENTE")
    sc(*AZUL_AC); can.setLineWidth(0.8)
    can.line(cl, y - 2*mm, cl + col_w, y - 2*mm)
    can.line(cr, y - 2*mm, cr + col_w, y - 2*mm)
    y -= 7*mm

    fc(*GRIS_MED); can.setFont("Helvetica", 7); can.drawString(cl, y, "FACTURA")
    fc(*NEGRO); can.setFont("Helvetica-Bold", 11); can.drawString(cl + 20*mm, y, f"#{sale_id}")
    y_left = y - 5*mm
    for label, value in [("FECHA", sale_date), ("TOTAL", sale_total)]:
        fc(*GRIS_MED); can.setFont("Helvetica", 7); can.drawString(cl, y_left, label)
        fc(*NEGRO); can.setFont("Helvetica", 9.5); can.drawString(cl + 20*mm, y_left, str(value))
        y_left -= 5*mm

    y_right = y
    fc(*GRIS_MED); can.setFont("Helvetica", 7); can.drawString(cr, y_right, "NOMBRE")
    fc(*NEGRO); can.setFont("Helvetica-Bold", 10)
    can.drawString(cr + 18*mm, y_right, (customer_name or "Cliente General")[:30])
    y_right -= 5*mm
    for label, value in [("C.I./DOC", customer_doc), ("TELEFONO", customer_phone), ("EMAIL", customer_email)]:
        if not value: continue
        fc(*GRIS_MED); can.setFont("Helvetica", 7); can.drawString(cr, y_right, label)
        fc(*NEGRO); can.setFont("Helvetica", 9); can.drawString(cr + 18*mm, y_right, str(value)[:35])
        y_right -= 5*mm

    y = min(y_left, y_right) - 3*mm
    sc(*GRIS_LINE); can.setLineWidth(0.5); can.line(margen, y, w - margen, y); y -= 7*mm

    # Equipos
    fc(*AZUL_AC); can.setFont("Helvetica-Bold", 8)
    can.drawString(margen, y, "EQUIPOS AMPARADOS POR ESTA GARANTIA")
    sc(*AZUL_AC); can.setLineWidth(0.8); can.line(margen, y - 2*mm, w - margen, y - 2*mm)
    y -= 7*mm

    for item in imei_items:
        wp = item.get("warranty_policy")
        serials = item.get("serials", [])
        desc = getattr(wp, "description", None) if wp else None
        desc_lines = _wrap_text(desc or "", 90)
        block_h = 16*mm + (4*mm if serials else 0) + (8*mm if wp else 0) + (len(desc_lines) * 3.5*mm + 2*mm if desc_lines else 0) + (5*mm if item.get("warranty_expiration") else 0)
        block_h = max(block_h, 24*mm)

        sc(*GRIS_LINE); can.setLineWidth(0.6); fc(1,1,1)
        can.roundRect(margen, y - block_h, inner_w, block_h, 2*mm, fill=1, stroke=1)
        fc(*AZUL_AC); can.rect(margen, y - block_h, 3*mm, block_h, fill=1, stroke=0)

        yy = y - 6*mm
        fc(*NEGRO); can.setFont("Helvetica-Bold", 12)
        can.drawString(margen + 7*mm, yy, item["product_name"])

        if wp:
            dur = f"{wp.duration} {UNIT_MAP.get(wp.type, 'dias')}" if wp.duration else (UNIT_MAP.get(wp.type, ""))
            if dur:
                bl = dur.upper()
                bw = max(28*mm, len(bl) * 2.2*mm + 6*mm)
                bx = w - margen - bw - 2*mm
                fc(*AZUL_AC); can.roundRect(bx, yy - 1.5*mm, bw, 6*mm, 2*mm, fill=1, stroke=0)
                fc(1,1,1); can.setFont("Helvetica-Bold", 8.5)
                can.drawCentredString(bx + bw/2, yy + 0.5*mm, bl)
        yy -= 5*mm

        try: qty_str = str(int(float(item.get("quantity", 1))))
        except: qty_str = str(item.get("quantity", 1))
        fc(*GRIS_MED); can.setFont("Helvetica", 7.5); can.drawString(margen + 7*mm, yy, "CANTIDAD")
        fc(*NEGRO); can.setFont("Helvetica-Bold", 9); can.drawString(margen + 24*mm, yy, qty_str)
        if serials:
            fc(*GRIS_MED); can.setFont("Helvetica", 7.5); can.drawString(margen + 38*mm, yy, "IMEI / SERIAL")
            fc(*NEGRO); can.setFont("Courier-Bold", 9)
            stxt = ", ".join(serials); stxt = stxt[:47] + "..." if len(stxt) > 50 else stxt
            can.drawString(margen + 60*mm, yy, stxt)
        yy -= 5*mm
        sc(*GRIS_LINE); can.setLineWidth(0.3); can.line(margen + 7*mm, yy, w - margen - 3*mm, yy); yy -= 4*mm

        if wp:
            fc(*GRIS_MED); can.setFont("Helvetica", 7.5); can.drawString(margen + 7*mm, yy, "POLITICA")
            fc(*NEGRO); can.setFont("Helvetica-Bold", 9.5); can.drawString(margen + 24*mm, yy, wp.name)
            yy -= 5*mm
            if desc_lines:
                fc(*GRIS_MED); can.setFont("Helvetica", 7.5); can.drawString(margen + 7*mm, yy, "DETALLE")
                fc(*GRIS_OSC); can.setFont("Helvetica-Oblique", 8.5)
                for i, ln in enumerate(desc_lines):
                    xt = (margen + 24*mm) if i == 0 else (margen + 7*mm)
                    can.drawString(xt, yy, ln); yy -= 3.5*mm

        if item.get("warranty_expiration"):
            exp = item["warranty_expiration"]
            exp_str = exp.strftime("%d/%m/%Y") if isinstance(exp, datetime) else str(exp)
            fc(*GRIS_MED); can.setFont("Helvetica", 7.5); can.drawString(margen + 7*mm, yy, "VENCE")
            fc(*ROJO_ERR); can.setFont("Helvetica-Bold", 9.5); can.drawString(margen + 24*mm, yy, exp_str)

        y -= block_h + 4*mm

    # Cobertura + Exclusiones
    y -= 2*mm
    cw = (inner_w - 5*mm) / 2; ch = 38*mm
    fc(*VERDE_BG); sc(*VERDE_OK); can.setLineWidth(0.8)
    can.roundRect(margen, y - ch, cw, ch, 2*mm, fill=1, stroke=1)
    fc(*VERDE_OK); can.setFont("Helvetica-Bold", 9); can.drawString(margen + 4*mm, y - 5*mm, "QUE SI CUBRE")
    cobertura = ["Defectos de fabricacion", "Fallas tecnicas internas", "Componentes defectuosos", "Mal funcionamiento del equipo"]
    cy = y - 11*mm
    for it in cobertura:
        fc(*VERDE_OK); can.setFont("Helvetica-Bold", 8); can.drawString(margen + 4*mm, cy, "+")
        fc(*GRIS_OSC); can.setFont("Helvetica", 8); can.drawString(margen + 8*mm, cy, it)
        cy -= 5*mm

    cr_x = margen + cw + 5*mm
    fc(*ROJO_BG); sc(*ROJO_ERR); can.setLineWidth(0.8)
    can.roundRect(cr_x, y - ch, cw, ch, 2*mm, fill=1, stroke=1)
    fc(*ROJO_ERR); can.setFont("Helvetica-Bold", 9); can.drawString(cr_x + 4*mm, y - 5*mm, "QUE NO CUBRE")
    exclusiones = ["Mal uso o negligencia", "Caidas, golpes o impactos", "Contacto con liquidos", "Modificaciones no autorizadas"]
    cy = y - 11*mm
    for it in exclusiones:
        fc(*ROJO_ERR); can.setFont("Helvetica-Bold", 9); can.drawString(cr_x + 4*mm, cy, "x")
        fc(*GRIS_OSC); can.setFont("Helvetica", 8); can.drawString(cr_x + 8*mm, cy, it)
        cy -= 5*mm
    y -= ch + 5*mm

    # Cómo reclamar + Importante
    rh = 36*mm
    fc(*AZUL_BG); sc(*AZUL_AC); can.setLineWidth(0.8)
    can.roundRect(margen, y - rh, cw, rh, 2*mm, fill=1, stroke=1)
    fc(*AZUL_AC); can.setFont("Helvetica-Bold", 9); can.drawString(margen + 4*mm, y - 5*mm, "COMO RECLAMAR")
    pasos = ["Presente este certificado original", "Junto al comprobante de pago", "El equipo debe estar completo", "Acuda a nuestra sede en horario"]
    cy = y - 11*mm
    for i, p in enumerate(pasos, 1):
        fc(*AZUL_AC); can.setFont("Helvetica-Bold", 8); can.drawString(margen + 4*mm, cy, f"{i}.")
        fc(*GRIS_OSC); can.setFont("Helvetica", 7.5); can.drawString(margen + 8*mm, cy, p)
        cy -= 5*mm

    fc(*AMARILLO_BG); sc(0.85, 0.65, 0.20); can.setLineWidth(0.8)
    can.roundRect(cr_x, y - rh, cw, rh, 2*mm, fill=1, stroke=1)
    fc(0.65, 0.50, 0.10); can.setFont("Helvetica-Bold", 9); can.drawString(cr_x + 4*mm, y - 5*mm, "IMPORTANTE")
    importantes = ["Conserve este documento en buen estado", "Sin certificado la garantia no aplica", "Garantia personal e intransferible", "Valida solo en el local de compra"]
    cy = y - 11*mm
    for it in importantes:
        fc(0.85, 0.65, 0.20); can.setFont("Helvetica-Bold", 8); can.drawString(cr_x + 4*mm, cy, "!")
        fc(*GRIS_OSC); can.setFont("Helvetica", 7.5); can.drawString(cr_x + 8*mm, cy, it)
        cy -= 5*mm
    y -= rh + 8*mm

    # Firma
    firma_y = max(y, 32*mm); lw = 80*mm
    sc(*NEGRO); can.setLineWidth(1); can.line(cx - lw/2, firma_y, cx + lw/2, firma_y)
    fc(*NEGRO); can.setFont("Helvetica-Bold", 9.5)
    can.drawCentredString(cx, firma_y - 5*mm, "FIRMA DEL CLIENTE")
    if customer_name:
        fc(*GRIS_OSC); can.setFont("Helvetica", 8.5); can.drawCentredString(cx, firma_y - 10*mm, customer_name)
    if customer_doc:
        fc(*GRIS_MED); can.setFont("Helvetica", 7.5); can.drawCentredString(cx, firma_y - 14*mm, f"C.I.: {customer_doc}")

    # Footer
    sc(*NEGRO); can.setLineWidth(1.5); can.line(margen, 13*mm, w - margen, 13*mm)
    fc(*GRIS_MED); can.setFont("Helvetica", 7)
    can.drawString(margen, 8*mm, f"{business_name or 'Mi Negocio'}  ·  Certificado de Garantia Oficial")
    can.drawCentredString(cx, 8*mm, f"Documento N° {str(sale_id).zfill(6)}")
    can.drawRightString(w - margen, 8*mm, "Generado automaticamente")

    can.save(); buffer.seek(0); return buffer.read()


# ══════════════════════════════════════════════════════════════════════════════
# PLANTILLA 2: CLÁSICO (formal, marco doble, monocromo)
# ══════════════════════════════════════════════════════════════════════════════

def render_clasico(
    imei_items, business_name, business_rif, business_address, business_phone, business_logo, business_logo_size,
    customer_name, customer_doc, customer_phone, customer_email,
    sale_date, sale_total, sale_id,
) -> bytes:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm

    buffer = io.BytesIO()
    w, h = A4
    can = canvas.Canvas(buffer, pagesize=A4)

    NEGRO    = (0.0, 0.0, 0.0)
    GRIS_OSC = (0.25, 0.25, 0.25)
    GRIS_MED = (0.50, 0.50, 0.50)
    GRIS_LINE = (0.80, 0.80, 0.80)

    def fc(*rgb): can.setFillColorRGB(*rgb)
    def sc(*rgb): can.setStrokeColorRGB(*rgb)

    margen = 18*mm
    cx = w / 2
    inner_w = w - 2*margen

    # ── Marco doble decorativo ──
    sc(*NEGRO); can.setLineWidth(1.5)
    can.rect(margen - 4*mm, 16*mm, inner_w + 8*mm, h - 16*mm - 16*mm, fill=0, stroke=1)
    can.setLineWidth(0.5)
    can.rect(margen - 2*mm, 18*mm, inner_w + 4*mm, h - 18*mm - 18*mm, fill=0, stroke=1)

    y = h - 22*mm

    _logo_path = _resolve_logo_path(business_logo)
    _logo_s = _logo_scale(business_logo_size)
    if _logo_path:
        _draw_logo(can, _logo_path, cx, h - 12*mm, 24*mm*_logo_s, 16*mm*_logo_s, center_x=True)
        y -= 6*mm*_logo_s

    # Etiqueta
    fc(*GRIS_MED); can.setFont("Times-Italic", 9)
    can.drawCentredString(cx, y, "Certificado Oficial de Garantía")
    y -= 11*mm

    # Nombre — Times Roman
    fc(*NEGRO); can.setFont("Times-Bold", 28)
    can.drawCentredString(cx, y, (business_name or "Mi Negocio").upper())
    y -= 6*mm

    # Línea sutil
    sc(*NEGRO); can.setLineWidth(0.5)
    can.line(cx - 30*mm, y, cx + 30*mm, y)
    y -= 5*mm

    info_parts = []
    if business_rif:     info_parts.append(f"R.I.F. {business_rif}")
    if business_phone:   info_parts.append(f"Tel. {business_phone}")
    if business_address: info_parts.append(business_address)
    if info_parts:
        fc(*GRIS_OSC); can.setFont("Times-Roman", 10)
        can.drawCentredString(cx, y, "  ·  ".join(info_parts))
    y -= 10*mm

    # N° y fecha en una caja con bordes dobles
    box_h = 16*mm
    sc(*NEGRO); can.setLineWidth(1)
    can.rect(margen + 10*mm, y - box_h, inner_w - 20*mm, box_h, fill=0, stroke=1)
    can.setLineWidth(0.3)
    can.rect(margen + 11*mm, y - box_h + 1*mm, inner_w - 22*mm, box_h - 2*mm, fill=0, stroke=1)

    fc(*GRIS_MED); can.setFont("Times-Italic", 8)
    can.drawCentredString(cx - inner_w/4, y - 5*mm, "CERTIFICADO N°")
    can.drawCentredString(cx + inner_w/4, y - 5*mm, "FECHA DE EMISION")
    fc(*NEGRO); can.setFont("Times-Bold", 14)
    can.drawCentredString(cx - inner_w/4, y - 11*mm, f"{str(sale_id).zfill(6)}")
    can.setFont("Times-Roman", 11)
    can.drawCentredString(cx + inner_w/4, y - 11*mm, sale_date or "")
    y -= box_h + 8*mm

    # Datos venta/cliente
    fc(*NEGRO); can.setFont("Times-Bold", 11)
    can.drawString(margen + 5*mm, y, "DATOS DEL COMPROBANTE Y BENEFICIARIO")
    sc(*NEGRO); can.setLineWidth(0.3)
    can.line(margen + 5*mm, y - 1*mm, w - margen - 5*mm, y - 1*mm)
    y -= 8*mm

    col_w = (inner_w - 14*mm) / 2
    cl = margen + 5*mm
    cr = cl + col_w + 4*mm

    fc(*GRIS_OSC); can.setFont("Times-Italic", 9)
    can.drawString(cl, y, "VENTA")
    can.drawString(cr, y, "CLIENTE")
    sc(*GRIS_LINE); can.setLineWidth(0.3)
    can.line(cl, y - 1.5*mm, cl + col_w, y - 1.5*mm)
    can.line(cr, y - 1.5*mm, cr + col_w, y - 1.5*mm)
    y -= 6*mm

    fc(*NEGRO); can.setFont("Times-Roman", 10)
    rows_l = [("Factura:", f"#{sale_id}"), ("Fecha:", sale_date or "—"), ("Total:", sale_total or "—")]
    rows_r = [("Nombre:", customer_name or "Cliente General"), ("Documento:", customer_doc or "—"),
              ("Teléfono:", customer_phone or "—"), ("Email:", customer_email or "—")]
    y_left = y; y_right = y
    for k, v in rows_l:
        fc(*GRIS_MED); can.setFont("Times-Italic", 9); can.drawString(cl, y_left, k)
        fc(*NEGRO); can.setFont("Times-Roman", 10); can.drawString(cl + 18*mm, y_left, str(v))
        y_left -= 5.5*mm
    for k, v in rows_r:
        fc(*GRIS_MED); can.setFont("Times-Italic", 9); can.drawString(cr, y_right, k)
        fc(*NEGRO); can.setFont("Times-Roman", 10); can.drawString(cr + 22*mm, y_right, str(v)[:35])
        y_right -= 5.5*mm

    y = min(y_left, y_right) - 4*mm

    # Equipos
    fc(*NEGRO); can.setFont("Times-Bold", 11)
    can.drawString(margen + 5*mm, y, "DETALLE DE EQUIPOS BAJO GARANTIA")
    sc(*NEGRO); can.setLineWidth(0.3); can.line(margen + 5*mm, y - 1*mm, w - margen - 5*mm, y - 1*mm)
    y -= 7*mm

    for item in imei_items:
        wp = item.get("warranty_policy")
        serials = item.get("serials", [])
        desc = getattr(wp, "description", None) if wp else None
        dl = _wrap_text(desc or "", 85)

        # Tabla con bordes simples
        block_h = 14*mm + (4*mm if serials else 0) + (5*mm if wp else 0) + (len(dl)*4*mm + 1*mm if dl else 0) + (5*mm if item.get("warranty_expiration") else 0)
        block_h = max(block_h, 22*mm)

        sc(*NEGRO); can.setLineWidth(0.5); fc(1,1,1)
        can.rect(margen + 5*mm, y - block_h, inner_w - 10*mm, block_h, fill=0, stroke=1)

        yy = y - 5*mm
        fc(*NEGRO); can.setFont("Times-Bold", 11)
        can.drawString(margen + 8*mm, yy, item["product_name"])

        if wp:
            dur = f"{wp.duration} {UNIT_MAP.get(wp.type, 'dias')}" if wp.duration else UNIT_MAP.get(wp.type, "")
            if dur:
                fc(*NEGRO); can.setFont("Times-Italic", 9.5)
                can.drawRightString(w - margen - 8*mm, yy, f"Vigencia: {dur}")
        yy -= 5*mm

        try: qty_str = str(int(float(item.get("quantity", 1))))
        except: qty_str = str(item.get("quantity", 1))
        fc(*GRIS_OSC); can.setFont("Times-Italic", 9)
        can.drawString(margen + 8*mm, yy, f"Cantidad: {qty_str}")
        if serials:
            stxt = ", ".join(serials)
            can.drawString(margen + 35*mm, yy, f"Serial(es): {stxt[:50]}")
        yy -= 5*mm

        if wp:
            fc(*NEGRO); can.setFont("Times-Bold", 9.5)
            can.drawString(margen + 8*mm, yy, f"Política: {wp.name}")
            yy -= 4*mm
            if dl:
                fc(*GRIS_OSC); can.setFont("Times-Italic", 9)
                for ln in dl:
                    can.drawString(margen + 8*mm, yy, ln); yy -= 4*mm

        if item.get("warranty_expiration"):
            exp = item["warranty_expiration"]
            exp_str = exp.strftime("%d/%m/%Y") if isinstance(exp, datetime) else str(exp)
            fc(*NEGRO); can.setFont("Times-Bold", 9.5)
            can.drawString(margen + 8*mm, yy, f"Fecha de vencimiento: {exp_str}")

        y -= block_h + 4*mm

    # Términos en prosa formal (estilo clásico SI los incluye porque es formato legal)
    y -= 3*mm
    fc(*NEGRO); can.setFont("Times-Bold", 11)
    can.drawString(margen + 5*mm, y, "CLAUSULAS Y CONDICIONES")
    sc(*NEGRO); can.setLineWidth(0.3); can.line(margen + 5*mm, y - 1*mm, w - margen - 5*mm, y - 1*mm)
    y -= 6*mm

    clausulas = [
        "Primera: La presente garantía cubre exclusivamente los defectos de fabricación que pudieran presentarse en el bien adquirido durante el período indicado.",
        "Segunda: No se cubren daños derivados de mal uso, negligencia, accidentes, caídas, contacto con líquidos o modificaciones no autorizadas.",
        "Tercera: Para hacer válida la garantía es indispensable presentar este certificado original junto con el comprobante de pago.",
        "Cuarta: Esta garantía es personal e intransferible y será atendida únicamente en el local donde se efectuó la compra.",
    ]
    fc(*GRIS_OSC); can.setFont("Times-Roman", 9)
    for cl_txt in clausulas:
        lns = _wrap_text(cl_txt, 110)
        for ln in lns:
            can.drawString(margen + 5*mm, y, ln); y -= 4.2*mm
        y -= 1*mm

    y -= 4*mm

    # Firma centrada elegante
    firma_y = max(y, 38*mm); lw = 90*mm
    sc(*NEGRO); can.setLineWidth(0.8)
    can.line(cx - lw/2, firma_y, cx + lw/2, firma_y)
    fc(*GRIS_OSC); can.setFont("Times-Italic", 10)
    can.drawCentredString(cx, firma_y - 5*mm, "Firma del Cliente")
    if customer_name:
        fc(*NEGRO); can.setFont("Times-Roman", 9.5)
        can.drawCentredString(cx, firma_y - 10*mm, customer_name)
    if customer_doc:
        fc(*GRIS_MED); can.setFont("Times-Italic", 8.5)
        can.drawCentredString(cx, firma_y - 14*mm, f"C.I.: {customer_doc}")

    # Footer
    fc(*GRIS_MED); can.setFont("Times-Italic", 8)
    can.drawCentredString(cx, 11*mm,
        f"{business_name or 'Mi Negocio'}  ·  Documento N° {str(sale_id).zfill(6)}  ·  Generado el {sale_date}")

    can.save(); buffer.seek(0); return buffer.read()


# ══════════════════════════════════════════════════════════════════════════════
# PLANTILLA 3: MINIMALISTA (puro, monocromo, máximo espacio)
# ══════════════════════════════════════════════════════════════════════════════

def render_minimalista(
    imei_items, business_name, business_rif, business_address, business_phone, business_logo, business_logo_size,
    customer_name, customer_doc, customer_phone, customer_email,
    sale_date, sale_total, sale_id,
) -> bytes:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm

    buffer = io.BytesIO()
    w, h = A4
    can = canvas.Canvas(buffer, pagesize=A4)

    NEGRO    = (0.05, 0.05, 0.05)
    GRIS_OSC = (0.35, 0.35, 0.35)
    GRIS_MED = (0.55, 0.55, 0.55)
    GRIS_TENUE = (0.78, 0.78, 0.78)

    def fc(*rgb): can.setFillColorRGB(*rgb)
    def sc(*rgb): can.setStrokeColorRGB(*rgb)

    margen = 25*mm
    cx = w / 2

    _logo_path = _resolve_logo_path(business_logo)
    _logo_s = _logo_scale(business_logo_size)
    if _logo_path:
        _draw_logo(can, _logo_path, w - margen - 20*mm*_logo_s, h - 22*mm, 20*mm*_logo_s, 16*mm*_logo_s)

    # ── Header minimal ──
    y = h - 30*mm

    # Etiqueta muy sutil
    fc(*GRIS_TENUE); can.setFont("Helvetica", 7)
    can.drawString(margen, y, "C E R T I F I C A D O   D E   G A R A N T I A")
    y -= 14*mm

    # Nombre — peso ligero
    fc(*NEGRO); can.setFont("Helvetica", 32)
    can.drawString(margen, y, business_name or "Mi Negocio")
    y -= 14*mm

    # Línea finísima
    sc(*GRIS_TENUE); can.setLineWidth(0.3)
    can.line(margen, y, w - margen, y)
    y -= 10*mm

    # N° garantía + fecha en línea
    fc(*GRIS_MED); can.setFont("Helvetica", 8)
    can.drawString(margen, y, "N°")
    fc(*NEGRO); can.setFont("Helvetica-Bold", 11)
    can.drawString(margen + 6*mm, y, str(sale_id).zfill(6))

    fc(*GRIS_MED); can.setFont("Helvetica", 8)
    can.drawRightString(w - margen - 30*mm, y, "Emitido")
    fc(*NEGRO); can.setFont("Helvetica", 10)
    can.drawRightString(w - margen, y, sale_date or "")
    y -= 18*mm

    # Datos en lista vertical, espaciada
    fc(*GRIS_MED); can.setFont("Helvetica", 7)
    can.drawString(margen, y, "CLIENTE")
    y -= 6*mm
    fc(*NEGRO); can.setFont("Helvetica", 14)
    can.drawString(margen, y, customer_name or "Cliente General")
    y -= 8*mm

    parts = [p for p in [customer_doc, customer_phone, customer_email] if p]
    if parts:
        fc(*GRIS_OSC); can.setFont("Helvetica", 9)
        can.drawString(margen, y, "  ·  ".join(parts))
    y -= 14*mm

    # Linea divisoria
    sc(*GRIS_TENUE); can.setLineWidth(0.3)
    can.line(margen, y, w - margen, y)
    y -= 10*mm

    # Equipos — listado simple sin cards
    fc(*GRIS_MED); can.setFont("Helvetica", 7)
    can.drawString(margen, y, "EQUIPOS")
    y -= 8*mm

    for item in imei_items:
        wp = item.get("warranty_policy")
        serials = item.get("serials", [])
        desc = getattr(wp, "description", None) if wp else None

        fc(*NEGRO); can.setFont("Helvetica-Bold", 13)
        can.drawString(margen, y, item["product_name"])

        if wp:
            dur = f"{wp.duration} {UNIT_MAP.get(wp.type, 'dias')}" if wp.duration else UNIT_MAP.get(wp.type, "")
            if dur:
                fc(*GRIS_MED); can.setFont("Helvetica", 9)
                can.drawRightString(w - margen, y, dur)
        y -= 5*mm

        try: qty_str = str(int(float(item.get("quantity", 1))))
        except: qty_str = str(item.get("quantity", 1))

        fc(*GRIS_OSC); can.setFont("Helvetica", 8.5)
        infline = f"Cant. {qty_str}"
        if serials:
            stxt = ", ".join(serials)
            if len(stxt) > 50: stxt = stxt[:47] + "..."
            infline += f"   ·   Serial {stxt}"
        if wp:
            infline += f"   ·   {wp.name}"
        can.drawString(margen, y, infline)
        y -= 5*mm

        if desc:
            fc(*GRIS_OSC); can.setFont("Helvetica-Oblique", 8.5)
            for ln in _wrap_text(desc, 100):
                can.drawString(margen, y, ln); y -= 4*mm

        if item.get("warranty_expiration"):
            exp = item["warranty_expiration"]
            exp_str = exp.strftime("%d/%m/%Y") if isinstance(exp, datetime) else str(exp)
            fc(*GRIS_OSC); can.setFont("Helvetica", 8.5)
            can.drawString(margen, y, f"Vence  ·  {exp_str}")
            y -= 5*mm

        # Línea separadora entre equipos
        sc(*GRIS_TENUE); can.setLineWidth(0.3)
        can.line(margen, y, margen + 30*mm, y)
        y -= 7*mm

    # Línea decorativa antes de firma
    y = max(y - 8*mm, 60*mm)
    sc(*GRIS_TENUE); can.setLineWidth(0.3)
    can.line(margen, y, w - margen, y)
    y -= 30*mm

    # Firma elegante centrada
    lw = 90*mm
    sc(*NEGRO); can.setLineWidth(0.5)
    can.line(cx - lw/2, y, cx + lw/2, y)
    fc(*GRIS_MED); can.setFont("Helvetica", 7)
    can.drawCentredString(cx, y - 5*mm, "F I R M A   D E L   C L I E N T E")
    if customer_name:
        fc(*NEGRO); can.setFont("Helvetica", 9)
        can.drawCentredString(cx, y - 11*mm, customer_name)
    if customer_doc:
        fc(*GRIS_MED); can.setFont("Helvetica", 8)
        can.drawCentredString(cx, y - 15*mm, customer_doc)

    # Footer súper minimal
    fc(*GRIS_TENUE); can.setFont("Helvetica", 7)
    can.drawString(margen, 12*mm, business_name or "Mi Negocio")
    can.drawRightString(w - margen, 12*mm, f"#{str(sale_id).zfill(6)}")

    can.save(); buffer.seek(0); return buffer.read()




# ══════════════════════════════════════════════════════════════════════════════
# PLANTILLA 4: CORPORATIVO (banda azul ejecutiva + dorado)
# ══════════════════════════════════════════════════════════════════════════════

def render_corporativo(
    imei_items, business_name, business_rif, business_address, business_phone, business_logo, business_logo_size,
    customer_name, customer_doc, customer_phone, customer_email,
    sale_date, sale_total, sale_id,
) -> bytes:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm

    buffer = io.BytesIO()
    w, h = A4
    can = canvas.Canvas(buffer, pagesize=A4)

    AZUL_EJEC  = (0.08, 0.15, 0.35)   # azul marino corporativo
    AZUL_CLAR  = (0.92, 0.94, 0.98)
    DORADO     = (0.72, 0.55, 0.18)   # dorado elegante
    DORADO_BG  = (0.99, 0.96, 0.88)
    NEGRO      = (0.10, 0.10, 0.10)
    GRIS_OSC   = (0.30, 0.30, 0.30)
    GRIS_MED   = (0.55, 0.55, 0.55)
    GRIS_LINE  = (0.85, 0.85, 0.85)

    def fc(*rgb): can.setFillColorRGB(*rgb)
    def sc(*rgb): can.setStrokeColorRGB(*rgb)

    margen = 0
    cx = w / 2

    # ── Banda azul ejecutiva top (full width) ──
    band_h = 38*mm
    fc(*AZUL_EJEC)
    can.rect(0, h - band_h, w, band_h, fill=1, stroke=0)

    _logo_path = _resolve_logo_path(business_logo)
    _logo_s = _logo_scale(business_logo_size)
    if _logo_path:
        _draw_logo(can, _logo_path, 16*mm, h - 8*mm, 22*mm*_logo_s, 22*mm*_logo_s)

    # Subbanda dorada delgada
    fc(*DORADO)
    can.rect(0, h - band_h - 2*mm, w, 2*mm, fill=1, stroke=0)

    # Título en la banda
    fc(1, 1, 1)
    can.setFont("Helvetica", 8)
    can.drawCentredString(cx, h - 12*mm, "C E R T I F I C A D O   D E   G A R A N T I A   O F I C I A L")
    can.setFont("Helvetica-Bold", 26)
    can.drawCentredString(cx, h - 23*mm, (business_name or "Mi Negocio").upper())
    fc(*DORADO)
    can.setFont("Helvetica", 9)
    info_parts = []
    if business_rif:     info_parts.append(f"RIF {business_rif}")
    if business_phone:   info_parts.append(f"Tel {business_phone}")
    if business_address: info_parts.append(business_address)
    if info_parts:
        can.drawCentredString(cx, h - 32*mm, "  ·  ".join(info_parts))

    y = h - band_h - 14*mm

    # ── N° garantía en card dorado al centro ──
    card_w, card_h = 90*mm, 18*mm
    card_x = cx - card_w/2
    sc(*DORADO); can.setLineWidth(2); fc(1, 1, 1)
    can.rect(card_x, y - card_h, card_w, card_h, fill=1, stroke=1)

    fc(*GRIS_MED); can.setFont("Helvetica", 7.5)
    can.drawString(card_x + 5*mm, y - 5*mm, "N° DE GARANTIA")
    fc(*AZUL_EJEC); can.setFont("Helvetica-Bold", 18)
    can.drawString(card_x + 5*mm, y - 13*mm, f"#{str(sale_id).zfill(6)}")

    fc(*GRIS_MED); can.setFont("Helvetica", 7.5)
    can.drawRightString(card_x + card_w - 5*mm, y - 5*mm, "FECHA EMISION")
    fc(*AZUL_EJEC); can.setFont("Helvetica-Bold", 11)
    can.drawRightString(card_x + card_w - 5*mm, y - 13*mm, sale_date or "")
    y -= card_h + 12*mm

    pmargen = 18*mm
    inner_w = w - 2*pmargen

    # ── 2 columnas venta/cliente ──
    col_w = (inner_w - 6*mm) / 2
    cl, cr = pmargen, pmargen + col_w + 6*mm

    fc(*AZUL_EJEC)
    can.rect(cl, y - 1*mm, 4*mm, 7*mm, fill=1, stroke=0)
    can.rect(cr, y - 1*mm, 4*mm, 7*mm, fill=1, stroke=0)

    fc(*AZUL_EJEC); can.setFont("Helvetica-Bold", 10)
    can.drawString(cl + 6*mm, y + 1.5*mm, "DATOS DE LA VENTA")
    can.drawString(cr + 6*mm, y + 1.5*mm, "DATOS DEL CLIENTE")
    y -= 8*mm

    fc(*GRIS_OSC); can.setFont("Helvetica", 9.5)
    y_left = y
    for k, v in [("Factura", f"#{sale_id}"), ("Fecha", sale_date or "—"), ("Total", sale_total or "—")]:
        fc(*GRIS_MED); can.setFont("Helvetica", 7.5); can.drawString(cl + 6*mm, y_left, k.upper())
        fc(*NEGRO); can.setFont("Helvetica-Bold", 10); can.drawString(cl + 24*mm, y_left, str(v))
        y_left -= 5*mm

    y_right = y
    rows = [("Nombre", customer_name or "Cliente General"),
            ("Documento", customer_doc), ("Teléfono", customer_phone), ("Email", customer_email)]
    for k, v in rows:
        if not v: continue
        fc(*GRIS_MED); can.setFont("Helvetica", 7.5); can.drawString(cr + 6*mm, y_right, k.upper())
        fc(*NEGRO); can.setFont("Helvetica-Bold", 10); can.drawString(cr + 24*mm, y_right, str(v)[:30])
        y_right -= 5*mm

    y = min(y_left, y_right) - 5*mm

    # ── Equipos ──
    fc(*AZUL_EJEC); can.rect(pmargen, y - 1*mm, 4*mm, 7*mm, fill=1, stroke=0)
    can.setFont("Helvetica-Bold", 10)
    can.drawString(pmargen + 6*mm, y + 1.5*mm, "EQUIPOS AMPARADOS")
    y -= 9*mm

    for item in imei_items:
        wp = item.get("warranty_policy")
        serials = item.get("serials", [])
        desc = getattr(wp, "description", None) if wp else None
        dl = _wrap_text(desc or "", 90)
        block_h = 18*mm + (5*mm if wp else 0) + (len(dl)*4*mm + 1*mm if dl else 0) + (5*mm if item.get("warranty_expiration") else 0)
        block_h = max(block_h, 24*mm)

        sc(*AZUL_EJEC); can.setLineWidth(1.5); fc(*AZUL_CLAR)
        can.rect(pmargen, y - block_h, inner_w, block_h, fill=1, stroke=1)
        fc(*DORADO); can.rect(pmargen, y - block_h, inner_w, 2*mm, fill=1, stroke=0)

        yy = y - 6*mm
        fc(*AZUL_EJEC); can.setFont("Helvetica-Bold", 13)
        can.drawString(pmargen + 6*mm, yy, item["product_name"])

        if wp:
            dur = f"{wp.duration} {UNIT_MAP.get(wp.type, 'dias')}" if wp.duration else UNIT_MAP.get(wp.type, "")
            if dur:
                bl = dur.upper()
                bw = max(28*mm, len(bl) * 2.2*mm + 6*mm)
                bx = w - pmargen - bw - 2*mm
                fc(*DORADO); can.rect(bx, yy - 1*mm, bw, 6*mm, fill=1, stroke=0)
                fc(1,1,1); can.setFont("Helvetica-Bold", 9)
                can.drawCentredString(bx + bw/2, yy + 0.8*mm, bl)
        yy -= 6*mm

        try: qty_str = str(int(float(item.get("quantity", 1))))
        except: qty_str = str(item.get("quantity", 1))
        fc(*GRIS_OSC); can.setFont("Helvetica", 9)
        can.drawString(pmargen + 6*mm, yy, f"Cantidad: {qty_str}")
        if serials:
            stxt = ", ".join(serials)
            if len(stxt) > 50: stxt = stxt[:47] + "..."
            can.drawString(pmargen + 40*mm, yy, f"Serial: {stxt}")
        yy -= 5*mm

        if wp:
            fc(*AZUL_EJEC); can.setFont("Helvetica-Bold", 9.5)
            can.drawString(pmargen + 6*mm, yy, f"Política: {wp.name}")
            yy -= 5*mm
            if dl:
                fc(*GRIS_OSC); can.setFont("Helvetica-Oblique", 8.5)
                for ln in dl:
                    can.drawString(pmargen + 6*mm, yy, ln); yy -= 4*mm

        if item.get("warranty_expiration"):
            exp = item["warranty_expiration"]
            exp_str = exp.strftime("%d/%m/%Y") if isinstance(exp, datetime) else str(exp)
            fc(*DORADO); can.setFont("Helvetica-Bold", 9.5)
            can.drawString(pmargen + 6*mm, yy, f"Vencimiento: {exp_str}")

        y -= block_h + 4*mm

    # ── Cláusulas ejecutivas ──
    y -= 2*mm
    fc(*AZUL_EJEC); can.rect(pmargen, y - 1*mm, 4*mm, 7*mm, fill=1, stroke=0)
    can.setFont("Helvetica-Bold", 10)
    can.drawString(pmargen + 6*mm, y + 1.5*mm, "TERMINOS Y CONDICIONES")
    y -= 9*mm

    clausulas = [
        "I. Esta garantía cubre defectos de fabricación, fallas técnicas internas y mal funcionamiento del equipo.",
        "II. No se cubren daños por mal uso, caídas, contacto con líquidos o modificaciones no autorizadas.",
        "III. La garantía es personal e intransferible y debe ser presentada junto al comprobante de pago.",
        "IV. El reclamo debe efectuarse en el local de compra dentro del horario laboral.",
    ]
    fc(*GRIS_OSC); can.setFont("Helvetica", 9)
    for c in clausulas:
        lns = _wrap_text(c, 105)
        for ln in lns:
            can.drawString(pmargen + 6*mm, y, ln); y -= 4.2*mm
        y -= 1.5*mm

    # ── Firma ──
    firma_y = max(y - 4*mm, 38*mm); lw = 80*mm
    sc(*AZUL_EJEC); can.setLineWidth(1.2)
    can.line(cx - lw/2, firma_y, cx + lw/2, firma_y)
    fc(*AZUL_EJEC); can.setFont("Helvetica-Bold", 10)
    can.drawCentredString(cx, firma_y - 5*mm, "FIRMA DEL CLIENTE")
    if customer_name:
        fc(*GRIS_OSC); can.setFont("Helvetica", 9)
        can.drawCentredString(cx, firma_y - 10*mm, customer_name)
    if customer_doc:
        fc(*GRIS_MED); can.setFont("Helvetica", 8)
        can.drawCentredString(cx, firma_y - 14*mm, f"C.I.: {customer_doc}")

    # ── Footer banda dorada ──
    fc(*DORADO); can.rect(0, 0, w, 4*mm, fill=1, stroke=0)
    fc(*AZUL_EJEC); can.rect(0, 4*mm, w, 8*mm, fill=1, stroke=0)
    fc(1, 1, 1); can.setFont("Helvetica", 8)
    can.drawString(pmargen, 7*mm, f"{business_name or 'Mi Negocio'}")
    can.drawCentredString(cx, 7*mm, f"Documento N° {str(sale_id).zfill(6)}")
    can.drawRightString(w - pmargen, 7*mm, "Certificado Oficial")

    can.save(); buffer.seek(0); return buffer.read()


# ══════════════════════════════════════════════════════════════════════════════
# PLANTILLA 5: COLORIDO (vibrante, amigable, gradientes)
# ══════════════════════════════════════════════════════════════════════════════

def render_colorido(
    imei_items, business_name, business_rif, business_address, business_phone, business_logo, business_logo_size,
    customer_name, customer_doc, customer_phone, customer_email,
    sale_date, sale_total, sale_id,
) -> bytes:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm

    buffer = io.BytesIO()
    w, h = A4
    can = canvas.Canvas(buffer, pagesize=A4)

    PURPURA  = (0.55, 0.20, 0.85)
    ROSA     = (0.95, 0.30, 0.55)
    NARANJA  = (0.97, 0.45, 0.15)
    VERDE    = (0.20, 0.75, 0.45)
    AZUL     = (0.25, 0.55, 0.95)
    AMARILLO = (0.98, 0.80, 0.15)
    NEGRO    = (0.15, 0.15, 0.20)
    GRIS_OSC = (0.40, 0.40, 0.45)
    GRIS_MED = (0.60, 0.60, 0.65)

    def fc(*rgb): can.setFillColorRGB(*rgb)
    def sc(*rgb): can.setStrokeColorRGB(*rgb)

    margen = 14*mm
    cx = w / 2
    inner_w = w - 2*margen

    # ── Header con gradiente simulado (4 bandas de color) ──
    band_y = h - 8*mm
    band_w = w / 4
    for i, color in enumerate([PURPURA, ROSA, NARANJA, AMARILLO]):
        fc(*color); can.rect(i * band_w, band_y, band_w, 8*mm, fill=1, stroke=0)

    _logo_path = _resolve_logo_path(business_logo)
    _logo_s = _logo_scale(business_logo_size)
    if _logo_path:
        _draw_logo(can, _logo_path, cx, h - 12*mm, 24*mm*_logo_s, 18*mm*_logo_s, center_x=True)

    y = h - 24*mm

    # Emojis decorativos
    fc(*NEGRO); can.setFont("Helvetica-Bold", 9)
    can.drawCentredString(cx, y, "✨  C E R T I F I C A D O   D E   G A R A N T I A  ✨")
    y -= 14*mm

    # Nombre con tipografía juvenil
    fc(*PURPURA); can.setFont("Helvetica-Bold", 28)
    can.drawCentredString(cx, y, (business_name or "Mi Negocio").upper())
    y -= 7*mm

    info_parts = []
    if business_rif:     info_parts.append(f"📋 {business_rif}")
    if business_phone:   info_parts.append(f"📞 {business_phone}")
    if business_address: info_parts.append(f"📍 {business_address}")
    if info_parts:
        fc(*GRIS_OSC); can.setFont("Helvetica", 8.5)
        can.drawCentredString(cx, y, "   ".join(info_parts))
    y -= 11*mm

    # N° garantía como sticker
    sticker_w, sticker_h = 80*mm, 16*mm
    sx = cx - sticker_w/2
    fc(*AMARILLO)
    can.roundRect(sx + 2*mm, y - sticker_h - 1.5*mm, sticker_w, sticker_h, 4*mm, fill=1, stroke=0)  # sombra
    fc(*ROSA)
    can.roundRect(sx, y - sticker_h, sticker_w, sticker_h, 4*mm, fill=1, stroke=0)
    fc(1, 1, 1); can.setFont("Helvetica", 8)
    can.drawCentredString(cx, y - 5*mm, "TU GARANTIA")
    can.setFont("Helvetica-Bold", 16)
    can.drawCentredString(cx, y - 12*mm, f"#{str(sale_id).zfill(6)}")
    y -= sticker_h + 8*mm

    fc(*GRIS_OSC); can.setFont("Helvetica-Bold", 9)
    can.drawCentredString(cx, y, f"📅  Emitido: {sale_date}")
    y -= 10*mm

    # ── Cliente con icono ──
    fc(*AZUL); can.setFont("Helvetica-Bold", 10)
    can.drawString(margen, y, "👤  CLIENTE")
    sc(*AZUL); can.setLineWidth(1.5)
    can.line(margen, y - 2*mm, margen + 20*mm, y - 2*mm)
    y -= 7*mm
    fc(*NEGRO); can.setFont("Helvetica-Bold", 13)
    can.drawString(margen, y, customer_name or "Cliente General")
    y -= 5*mm
    parts = [p for p in [customer_doc, customer_phone, customer_email] if p]
    if parts:
        fc(*GRIS_OSC); can.setFont("Helvetica", 9)
        can.drawString(margen, y, "  ·  ".join(parts))
    y -= 5*mm
    fc(*GRIS_MED); can.setFont("Helvetica", 8.5)
    can.drawString(margen, y, f"🧾  Factura #{sale_id}  ·  {sale_total}")
    y -= 12*mm

    # ── Equipos con cards de colores ──
    fc(*VERDE); can.setFont("Helvetica-Bold", 10)
    can.drawString(margen, y, "📦  EQUIPOS AMPARADOS")
    sc(*VERDE); can.setLineWidth(1.5)
    can.line(margen, y - 2*mm, margen + 45*mm, y - 2*mm)
    y -= 8*mm

    item_colors = [(PURPURA, ROSA), (AZUL, VERDE), (NARANJA, AMARILLO)]
    for idx, item in enumerate(imei_items):
        wp = item.get("warranty_policy")
        serials = item.get("serials", [])
        desc = getattr(wp, "description", None) if wp else None
        dl = _wrap_text(desc or "", 90)
        c1, c2 = item_colors[idx % len(item_colors)]
        block_h = 18*mm + (5*mm if wp else 0) + (len(dl)*4*mm + 1*mm if dl else 0) + (5*mm if item.get("warranty_expiration") else 0)
        block_h = max(block_h, 24*mm)

        # Card con fondo blanco + borde de color
        sc(*c1); can.setLineWidth(2); fc(1, 1, 1)
        can.roundRect(margen, y - block_h, inner_w, block_h, 4*mm, fill=1, stroke=1)

        # Cinta superior del color
        fc(*c1); can.roundRect(margen, y - 7*mm, 35*mm, 7*mm, 3*mm, fill=1, stroke=0)
        fc(1, 1, 1); can.setFont("Helvetica-Bold", 8)
        can.drawString(margen + 4*mm, y - 5*mm, f"EQUIPO {idx + 1}")

        yy = y - 12*mm
        fc(*NEGRO); can.setFont("Helvetica-Bold", 13)
        can.drawString(margen + 5*mm, yy, f"📱 {item['product_name']}")

        if wp:
            dur = f"{wp.duration} {UNIT_MAP.get(wp.type, 'dias')}" if wp.duration else UNIT_MAP.get(wp.type, "")
            if dur:
                bl = dur.upper()
                bw = max(30*mm, len(bl) * 2.3*mm + 8*mm)
                bx = w - margen - bw - 3*mm
                fc(*c2); can.roundRect(bx, yy - 2*mm, bw, 7*mm, 3*mm, fill=1, stroke=0)
                fc(1, 1, 1); can.setFont("Helvetica-Bold", 9.5)
                can.drawCentredString(bx + bw/2, yy + 0.5*mm, f"⏱ {bl}")
        yy -= 6*mm

        try: qty_str = str(int(float(item.get("quantity", 1))))
        except: qty_str = str(item.get("quantity", 1))
        fc(*GRIS_OSC); can.setFont("Helvetica", 9)
        can.drawString(margen + 5*mm, yy, f"🔢 Cant: {qty_str}")
        if serials:
            stxt = ", ".join(serials); stxt = stxt[:47] + "..." if len(stxt) > 50 else stxt
            can.drawString(margen + 30*mm, yy, f"🆔 {stxt}")
        yy -= 5*mm

        if wp:
            fc(*c1); can.setFont("Helvetica-Bold", 9.5)
            can.drawString(margen + 5*mm, yy, f"🛡 {wp.name}")
            yy -= 5*mm
            if dl:
                fc(*GRIS_OSC); can.setFont("Helvetica-Oblique", 8.5)
                for ln in dl:
                    can.drawString(margen + 5*mm, yy, ln); yy -= 4*mm

        if item.get("warranty_expiration"):
            exp = item["warranty_expiration"]
            exp_str = exp.strftime("%d/%m/%Y") if isinstance(exp, datetime) else str(exp)
            fc(*ROSA); can.setFont("Helvetica-Bold", 9.5)
            can.drawString(margen + 5*mm, yy, f"⏰ Vence: {exp_str}")

        y -= block_h + 4*mm

    # ── Mini sección de tips coloridos ──
    y -= 3*mm
    fc(*NARANJA); can.setFont("Helvetica-Bold", 9.5)
    can.drawString(margen, y, "💡  TIPS PARA TU GARANTIA")
    y -= 6*mm
    tips = [
        "✓  Guarda este certificado en un lugar seguro",
        "✓  Llevalo siempre con el comprobante de pago",
        "✓  Solo cubre defectos de fabricacion",
        "✗  No cubre golpes, caidas ni mal uso",
    ]
    for tip in tips:
        is_check = tip.startswith("✓")
        tip_color = VERDE if is_check else ROSA
        fc(*tip_color)
        can.setFont("Helvetica", 9.5)
        can.drawString(margen, y, tip)
        y -= 4.5*mm

    # ── Firma con corazón ──
    firma_y = max(y - 5*mm, 36*mm); lw = 80*mm
    sc(*PURPURA); can.setLineWidth(1.2)
    can.line(cx - lw/2, firma_y, cx + lw/2, firma_y)
    fc(*PURPURA); can.setFont("Helvetica-Bold", 10)
    can.drawCentredString(cx, firma_y - 5*mm, "✍  FIRMA DEL CLIENTE")
    if customer_name:
        fc(*NEGRO); can.setFont("Helvetica-Bold", 9.5)
        can.drawCentredString(cx, firma_y - 10*mm, customer_name)
    if customer_doc:
        fc(*GRIS_MED); can.setFont("Helvetica", 8)
        can.drawCentredString(cx, firma_y - 14*mm, f"C.I.: {customer_doc}")

    # ── Footer con cinta multicolor ──
    for i, color in enumerate([PURPURA, ROSA, NARANJA, AMARILLO, VERDE]):
        fc(*color); can.rect(i * w/5, 0, w/5, 4*mm, fill=1, stroke=0)

    fc(*NEGRO); can.setFont("Helvetica", 8)
    can.drawCentredString(cx, 7*mm, f"💜  {business_name or 'Mi Negocio'}  ·  #{str(sale_id).zfill(6)}  ·  Gracias por tu compra  💜")

    can.save(); buffer.seek(0); return buffer.read()


# ══════════════════════════════════════════════════════════════════════════════
# PLANTILLA 6: PREMIUM (negro + dorado, lujo)
# ══════════════════════════════════════════════════════════════════════════════

def render_premium(
    imei_items, business_name, business_rif, business_address, business_phone, business_logo, business_logo_size,
    customer_name, customer_doc, customer_phone, customer_email,
    sale_date, sale_total, sale_id,
) -> bytes:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm

    buffer = io.BytesIO()
    w, h = A4
    can = canvas.Canvas(buffer, pagesize=A4)

    NEGRO_LUJO = (0.05, 0.05, 0.05)
    NEGRO_BG   = (0.10, 0.10, 0.10)
    DORADO     = (0.78, 0.62, 0.20)
    DORADO_CL  = (0.95, 0.85, 0.55)
    GRIS_OSC   = (0.30, 0.30, 0.30)
    GRIS_MED   = (0.55, 0.55, 0.55)
    BLANCO     = (1.0, 1.0, 1.0)
    CREMA      = (0.99, 0.97, 0.92)

    def fc(*rgb): can.setFillColorRGB(*rgb)
    def sc(*rgb): can.setStrokeColorRGB(*rgb)

    # ── Fondo crema con marco dorado ──
    fc(*CREMA); can.rect(0, 0, w, h, fill=1, stroke=0)

    # Marco dorado doble
    sc(*DORADO); can.setLineWidth(2)
    can.rect(8*mm, 8*mm, w - 16*mm, h - 16*mm, fill=0, stroke=1)
    can.setLineWidth(0.5)
    can.rect(11*mm, 11*mm, w - 22*mm, h - 22*mm, fill=0, stroke=1)

    margen = 18*mm
    cx = w / 2
    inner_w = w - 2*margen

    _logo_path = _resolve_logo_path(business_logo)
    _logo_s = _logo_scale(business_logo_size)
    if _logo_path:
        _draw_logo(can, _logo_path, cx, h - 18*mm, 26*mm*_logo_s, 20*mm*_logo_s, center_x=True)

    y = h - 25*mm

    # Ornamento decorativo (tres puntos)
    fc(*DORADO); can.setFont("Helvetica-Bold", 14)
    can.drawCentredString(cx, y, "❖ ❖ ❖")
    y -= 8*mm

    # Etiqueta
    fc(*DORADO); can.setFont("Helvetica", 8.5)
    can.drawCentredString(cx, y, "C E R T I F I C A D O   D E   G A R A N T I A   P R E M I U M")
    y -= 10*mm

    # Nombre en grande, dorado
    fc(*NEGRO_LUJO); can.setFont("Helvetica-Bold", 26)
    can.drawCentredString(cx, y, (business_name or "Mi Negocio").upper())
    y -= 5*mm

    # Línea decorativa dorada con diamante en el medio
    sc(*DORADO); can.setLineWidth(0.8)
    can.line(cx - 35*mm, y, cx - 6*mm, y)
    can.line(cx + 6*mm, y, cx + 35*mm, y)
    fc(*DORADO); can.setFont("Helvetica", 11)
    can.drawCentredString(cx, y - 1*mm, "◆")
    y -= 8*mm

    info_parts = []
    if business_rif:     info_parts.append(f"RIF {business_rif}")
    if business_phone:   info_parts.append(business_phone)
    if business_address: info_parts.append(business_address)
    if info_parts:
        fc(*GRIS_OSC); can.setFont("Helvetica-Oblique", 9)
        can.drawCentredString(cx, y, "  ·  ".join(info_parts))
    y -= 14*mm

    # Cartouche negro con dorado dentro
    card_w, card_h = 100*mm, 22*mm
    card_x = cx - card_w/2
    fc(*NEGRO_BG)
    can.rect(card_x, y - card_h, card_w, card_h, fill=1, stroke=0)
    sc(*DORADO); can.setLineWidth(1)
    can.rect(card_x + 2*mm, y - card_h + 2*mm, card_w - 4*mm, card_h - 4*mm, fill=0, stroke=1)

    fc(*DORADO_CL); can.setFont("Helvetica", 7.5)
    can.drawCentredString(cx, y - 6*mm, "CERTIFICADO N°")
    fc(*DORADO); can.setFont("Helvetica-Bold", 16)
    can.drawCentredString(cx, y - 13*mm, f"#{str(sale_id).zfill(6)}")
    fc(*DORADO_CL); can.setFont("Helvetica-Oblique", 8)
    can.drawCentredString(cx, y - 18*mm, f"Emitido: {sale_date}")
    y -= card_h + 10*mm

    # ── Cliente con estilo formal ──
    fc(*DORADO); can.setFont("Helvetica-Bold", 9.5)
    can.drawString(margen, y, "◆ DISTINGUIDO CLIENTE")
    y -= 6*mm

    fc(*NEGRO_LUJO); can.setFont("Helvetica-Bold", 14)
    can.drawString(margen, y, customer_name or "Cliente General")
    y -= 6*mm

    cli_parts = []
    if customer_doc:   cli_parts.append(f"Documento: {customer_doc}")
    if customer_phone: cli_parts.append(f"Tel: {customer_phone}")
    if customer_email: cli_parts.append(customer_email)
    fc(*GRIS_OSC); can.setFont("Helvetica", 9)
    if cli_parts:
        can.drawString(margen, y, "  ·  ".join(cli_parts))
    y -= 5*mm
    fc(*GRIS_MED); can.setFont("Helvetica-Oblique", 8.5)
    can.drawString(margen, y, f"Factura #{sale_id}  ·  Total: {sale_total}")
    y -= 12*mm

    # ── Equipos lujosos ──
    fc(*DORADO); can.setFont("Helvetica-Bold", 9.5)
    can.drawString(margen, y, "◆ ARTICULOS AMPARADOS")
    sc(*DORADO); can.setLineWidth(0.8); can.line(margen, y - 2*mm, w - margen, y - 2*mm)
    y -= 8*mm

    for item in imei_items:
        wp = item.get("warranty_policy")
        serials = item.get("serials", [])
        desc = getattr(wp, "description", None) if wp else None
        dl = _wrap_text(desc or "", 95)
        block_h = 18*mm + (5*mm if wp else 0) + (len(dl)*4*mm + 1*mm if dl else 0) + (5*mm if item.get("warranty_expiration") else 0)
        block_h = max(block_h, 24*mm)

        sc(*DORADO); can.setLineWidth(0.6); fc(*BLANCO)
        can.rect(margen, y - block_h, inner_w, block_h, fill=1, stroke=1)
        fc(*DORADO); can.rect(margen, y - block_h, 2*mm, block_h, fill=1, stroke=0)

        yy = y - 6*mm
        fc(*NEGRO_LUJO); can.setFont("Helvetica-Bold", 13)
        can.drawString(margen + 6*mm, yy, item["product_name"])

        if wp:
            dur = f"{wp.duration} {UNIT_MAP.get(wp.type, 'dias')}" if wp.duration else UNIT_MAP.get(wp.type, "")
            if dur:
                bl = dur.upper()
                bw = max(28*mm, len(bl) * 2.2*mm + 6*mm)
                bx = w - margen - bw - 2*mm
                fc(*NEGRO_BG); can.rect(bx, yy - 1.5*mm, bw, 6*mm, fill=1, stroke=0)
                sc(*DORADO); can.setLineWidth(0.5)
                can.rect(bx, yy - 1.5*mm, bw, 6*mm, fill=0, stroke=1)
                fc(*DORADO); can.setFont("Helvetica-Bold", 8.5)
                can.drawCentredString(bx + bw/2, yy + 0.5*mm, bl)
        yy -= 5*mm

        try: qty_str = str(int(float(item.get("quantity", 1))))
        except: qty_str = str(item.get("quantity", 1))
        fc(*GRIS_OSC); can.setFont("Helvetica-Oblique", 9)
        info = f"Cantidad: {qty_str}"
        if serials:
            stxt = ", ".join(serials); stxt = stxt[:47] + "..." if len(stxt) > 50 else stxt
            info += f"   ·   Serial: {stxt}"
        can.drawString(margen + 6*mm, yy, info)
        yy -= 5*mm

        if wp:
            fc(*DORADO); can.setFont("Helvetica-Bold", 9.5)
            can.drawString(margen + 6*mm, yy, f"◆ {wp.name}")
            yy -= 5*mm
            if dl:
                fc(*GRIS_OSC); can.setFont("Helvetica-Oblique", 8.5)
                for ln in dl:
                    can.drawString(margen + 6*mm, yy, ln); yy -= 4*mm

        if item.get("warranty_expiration"):
            exp = item["warranty_expiration"]
            exp_str = exp.strftime("%d/%m/%Y") if isinstance(exp, datetime) else str(exp)
            fc(*NEGRO_LUJO); can.setFont("Helvetica-Bold", 9.5)
            can.drawString(margen + 6*mm, yy, f"Vencimiento: {exp_str}")

        y -= block_h + 4*mm

    # ── Cláusulas elegantes ──
    y -= 2*mm
    fc(*DORADO); can.setFont("Helvetica-Bold", 9.5)
    can.drawString(margen, y, "◆ CONDICIONES DE LA GARANTIA")
    sc(*DORADO); can.setLineWidth(0.8); can.line(margen, y - 2*mm, w - margen, y - 2*mm)
    y -= 7*mm
    clausulas = [
        "La presente garantía cubre defectos de fabricación y fallas técnicas internas.",
        "Excluye daños por mal uso, accidentes o modificaciones no autorizadas.",
        "Presente este certificado original junto al comprobante de pago.",
        "Garantía personal e intransferible, válida en el local de compra.",
    ]
    fc(*GRIS_OSC); can.setFont("Helvetica", 8.5)
    for c in clausulas:
        fc(*DORADO); can.setFont("Helvetica-Bold", 8.5); can.drawString(margen, y, "◆")
        fc(*GRIS_OSC); can.setFont("Helvetica", 8.5); can.drawString(margen + 4*mm, y, c)
        y -= 5*mm

    # ── Firma elegante ──
    firma_y = max(y - 5*mm, 38*mm); lw = 80*mm
    sc(*DORADO); can.setLineWidth(1)
    can.line(cx - lw/2, firma_y, cx + lw/2, firma_y)
    # Ornamentos en los extremos
    fc(*DORADO); can.setFont("Helvetica", 10)
    can.drawCentredString(cx - lw/2 - 4*mm, firma_y - 1*mm, "❖")
    can.drawCentredString(cx + lw/2 + 4*mm, firma_y - 1*mm, "❖")

    fc(*DORADO); can.setFont("Helvetica-Bold", 9.5)
    can.drawCentredString(cx, firma_y - 5*mm, "F I R M A   D E L   C L I E N T E")
    if customer_name:
        fc(*NEGRO_LUJO); can.setFont("Helvetica-Bold", 9.5)
        can.drawCentredString(cx, firma_y - 10*mm, customer_name)
    if customer_doc:
        fc(*GRIS_MED); can.setFont("Helvetica-Oblique", 8.5)
        can.drawCentredString(cx, firma_y - 14*mm, f"C.I.: {customer_doc}")

    # ── Footer ──
    fc(*DORADO); can.setFont("Helvetica", 8.5)
    can.drawCentredString(cx, 16*mm, "❖")
    fc(*GRIS_MED); can.setFont("Helvetica-Oblique", 7.5)
    can.drawCentredString(cx, 12*mm, f"{business_name or 'Mi Negocio'}  ·  Documento N° {str(sale_id).zfill(6)}  ·  Certificado Premium")

    can.save(); buffer.seek(0); return buffer.read()





# ══════════════════════════════════════════════════════════════════════════════
# PLANTILLA 7: LEGAL (2 páginas — documento formal completo)
# ══════════════════════════════════════════════════════════════════════════════

def render_legal(
    imei_items, business_name, business_rif, business_address, business_phone, business_logo, business_logo_size,
    customer_name, customer_doc, customer_phone, customer_email,
    sale_date, sale_total, sale_id,
) -> bytes:
    """Documento legal de UNA PÁGINA: datos + términos + firma. Autorrelleno."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm

    buffer = io.BytesIO()
    w, h = A4
    can = canvas.Canvas(buffer, pagesize=A4)

    NEGRO    = (0.10, 0.10, 0.10)
    GRIS_OSC = (0.30, 0.30, 0.30)
    GRIS_MED = (0.55, 0.55, 0.55)
    GRIS_LINE = (0.75, 0.75, 0.75)
    AZUL_AC  = (0.15, 0.30, 0.55)

    def fc(*rgb): can.setFillColorRGB(*rgb)
    def sc(*rgb): can.setStrokeColorRGB(*rgb)

    margen = 14*mm
    cx = w / 2
    inner_w = w - 2*margen

    # Logo: ancla la BASE (parte inferior) en una línea fija y crece HACIA ARRIBA.
    # Como se dibuja PRIMERO, el texto queda encima si hay overlap visual.
    # El contenido del documento NO se mueve.
    _logo_path = _resolve_logo_path(business_logo)
    _logo_s = _logo_scale(business_logo_size)
    _logo_drawn = False
    if _logo_path:
        # Ancla bottom del logo en h - 28mm (justo encima del separador del header)
        _logo_w = 28*mm*_logo_s
        _logo_h = 22*mm*_logo_s
        # y_top para _draw_logo (que internamente dibuja desde y-dh hacia arriba)
        _logo_top = h - 28*mm + _logo_h
        _logo_drawn = _draw_logo(can, _logo_path, margen, _logo_top, _logo_w, _logo_h)

    # ── FECHA al mismo nivel que el nombre de la compañia (h - 15mm) ──
    fc(*GRIS_MED); can.setFont("Helvetica", 7)
    can.drawRightString(w - margen, h - 11*mm, "FECHA DE EMISION")
    fc(*AZUL_AC); can.setFont("Helvetica-Bold", 14)
    can.drawRightString(w - margen, h - 15*mm, sale_date or "")

    def draw_dotted_line(x1, y, x2, label_value=""):
        sc(*GRIS_LINE); can.setLineWidth(0.4)
        can.setDash(1, 2); can.line(x1, y, x2, y); can.setDash([])
        if label_value:
            fc(*NEGRO); can.setFont("Helvetica-Bold", 8.5)
            can.drawString(x1 + 1.5*mm, y + 0.8*mm, str(label_value))

    def draw_field(x, y, label, value, line_w):
        fc(*GRIS_OSC); can.setFont("Helvetica-Bold", 7.5)
        can.drawString(x, y, f"{label}:")
        label_w = can.stringWidth(f"{label}:", "Helvetica-Bold", 7.5)
        draw_dotted_line(x + label_w + 1*mm, y - 0.5*mm, x + line_w, value)

    # Header: posición fija (NO se desplaza por el logo, alineado verticalmente con él)
    y = h - 15*mm
    fc(*AZUL_AC); can.setFont("Helvetica-Bold", 13)
    can.drawCentredString(cx, y, (business_name or "Mi Negocio").upper())
    y -= 4*mm

    info_parts = []
    if business_rif:     info_parts.append(f"RIF {business_rif}")
    if business_phone:   info_parts.append(f"Tel {business_phone}")
    if business_address: info_parts.append(business_address)
    if info_parts:
        fc(*GRIS_OSC); can.setFont("Helvetica", 7.5)
        can.drawCentredString(cx, y, "  ·  ".join(info_parts))
    y -= 5*mm

    sc(*NEGRO); can.setLineWidth(1); can.line(margen, y, w - margen, y); y -= 5*mm

    fc(*NEGRO); can.setFont("Helvetica-Bold", 12)
    can.drawCentredString(cx, y, "DOCUMENTO DE GARANTIA Y COMPROBANTE DE VENTA")
    y -= 4*mm
    fc(*GRIS_MED); can.setFont("Helvetica", 7.5)
    can.drawCentredString(cx, y, f"N° {str(sale_id).zfill(6)}")
    y -= 6*mm

    first_item = imei_items[0] if imei_items else None
    product_full_name = first_item["product_name"] if first_item else ""
    serial_text = ", ".join(first_item.get("serials", [])) if first_item else ""
    color_name, color_hex = _primary_color_meta(first_item or {})
    wp = first_item.get("warranty_policy") if first_item else None
    name_parts = product_full_name.split(maxsplit=1)
    marca = name_parts[0] if name_parts else ""
    modelo = name_parts[1] if len(name_parts) > 1 else ""

    if wp and wp.duration:
        warranty_text = f"{wp.duration} {UNIT_MAP.get(wp.type, 'dias')}"
    elif wp and wp.type == "LIFETIME":
        warranty_text = "de por vida"
    else:
        warranty_text = "15 dias"

    fc(*AZUL_AC); can.setFont("Helvetica-Bold", 9.5)
    can.drawString(margen, y, "1. DATOS DEL CLIENTE")
    sc(*AZUL_AC); can.setLineWidth(0.6); can.line(margen, y - 1*mm, w - margen, y - 1*mm)
    y -= 5*mm
    draw_field(margen, y, "Nombre Completo", customer_name or "", margen + (inner_w/2) - 3*mm)
    draw_field(margen + (inner_w/2) + 3*mm, y, "Cédula/ID", customer_doc or "", w - margen)
    y -= 5*mm
    draw_field(margen, y, "Teléfono", customer_phone or "", margen + (inner_w/2) - 3*mm)
    draw_field(margen + (inner_w/2) + 3*mm, y, "Correo Electrónico", customer_email or "", w - margen)
    y -= 7*mm

    fc(*AZUL_AC); can.setFont("Helvetica-Bold", 9.5)
    can.drawString(margen, y, "2. DATOS DEL EQUIPO")
    sc(*AZUL_AC); can.setLineWidth(0.6); can.line(margen, y - 1*mm, w - margen, y - 1*mm)
    y -= 5*mm
    draw_field(margen, y, "Marca", marca, margen + (inner_w/2) - 3*mm)
    draw_field(margen + (inner_w/2) + 3*mm, y, "Modelo", modelo[:30], w - margen)
    y -= 5*mm
    draw_field(margen, y, "IMEI / Serie", serial_text[:30], margen + (inner_w/2) - 3*mm)
    draw_field(margen + (inner_w/2) + 3*mm, y, "Color", (color_name or "N/A")[:28], w - margen)
    rgb = _hex_to_rgb(color_hex)
    if rgb:
        fc(*rgb); can.circle(w - margen - 4*mm, y + 1.2*mm, 1.6*mm, fill=1, stroke=0)
    y -= 5*mm
    if len(imei_items) > 1:
        fc(*GRIS_OSC); can.setFont("Helvetica-Oblique", 7.5)
        extras = ", ".join([it["product_name"][:25] for it in imei_items[1:]])
        can.drawString(margen, y, ("Equipos adicionales: " + extras)[:140])
        y -= 5*mm
    y -= 2*mm

    fc(*AZUL_AC); can.setFont("Helvetica-Bold", 9.5)
    can.drawString(margen, y, "3. DATOS DE LA VENTA")
    sc(*AZUL_AC); can.setLineWidth(0.6); can.line(margen, y - 1*mm, w - margen, y - 1*mm)
    y -= 5*mm
    draw_field(margen, y, "Fecha de Compra", sale_date or "", margen + (inner_w/2) - 3*mm)
    draw_field(margen + (inner_w/2) + 3*mm, y, "N° Factura", f"#{sale_id}", w - margen)
    y -= 5*mm
    if wp:
        draw_field(margen, y, "Política", wp.name[:30], margen + (inner_w/2) - 3*mm)
        draw_field(margen + (inner_w/2) + 3*mm, y, "Vigencia", warranty_text, w - margen)
        y -= 5*mm
        if first_item.get("warranty_expiration"):
            exp = first_item["warranty_expiration"]
            exp_str = exp.strftime("%d/%m/%Y") if isinstance(exp, datetime) else str(exp)
            draw_field(margen, y, "Vencimiento", exp_str, margen + (inner_w/2) - 3*mm)
            draw_field(margen + (inner_w/2) + 3*mm, y, "Total", sale_total or "", w - margen)
            y -= 5*mm
    y -= 3*mm

    sc(*NEGRO); can.setLineWidth(0.8); can.line(margen, y, w - margen, y); y -= 5*mm
    fc(*NEGRO); can.setFont("Helvetica-Bold", 10)
    can.drawCentredString(cx, y, "TÉRMINOS Y CONDICIONES")
    y -= 5*mm

    def sec_title(num, title):
        nonlocal y
        fc(*AZUL_AC); can.setFont("Helvetica-Bold", 8.5)
        can.drawString(margen, y, f"{num}. {title}")
        y -= 4*mm

    def justify_paragraph(text, size=7.5, gap_mm=3.8, indent=0, max_chars=140):
        nonlocal y
        fc(*GRIS_OSC); can.setFont("Helvetica", size)
        for ln in _wrap_text(text, max_chars):
            can.drawString(margen + indent, y, ln); y -= gap_mm*mm

    def bullet(bold_label, content, max_chars=125):
        nonlocal y
        fc(*NEGRO); can.setFont("Helvetica-Bold", 7.5)
        prefix = f"·  {bold_label}: "
        can.drawString(margen + 2*mm, y, prefix)
        prefix_w = can.stringWidth(prefix, "Helvetica-Bold", 7.5)
        fc(*GRIS_OSC); can.setFont("Helvetica", 7.5)
        lns = _wrap_text(content, max_chars - int(prefix_w * 0.7))
        if lns:
            can.drawString(margen + 2*mm + prefix_w, y, lns[0]); y -= 3.8*mm
            for ln in lns[1:]:
                can.drawString(margen + 4*mm, y, ln); y -= 3.8*mm

    sec_title(4, "COBERTURA Y VIGENCIA")
    justify_paragraph(
        f"La presente garantía cubre defectos de fabricación y funcionamiento del equipo de celular por un periodo de {warranty_text} "
        f"a partir de la fecha de entrega. Es personal, intransferible y requiere la factura original para cualquier reclamo."
    )
    y -= 1.5*mm

    sec_title(5, "EXCLUSIONES (LO QUE NO CUBRE)")
    bullet("Daños Físicos", "Golpes, abolladuras, pantallas fracturadas o daños estéticos derivados de mal uso o caídas.")
    bullet("Daños por Líquidos", "Cualquier daño causado por agua, humedad, vapor o líquidos, independientemente de la certificación de resistencia.")
    bullet("Intervención de Terceros", "Equipos abiertos, reparados, modificados o alterados por personal técnico ajeno a nuestra tienda.")
    bullet("Bloqueos por Seguridad", "Olvido o pérdida de contraseñas, patrones, PINs o cuentas personales (Google, iCloud, Samsung, etc.). El cliente es el único responsable de gestionar sus credenciales.")
    bullet("Accesorios", "Cargadores, cables o audífonos tienen garantía solo por defectos de fábrica iniciales (primeros 7 días).")
    bullet("Caja y Accesorios", "Para hacer válida la garantía, el equipo debe presentarse con su caja original en óptimas condiciones, junto con todos los accesorios incluidos. La ausencia o deterioro significativo de la caja puede invalidar el reclamo.")
    y -= 1.5*mm

    sec_title(6, "PROCEDIMIENTO DE RECLAMO")
    pasos = [
        ("El cliente presenta el equipo junto con la factura original en nuestro centro de atención.", None),
        # Tupla: (texto, palabra_a_destacar_en_bold_y_uppercase)
        ("El equipo será sometido a diagnóstico técnico. Tiempo de respuesta: 3 a 7 días hábiles.", "3 a 7 días hábiles"),
        ("Tras el diagnóstico, la empresa determinará si procede reparación o reemplazo (sujeto a stock).", None),
    ]
    for i, (p, highlight) in enumerate(pasos, 1):
        fc(*NEGRO); can.setFont("Helvetica-Bold", 7.5)
        can.drawString(margen + 2*mm, y, f"{i}.")

        if highlight and highlight in p:
            # Renderizar manualmente: parte normal + palabra en NEGRITA Y MAYUSCULAS + parte final
            before, after = p.split(highlight, 1)
            highlight_caps = highlight.upper()

            # Layout multi-línea cuando todo cabe en una sola: medir y dibujar parte a parte
            # Como el paso es corto (cabe en 2 líneas máximo), hacemos lógica simple:
            x = margen + 6*mm
            line_max = w - margen - 6*mm - x  # ancho disponible

            # Si la línea entera (before+highlight+after) cabe en una sola línea, dibujamos todo seguido
            fc(*GRIS_OSC); can.setFont("Helvetica", 7.5)
            full_text_w = can.stringWidth(before, "Helvetica", 7.5) + \
                          can.stringWidth(highlight_caps, "Helvetica-Bold", 7.5) + \
                          can.stringWidth(after, "Helvetica", 7.5)

            if full_text_w <= line_max:
                # Una sola línea
                can.drawString(x, y, before)
                bx = x + can.stringWidth(before, "Helvetica", 7.5)
                fc(*NEGRO); can.setFont("Helvetica-Bold", 7.5)
                can.drawString(bx, y, highlight_caps)
                bx2 = bx + can.stringWidth(highlight_caps, "Helvetica-Bold", 7.5)
                fc(*GRIS_OSC); can.setFont("Helvetica", 7.5)
                can.drawString(bx2, y, after)
                y -= 3.8*mm
            else:
                # Necesita wrap: dibujamos el `before` primero, luego el highlight, luego el after
                # Simplificación: dibujamos el before en su línea, luego la siguiente línea con highlight + after
                lns_before = _wrap_text(before.rstrip(), 130)
                if lns_before:
                    for ln in lns_before[:-1]:
                        can.drawString(x, y, ln); y -= 3.8*mm
                    last_line = lns_before[-1]
                    can.drawString(x, y, last_line)
                    last_w = can.stringWidth(last_line + " ", "Helvetica", 7.5)
                    # Highlight en bold mayúsculas en la misma línea si cabe
                    high_w = can.stringWidth(highlight_caps, "Helvetica-Bold", 7.5)
                    if last_w + high_w <= line_max:
                        fc(*NEGRO); can.setFont("Helvetica-Bold", 7.5)
                        can.drawString(x + last_w, y, highlight_caps)
                        bx2 = x + last_w + high_w
                        fc(*GRIS_OSC); can.setFont("Helvetica", 7.5)
                        # after en la misma línea si cabe, sino siguiente
                        after_w = can.stringWidth(after, "Helvetica", 7.5)
                        if bx2 + after_w <= w - margen:
                            can.drawString(bx2, y, after)
                        else:
                            y -= 3.8*mm
                            for ln in _wrap_text(after.lstrip(), 130):
                                can.drawString(x, y, ln); y -= 3.8*mm
                                break
                            for ln in _wrap_text(after.lstrip(), 130)[1:]:
                                can.drawString(x, y, ln); y -= 3.8*mm
                    else:
                        y -= 3.8*mm
                        fc(*NEGRO); can.setFont("Helvetica-Bold", 7.5)
                        can.drawString(x, y, highlight_caps)
                        bx2 = x + high_w
                        fc(*GRIS_OSC); can.setFont("Helvetica", 7.5)
                        can.drawString(bx2, y, after)
                    y -= 3.8*mm
        else:
            fc(*GRIS_OSC); can.setFont("Helvetica", 7.5)
            lns = _wrap_text(p, 130)
            if lns:
                can.drawString(margen + 6*mm, y, lns[0]); y -= 3.8*mm
                for ln in lns[1:]:
                    can.drawString(margen + 6*mm, y, ln); y -= 3.8*mm
    y -= 1.5*mm

    sec_title(7, "LIMITACIÓN DE RESPONSABILIDAD")
    bullet("Respaldo de Información", "Es responsabilidad exclusiva del cliente realizar copias de seguridad antes de entregar el equipo. La empresa no responde por pérdida de datos durante el proceso técnico.")
    bullet("Aceptación", "Al momento de la entrega, el cliente declara que el equipo ha sido revisado y recibido en óptimas condiciones de funcionamiento.")
    y -= 3*mm

    sc(*NEGRO); can.setLineWidth(0.6); can.line(margen, y, w - margen, y); y -= 4*mm
    fc(*NEGRO); can.setFont("Helvetica-Bold", 9)
    can.drawCentredString(cx, y, "DECLARACIÓN DE CONFORMIDAD")
    y -= 4*mm
    fc(*GRIS_OSC); can.setFont("Helvetica-Oblique", 7.5)
    decl = "El cliente manifiesta haber leído, comprendido y aceptado la totalidad de los términos aquí descritos, incluyendo la política de no responsabilidad por olvido de contraseñas."
    for ln in _wrap_text(decl, 140):
        can.drawCentredString(cx, y, ln); y -= 3.8*mm

    firma_y = max(y - 8*mm, 25*mm); lw = 80*mm
    sc(*NEGRO); can.setLineWidth(0.8)
    can.line(cx - lw/2, firma_y, cx + lw/2, firma_y)
    fc(*NEGRO); can.setFont("Helvetica-Bold", 8.5)
    can.drawCentredString(cx, firma_y - 4*mm, "FIRMA DEL CLIENTE")
    if customer_name:
        fc(*GRIS_OSC); can.setFont("Helvetica", 8)
        can.drawCentredString(cx, firma_y - 8*mm, customer_name)
    if customer_doc:
        fc(*GRIS_MED); can.setFont("Helvetica", 7.5)
        can.drawCentredString(cx, firma_y - 11.5*mm, f"C.I.: {customer_doc}")

    sc(*GRIS_LINE); can.setLineWidth(0.4); can.line(margen, 9*mm, w - margen, 9*mm)
    fc(*GRIS_MED); can.setFont("Helvetica", 6.5)
    can.drawString(margen, 5*mm, f"{business_name or 'Mi Negocio'}  ·  N° {str(sale_id).zfill(6)}")
    can.drawRightString(w - margen, 5*mm, "Documento de Garantía Oficial")

    can.save(); buffer.seek(0); return buffer.read()


# ══════════════════════════════════════════════════════════════════════════════
# Dispatcher
# ══════════════════════════════════════════════════════════════════════════════

RENDERERS = {
    "moderno":     render_moderno,
    "clasico":     render_clasico,
    "minimalista": render_minimalista,
    "corporativo": render_corporativo,
    "colorido":    render_colorido,
    "premium":     render_premium,
    "legal":       render_legal,
}


def render(style: str, **kwargs) -> bytes:
    """Genera el PDF usando la plantilla solicitada. Si no existe, usa 'moderno'."""
    fn = RENDERERS.get(style) or RENDERERS["moderno"]
    kwargs.setdefault("business_logo", "")
    kwargs.setdefault("business_logo_size", "medium")
    return fn(**kwargs)
