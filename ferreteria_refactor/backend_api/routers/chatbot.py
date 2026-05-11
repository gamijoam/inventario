"""
chatbot.py — ChatBot WhatsApp para Mi Inventario Fácil.
Versión 2.0 — Con categorías, fotos, paginación y búsqueda mejorada.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import json, logging, httpx, time as _time
from datetime import datetime

from ..database.db import get_db
from ..models import models
from ..tenant_context import get_tenant_schema
from ..cache import get_redis

log = logging.getLogger(__name__)
router = APIRouter(prefix="/chatbot", tags=["chatbot"])

# ── Constantes ────────────────────────────────────────────────────────────────
TTL_CONVERSACION  = 1800   # 30 min sin actividad → reset
RATE_LIMIT_MSGS   = 8      # máx mensajes/minuto
RATE_LIMIT_WINDOW = 60
ITEMS_POR_PAGINA  = 4      # productos por página en listados
MAX_BUSQUEDA      = 5      # resultados máximos en búsqueda libre
MEDIA_BASE_URL    = "https://api.miinventariofacil.com"  # URL base para imágenes

# ── Estados ───────────────────────────────────────────────────────────────────
class Estado:
    MENU_PRINCIPAL      = "MENU_PRINCIPAL"
    VIENDO_CATEGORIAS   = "VIENDO_CATEGORIAS"
    VIENDO_PRODUCTOS    = "VIENDO_PRODUCTOS"
    BUSCANDO_PRODUCTO   = "BUSCANDO_PRODUCTO"
    CONFIRMANDO_NOMBRE  = "CONFIRMANDO_NOMBRE"
    CONFIRMANDO_CEDULA  = "CONFIRMANDO_CEDULA"
    CONFIRMANDO_PEDIDO  = "CONFIRMANDO_PEDIDO"
    ESPERANDO_ASESOR    = "ESPERANDO_ASESOR"

# ── Rate limiting y sesiones en memoria ──────────────────────────────────────
_memory_sessions: dict = {}
_rate_limits:     dict = {}

def _key(tenant: str, phone: str) -> str:
    return f"chatbot:{tenant}:{phone}"

def _cleanup_memory():
    now = _time.time()
    for k in list(_memory_sessions):
        if _memory_sessions[k].get("expires_at", 0) < now:
            del _memory_sessions[k]

def get_session(tenant: str, phone: str) -> dict:
    r = get_redis()
    if r:
        try:
            raw = r.get(_key(tenant, phone))
            return json.loads(raw) if raw else {}
        except Exception:
            pass
    entry = _memory_sessions.get(_key(tenant, phone))
    if not entry or entry.get("expires_at", 0) < _time.time():
        _memory_sessions.pop(_key(tenant, phone), None)
        return {}
    return entry.get("data", {})

def save_session(tenant: str, phone: str, data: dict):
    r = get_redis()
    if r:
        try:
            r.setex(_key(tenant, phone), TTL_CONVERSACION, json.dumps(data))
            return
        except Exception:
            pass
    _memory_sessions[_key(tenant, phone)] = {
        "data": data,
        "expires_at": _time.time() + TTL_CONVERSACION
    }
    if len(_memory_sessions) % 100 == 0:
        _cleanup_memory()

def clear_session(tenant: str, phone: str):
    r = get_redis()
    if r:
        try:
            r.delete(_key(tenant, phone))
        except Exception:
            pass
    _memory_sessions.pop(_key(tenant, phone), None)

def check_rate_limit(tenant: str, phone: str) -> bool:
    now = _time.time()
    key = f"rl:{tenant}:{phone}"
    times = [t for t in _rate_limits.get(key, []) if now - t < RATE_LIMIT_WINDOW]
    if len(times) >= RATE_LIMIT_MSGS:
        _rate_limits[key] = times
        return False
    times.append(now)
    _rate_limits[key] = times
    return True

# ── Helpers de imagen ─────────────────────────────────────────────────────────
def get_imagen_url(image_url: str) -> Optional[str]:
    """Construye la URL pública de la imagen si existe."""
    if not image_url:
        return None
    if image_url.startswith("http"):
        return image_url
    return f"{MEDIA_BASE_URL}{image_url}"

# ── Consultas a BD ────────────────────────────────────────────────────────────
def get_categorias(schema: str, db: Session) -> list:
    """Devuelve categorías con al menos 1 producto en stock."""
    try:
        results = db.execute(text(f"""
            SELECT c.id, c.name,
                COUNT(p.id) as total,
                COUNT(p.id) FILTER(WHERE p.stock > 0) as disponibles
            FROM {schema}.categories c
            JOIN {schema}.products p ON p.category_id = c.id
            WHERE p.is_active = true
            GROUP BY c.id, c.name
            HAVING COUNT(p.id) FILTER(WHERE p.stock > 0) > 0
            ORDER BY disponibles DESC
            LIMIT 12
        """)).all()
        return [{"id": r.id, "name": r.name, "total": r.total, "disponibles": r.disponibles} for r in results]
    except Exception as e:
        log.error(f"[chatbot] Error obteniendo categorías: {e}")
        return []

def get_productos_categoria(schema: str, category_id: int, db: Session, offset: int = 0) -> dict:
    """Productos de una categoría con paginación."""
    try:
        total = db.execute(text(f"""
            SELECT COUNT(*) FROM {schema}.products
            WHERE is_active=true AND category_id=:cid AND stock > 0
        """), {"cid": category_id}).scalar() or 0

        results = db.execute(text(f"""
            SELECT id, name, price, stock, image_url, sku
            FROM {schema}.products
            WHERE is_active=true AND category_id=:cid AND stock > 0
            ORDER BY name
            LIMIT :lim OFFSET :off
        """), {"cid": category_id, "lim": ITEMS_POR_PAGINA, "off": offset}).all()

        productos = [{
            "id": r.id, "name": r.name,
            "price": float(r.price or 0),
            "stock": float(r.stock or 0),
            "image_url": get_imagen_url(r.image_url),
            "sku": r.sku
        } for r in results]

        return {
            "productos": productos,
            "total": total,
            "offset": offset,
            "hay_mas": (offset + ITEMS_POR_PAGINA) < total
        }
    except Exception as e:
        log.error(f"[chatbot] Error obteniendo productos: {e}")
        return {"productos": [], "total": 0, "offset": 0, "hay_mas": False}

def buscar_productos(schema: str, query: str, db: Session, offset: int = 0) -> dict:
    """Búsqueda multi-token mejorada con paginación."""
    try:
        tokens = [t.strip() for t in query.lower().split() if len(t.strip()) >= 2]
        if not tokens:
            return {"productos": [], "total": 0, "offset": 0, "hay_mas": False}

        # Condición AND: cada token debe aparecer en name o sku
        condiciones = " AND ".join([
            f"(LOWER(p.name) LIKE '%' || :t{i} || '%' OR LOWER(COALESCE(p.sku,'')) LIKE '%' || :t{i} || '%')"
            for i in range(len(tokens))
        ])
        params = {f"t{i}": t for i, t in enumerate(tokens)}

        total = db.execute(text(f"""
            SELECT COUNT(*) FROM {schema}.products p
            WHERE p.is_active=true AND p.stock > 0 AND {condiciones}
        """), params).scalar() or 0

        params["lim"] = ITEMS_POR_PAGINA
        params["off"] = offset
        results = db.execute(text(f"""
            SELECT p.id, p.name, p.price, p.stock, p.image_url, p.sku,
                   c.name as categoria
            FROM {schema}.products p
            LEFT JOIN {schema}.categories c ON c.id = p.category_id
            WHERE p.is_active=true AND p.stock > 0 AND {condiciones}
            ORDER BY p.stock DESC, p.name
            LIMIT :lim OFFSET :off
        """), params).all()

        productos = [{
            "id": r.id, "name": r.name,
            "price": float(r.price or 0),
            "stock": float(r.stock or 0),
            "image_url": get_imagen_url(r.image_url),
            "sku": r.sku,
            "categoria": r.categoria or ""
        } for r in results]

        return {
            "productos": productos,
            "total": total,
            "offset": offset,
            "hay_mas": (offset + ITEMS_POR_PAGINA) < total
        }
    except Exception as e:
        log.error(f"[chatbot] Error en búsqueda: {e}")
        return {"productos": [], "total": 0, "offset": 0, "hay_mas": False}

def get_business_info(schema: str, db: Session) -> dict:
    try:
        rows = db.execute(text(f"""
            SELECT key, value FROM {schema}.business_config
            WHERE key IN ('business_name','default_bs_rate')
        """)).all()
        return {r.key: r.value for r in rows}
    except:
        return {}

def get_tasa_cambio(schema: str, db: Session) -> float:
    try:
        rate = db.execute(text(f"""
            SELECT rate FROM {schema}.exchange_rates
            WHERE is_active=true AND is_default=true LIMIT 1
        """)).scalar()
        return float(rate or 36)
    except:
        return 36.0

def crear_cotizacion(schema: str, producto: dict, cliente: dict, db: Session) -> Optional[str]:
    """Crea cotización y cliente en el sistema."""
    try:
        cols_cust = {r[0] for r in db.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_schema=:s AND table_name='customers'"
        ), {"s": schema}).all()}

        customer = db.execute(text(f"""
            SELECT id FROM {schema}.customers WHERE phone=:phone LIMIT 1
        """), {"phone": cliente.get("phone", "")}).first()

        if not customer:
            fields = ["name", "phone", "is_active"]
            values = [":name", ":phone", "true"]
            params = {"name": cliente.get("nombre", "Cliente WhatsApp"), "phone": cliente.get("phone", "")}
            if "id_number" in cols_cust:
                fields.append("id_number"); values.append(":cedula"); params["cedula"] = cliente.get("cedula", "")
            elif "cedula" in cols_cust:
                fields.append("cedula"); values.append(":cedula"); params["cedula"] = cliente.get("cedula", "")
            if "created_at" in cols_cust:
                fields.append("created_at"); values.append("NOW()")
            if "updated_at" in cols_cust:
                fields.append("updated_at"); values.append("NOW()")
            db.execute(text(f"INSERT INTO {schema}.customers ({', '.join(fields)}) VALUES ({', '.join(values)})"), params)
            db.flush()
            customer = db.execute(text(f"SELECT id FROM {schema}.customers WHERE phone=:phone LIMIT 1"), {"phone": cliente.get("phone","")}).first()

        customer_id = customer.id if customer else None
        cols_q = {r[0] for r in db.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_schema=:s AND table_name='quotes'"
        ), {"s": schema}).all()}

        q_fields = ["customer_id", "status", "notes", "total_amount"]
        q_values = [":cid", "'PENDING'", ":notes", ":total"]
        q_params = {
            "cid": customer_id,
            "notes": f"Pedido por WhatsApp 🤖 - {cliente.get('nombre','')} ({cliente.get('cedula','')})",
            "total": producto.get("price", 0)
        }
        if "date" in cols_q:
            q_fields.append("date"); q_values.append("CURRENT_DATE")
        if "created_at" in cols_q:
            q_fields.append("created_at"); q_values.append("NOW()")
        if "updated_at" in cols_q:
            q_fields.append("updated_at"); q_values.append("NOW()")

        result = db.execute(text(f"""
            INSERT INTO {schema}.quotes ({', '.join(q_fields)}) VALUES ({', '.join(q_values)}) RETURNING id
        """), q_params)
        db.flush()
        quote_id = result.scalar()

        for table in ["quote_details", "quote_items"]:
            cols_qd = {r[0] for r in db.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_schema=:s AND table_name=:t"
            ), {"s": schema, "t": table}).all()}
            if cols_qd:
                qd_fields = ["quote_id", "product_id", "quantity"]
                qd_values = [":qid", ":pid", "1"]
                qd_params = {"qid": quote_id, "pid": producto.get("id")}
                if "unit_price" in cols_qd:
                    qd_fields.append("unit_price"); qd_values.append(":price"); qd_params["price"] = producto.get("price", 0)
                if "subtotal" in cols_qd:
                    qd_fields.append("subtotal"); qd_values.append(":price"); qd_params["price"] = producto.get("price", 0)
                if "price" in cols_qd:
                    qd_fields.append("price"); qd_values.append(":price"); qd_params["price"] = producto.get("price", 0)
                if "created_at" in cols_qd:
                    qd_fields.append("created_at"); qd_values.append("NOW()")
                db.execute(text(f"INSERT INTO {schema}.{table} ({', '.join(qd_fields)}) VALUES ({', '.join(qd_values)})"), qd_params)
                break

        db.commit()
        return f"COT-{str(quote_id).zfill(4)}"
    except Exception as e:
        db.rollback()
        log.error(f"[chatbot] Error creando cotización: {e}")
        return None

# ── Formateo de mensajes ──────────────────────────────────────────────────────
def texto_menu_principal(nombre_negocio: str) -> str:
    return (
        f"👋 ¡Bienvenido a *{nombre_negocio}*!\n\n"
        "¿Qué deseas hacer?\n\n"
        "1️⃣ Ver categorías\n"
        "2️⃣ Buscar un producto\n"
        "3️⃣ Hacer un pedido\n"
        "0️⃣ Hablar con un asesor\n\n"
        "_Escribe el número de tu opción_"
    )

def texto_categorias(categorias: list) -> str:
    if not categorias:
        return "😕 No hay categorías disponibles.\n\nEscribe *menu* para volver."
    lineas = ["📋 *Nuestras categorías disponibles:*\n"]
    for i, c in enumerate(categorias, 1):
        lineas.append(f"{i}️⃣ {c['name']} ({c['disponibles']} disponibles)")
    lineas.append("\n_Escribe el número para ver los productos_")
    lineas.append("_o *menu* para volver al inicio_")
    return "\n".join(lineas)

def texto_producto_item(p: dict, tasa: float, num: int) -> str:
    bs = p["price"] * tasa
    precio = f"💵 ${p['price']:.2f} USD (Bs {bs:,.0f})"
    return f"{num}️⃣ *{p['name']}*\n{precio}"

def texto_lista_productos(resultado: dict, tasa: float, titulo: str = "Productos") -> str:
    productos = resultado["productos"]
    total     = resultado["total"]
    offset    = resultado["offset"]
    hay_mas   = resultado["hay_mas"]

    if not productos:
        return "😕 No encontré productos disponibles.\n\nEscribe *menu* para volver."

    pagina_actual = (offset // ITEMS_POR_PAGINA) + 1
    total_paginas = ((total - 1) // ITEMS_POR_PAGINA) + 1

    lineas = [f"📦 *{titulo}* — Pág. {pagina_actual}/{total_paginas} ({total} en total)\n"]
    for i, p in enumerate(productos, 1):
        lineas.append(texto_producto_item(p, tasa, i))

    lineas.append("")
    if hay_mas:
        lineas.append("➡️ Escribe *más* para ver los siguientes")
    lineas.append("🛒 Escribe el *número* para apartar un producto")
    lineas.append("🔙 Escribe *menu* para volver al inicio")
    return "\n".join(lineas)

# ── Envío de mensajes (texto e imagen) ───────────────────────────────────────
WHATSAPP_SERVICE_URL = "http://172.18.0.18:3000"

async def enviar_mensaje(tenant_id: str, phone: str, mensaje: str):
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            await c.post(
                f"{WHATSAPP_SERVICE_URL}/instance/{tenant_id}/send",
                json={"phone": phone, "message": mensaje}
            )
    except Exception as e:
        log.error(f"[chatbot] Error enviando texto: {e}")

async def enviar_imagen(tenant_id: str, phone: str, image_url: str, caption: str = ""):
    """Envía imagen por WhatsApp con caption."""
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            await c.post(
                f"{WHATSAPP_SERVICE_URL}/instance/{tenant_id}/send-image",
                json={"phone": phone, "image_url": image_url, "caption": caption}
            )
    except Exception as e:
        log.error(f"[chatbot] Error enviando imagen: {e}")

async def enviar_productos_con_fotos(
    tenant_id: str, phone: str,
    resultado: dict, tasa: float, titulo: str,
    db: Session, schema: str
):
    """Envía la lista de productos y las fotos disponibles."""
    # 1. Enviar el texto con la lista
    await enviar_mensaje(tenant_id, phone, texto_lista_productos(resultado, tasa, titulo))

    # 2. Enviar fotos de los productos que las tienen
    productos_con_foto = [p for p in resultado["productos"] if p.get("image_url")]
    if productos_con_foto:
        await _time.sleep(0.5) if False else None  # no bloquear
        for p in productos_con_foto[:3]:  # máx 3 fotos para no saturar
            bs = p["price"] * tasa
            caption = f"*{p['name']}*\n💵 ${p['price']:.2f} USD (Bs {bs:,.0f})\n✅ En stock"
            await enviar_imagen(tenant_id, phone, p["image_url"], caption)

# ── Endpoint principal del webhook ───────────────────────────────────────────
@router.post("/webhook/{tenant_id}")
async def webhook_mensaje(
    tenant_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        body = await request.json()
    except:
        return {"ok": False, "error": "JSON inválido"}

    phone   = body.get("phone", "").strip()
    mensaje = body.get("message", "").strip().lower()
    nombre  = body.get("name", "")

    if not phone or not mensaje:
        return {"ok": False, "error": "phone y message requeridos"}

    # Rate limiting
    if not check_rate_limit(tenant_id, phone):
        await enviar_mensaje(tenant_id, phone,
            "⚠️ Estás enviando muchos mensajes. Por favor espera un momento.")
        return {"ok": False, "error": "rate_limit"}

    # Verificar tenant
    from ..models.tenant import Tenant
    tenant = db.query(Tenant).filter(Tenant.schema_name == tenant_id).first()
    if not tenant:
        return {"ok": False, "error": "Tenant no encontrado"}

    from ..tenant_context import set_tenant_schema
    set_tenant_schema(tenant_id)

    sesion  = get_session(tenant_id, phone)
    estado  = sesion.get("estado", Estado.MENU_PRINCIPAL)
    info    = get_business_info(tenant_id, db)
    nombre_negocio = info.get("business_name", "Mi Inventario")
    tasa    = get_tasa_cambio(tenant_id, db)
    respuesta = None

    # ── Silencio en modo asesor ──────────────────────────────────────────────
    if estado == Estado.ESPERANDO_ASESOR:
        if mensaje in ["menu", "menú", "bot", "chatbot", "inicio", "start"]:
            clear_session(tenant_id, phone)
            respuesta = "🤖 *ChatBot activado nuevamente*\n\n" + texto_menu_principal(nombre_negocio)
            save_session(tenant_id, phone, {"estado": Estado.MENU_PRINCIPAL})
        else:
            log.info(f"[chatbot] {phone} en modo ASESOR — bot silenciado")
            return {"ok": True, "estado": estado, "modo": "asesor_humano", "respuesta_enviada": False}
        await enviar_mensaje(tenant_id, phone, respuesta)
        return {"ok": True, "estado": estado, "respuesta_enviada": True}

    # ── Medios (fotos, audios, stickers) ────────────────────────────────────
    if mensaje.startswith("__media__:"):
        tipo = mensaje.replace("__media__:", "")
        respuestas_media = {
            "imagen":    "📸 Recibí tu imagen, pero solo proceso texto.\nEscribe *menu* para ver las opciones.",
            "audio":     "🎤 Recibí tu nota de voz, pero solo proceso texto.\nEscribe *menu* para ver las opciones.",
            "video":     "🎥 Recibí tu video.\nEscribe *menu* para ver las opciones.",
            "sticker":   "😄 ¡Gracias por el sticker!\nEscribe *menu* para ver las opciones.",
            "documento": "📄 Recibí tu documento.\nEscribe *menu* para ver las opciones.",
            "ubicacion": "📍 Recibí tu ubicación.\nEscribe *menu* para ver las opciones.",
            "contacto":  "👤 Recibí un contacto.\nEscribe *menu* para ver las opciones.",
        }
        respuesta = respuestas_media.get(tipo, f"Recibí un archivo.\nEscribe *menu* para ver las opciones.")
        await enviar_mensaje(tenant_id, phone, respuesta)
        return {"ok": True, "estado": estado, "respuesta_enviada": True}

    # ── Comandos globales ────────────────────────────────────────────────────
    if mensaje in ["hola", "hi", "hello", "buenas", "buenos dias", "buenos días",
                   "buenas tardes", "buenas noches", "menu", "menú", "inicio", "start"]:
        clear_session(tenant_id, phone)
        respuesta = texto_menu_principal(nombre_negocio)
        save_session(tenant_id, phone, {"estado": Estado.MENU_PRINCIPAL})

    elif mensaje == "0":
        respuesta = (
            "👨‍💼 *Asesor en camino...*\n\n"
            "Un miembro de nuestro equipo te atenderá pronto.\n"
            "⏰ Tiempo de respuesta: máx. 2 horas\n\n"
            "_Escribe *bot* o *menu* si quieres volver al chatbot_"
        )
        save_session(tenant_id, phone, {"estado": Estado.ESPERANDO_ASESOR, "nombre_cliente": nombre})
        log.info(f"[chatbot] 👨‍💼 ASESOR SOLICITADO: tenant={tenant_id} phone={phone}")

    # ── MENÚ PRINCIPAL ───────────────────────────────────────────────────────
    elif estado == Estado.MENU_PRINCIPAL:

        if mensaje == "1":
            # Ver categorías
            categorias = get_categorias(tenant_id, db)
            if not categorias:
                respuesta = "😕 No hay productos disponibles en este momento.\n\nEscribe *menu* para volver."
            else:
                respuesta = texto_categorias(categorias)
                save_session(tenant_id, phone, {
                    "estado": Estado.VIENDO_CATEGORIAS,
                    "categorias": categorias
                })

        elif mensaje == "2":
            respuesta = (
                "🔍 *Buscar producto*\n\n"
                "Escribe el nombre o parte del nombre:\n"
                "_Ej: Samsung A15, audifonos, forro redmi_"
            )
            save_session(tenant_id, phone, {"estado": Estado.BUSCANDO_PRODUCTO, "modo": "busqueda"})

        elif mensaje == "3":
            respuesta = (
                "🛒 *Hacer un pedido*\n\n"
                "¿Qué producto deseas pedir?\n"
                "_Escribe el nombre o parte del nombre:_"
            )
            save_session(tenant_id, phone, {"estado": Estado.BUSCANDO_PRODUCTO, "modo": "pedido"})

        else:
            respuesta = texto_menu_principal(nombre_negocio)

    # ── VIENDO CATEGORÍAS ────────────────────────────────────────────────────
    elif estado == Estado.VIENDO_CATEGORIAS:
        categorias = sesion.get("categorias", [])
        modo       = sesion.get("modo", "busqueda")

        if mensaje.isdigit() and 1 <= int(mensaje) <= len(categorias):
            cat = categorias[int(mensaje) - 1]
            resultado = get_productos_categoria(tenant_id, cat["id"], db, offset=0)

            save_session(tenant_id, phone, {
                "estado": Estado.VIENDO_PRODUCTOS,
                "categorias": categorias,
                "categoria_actual": cat,
                "resultado": resultado,
                "modo": modo
            })

            # Enviar lista + fotos
            await enviar_productos_con_fotos(
                tenant_id, phone, resultado, tasa,
                cat["name"], db, tenant_id
            )
            return {"ok": True, "estado": estado, "respuesta_enviada": True}

        else:
            respuesta = texto_categorias(categorias)

    # ── VIENDO PRODUCTOS (lista con paginación) ───────────────────────────────
    elif estado == Estado.VIENDO_PRODUCTOS:
        resultado      = sesion.get("resultado", {})
        categorias     = sesion.get("categorias", [])
        categoria_actual = sesion.get("categoria_actual", {})
        modo           = sesion.get("modo", "busqueda")
        es_busqueda    = sesion.get("es_busqueda", False)
        query_busqueda = sesion.get("query_busqueda", "")
        productos      = resultado.get("productos", [])

        # "más" → siguiente página
        if mensaje in ["más", "mas", "siguiente", "ver mas", "ver más", "next", "+"]:
            offset_nuevo = resultado.get("offset", 0) + ITEMS_POR_PAGINA
            if es_busqueda:
                nuevo_resultado = buscar_productos(tenant_id, query_busqueda, db, offset=offset_nuevo)
                titulo = f'Resultados: "{query_busqueda}"'
            else:
                nuevo_resultado = get_productos_categoria(tenant_id, categoria_actual["id"], db, offset=offset_nuevo)
                titulo = categoria_actual.get("name", "Productos")

            save_session(tenant_id, phone, {
                **sesion,
                "resultado": nuevo_resultado,
            })
            await enviar_productos_con_fotos(tenant_id, phone, nuevo_resultado, tasa, titulo, db, tenant_id)
            return {"ok": True, "estado": estado, "respuesta_enviada": True}

        # Número → seleccionar producto
        elif mensaje.isdigit() and 1 <= int(mensaje) <= len(productos):
            prod = productos[int(mensaje) - 1]
            bs   = prod["price"] * tasa
            texto_det = (
                f"📦 *{prod['name']}*\n\n"
                f"💵 Precio: *${prod['price']:.2f} USD* (Bs {bs:,.0f})\n"
                f"✅ Stock disponible\n"
            )
            if prod.get("categoria"):
                texto_det += f"📂 Categoría: {prod['categoria']}\n"

            if modo == "pedido":
                texto_det += "\n¿Quieres apartar este producto?\n\n1️⃣ Sí, hacer el pedido\n2️⃣ Ver otro producto\n0️⃣ Hablar con asesor"
                save_session(tenant_id, phone, {
                    **sesion,
                    "producto_seleccionado": prod,
                    "esperando_confirmar_interes": True
                })
            else:
                texto_det += "\n1️⃣ Apartar este producto\n2️⃣ Ver otro\n*menu* para volver"
                save_session(tenant_id, phone, {
                    **sesion,
                    "producto_seleccionado": prod,
                    "esperando_confirmar_interes": True
                })

            # Enviar foto si tiene
            if prod.get("image_url"):
                await enviar_imagen(tenant_id, phone, prod["image_url"],
                    f"{prod['name']} — ${prod['price']:.2f} USD")

            await enviar_mensaje(tenant_id, phone, texto_det)
            return {"ok": True, "estado": estado, "respuesta_enviada": True}

        # "1" cuando está esperando confirmar interés → iniciar pedido
        elif mensaje == "1" and sesion.get("esperando_confirmar_interes"):
            prod = sesion.get("producto_seleccionado", {})
            respuesta = "✅ Perfecto!\n\nPara procesar tu pedido necesito algunos datos:\n\n👤 ¿Cuál es tu *nombre completo*?"
            save_session(tenant_id, phone, {
                "estado": Estado.CONFIRMANDO_NOMBRE,
                "producto": prod
            })

        elif mensaje == "2" and sesion.get("esperando_confirmar_interes"):
            # Mostrar la lista de nuevo
            titulo = categoria_actual.get("name", "Productos") if not es_busqueda else f'"{query_busqueda}"'
            await enviar_productos_con_fotos(tenant_id, phone, resultado, tasa, titulo, db, tenant_id)
            save_session(tenant_id, phone, {**sesion, "esperando_confirmar_interes": False})
            return {"ok": True, "estado": estado, "respuesta_enviada": True}

        # Volver a categorías
        elif mensaje in ["categorias", "categorías", "volver", "atras", "atrás"] and categorias:
            respuesta = texto_categorias(categorias)
            save_session(tenant_id, phone, {
                "estado": Estado.VIENDO_CATEGORIAS,
                "categorias": categorias,
                "modo": modo
            })

        else:
            titulo = categoria_actual.get("name", "Productos") if not es_busqueda else f'"{query_busqueda}"'
            await enviar_productos_con_fotos(tenant_id, phone, resultado, tasa, titulo, db, tenant_id)
            return {"ok": True, "estado": estado, "respuesta_enviada": True}

    # ── BÚSQUEDA LIBRE ───────────────────────────────────────────────────────
    elif estado == Estado.BUSCANDO_PRODUCTO:
        modo = sesion.get("modo", "busqueda")

        if len(mensaje.strip()) < 2:
            respuesta = "Por favor escribe al menos 2 letras para buscar. 🔍"
        else:
            resultado = buscar_productos(tenant_id, mensaje, db, offset=0)

            if not resultado["productos"]:
                respuesta = (
                    f"😕 No encontré productos con *\"{mensaje}\"*\n\n"
                    "Intenta con otra palabra o escribe *1* para ver categorías\n"
                    "o *menu* para volver al inicio"
                )
            else:
                save_session(tenant_id, phone, {
                    "estado": Estado.VIENDO_PRODUCTOS,
                    "resultado": resultado,
                    "es_busqueda": True,
                    "query_busqueda": mensaje,
                    "categorias": get_categorias(tenant_id, db),
                    "categoria_actual": {},
                    "modo": modo
                })
                titulo = f'Resultados: "{mensaje}"'
                await enviar_productos_con_fotos(tenant_id, phone, resultado, tasa, titulo, db, tenant_id)
                return {"ok": True, "estado": estado, "respuesta_enviada": True}

    # ── CONFIRMANDO NOMBRE ───────────────────────────────────────────────────
    elif estado == Estado.CONFIRMANDO_NOMBRE:
        if len(mensaje.strip()) < 3:
            respuesta = "Por favor escribe tu nombre completo (mínimo 3 letras):"
        else:
            nombre_cliente = mensaje.strip().title()
            respuesta = f"📝 Gracias *{nombre_cliente}*\n\n¿Cuál es tu número de *cédula o RIF*?"
            save_session(tenant_id, phone, {
                "estado": Estado.CONFIRMANDO_CEDULA,
                "producto": sesion.get("producto"),
                "nombre_cliente": nombre_cliente
            })

    # ── CONFIRMANDO CÉDULA ───────────────────────────────────────────────────
    elif estado == Estado.CONFIRMANDO_CEDULA:
        cedula = mensaje.strip().upper()
        prod   = sesion.get("producto", {})
        nombre_cliente = sesion.get("nombre_cliente", "")
        bs = prod.get("price", 0) * tasa

        respuesta = (
            f"📦 *Resumen de tu pedido:*\n\n"
            f"🛒 Producto: *{prod.get('name','')}*\n"
            f"💵 Precio:   *${prod.get('price',0):.2f} USD* (Bs {bs:,.0f})\n"
            f"👤 Cliente:  *{nombre_cliente}*\n"
            f"🪪 C.I./RIF: *{cedula}*\n\n"
            f"¿Confirmas el pedido?\n\n"
            f"1️⃣ ✅ Sí, confirmar\n"
            f"2️⃣ ❌ Cancelar"
        )
        save_session(tenant_id, phone, {
            "estado": Estado.CONFIRMANDO_PEDIDO,
            "producto": prod,
            "nombre_cliente": nombre_cliente,
            "cedula": cedula,
            "phone": phone
        })

    # ── CONFIRMANDO PEDIDO ───────────────────────────────────────────────────
    elif estado == Estado.CONFIRMANDO_PEDIDO:
        if mensaje == "1":
            prod   = sesion.get("producto", {})
            cliente = {
                "nombre": sesion.get("nombre_cliente", ""),
                "cedula": sesion.get("cedula", ""),
                "phone": phone
            }
            num_cotizacion = crear_cotizacion(tenant_id, prod, cliente, db)

            if num_cotizacion:
                respuesta = (
                    f"🎉 *¡Pedido registrado exitosamente!*\n\n"
                    f"Tu número de pedido es: *{num_cotizacion}*\n\n"
                    f"Un asesor te contactará para coordinar\n"
                    f"el pago y la entrega. ⏰ Máx. 2 horas\n\n"
                    f"¡Gracias por preferir *{nombre_negocio}*! 🙏\n\n"
                    f"_Escribe *menu* si necesitas algo más_"
                )
                clear_session(tenant_id, phone)
            else:
                respuesta = "⚠️ Hubo un problema al registrar el pedido.\n\nEscribe *0* para hablar con un asesor."

        elif mensaje == "2":
            clear_session(tenant_id, phone)
            respuesta = "❌ Pedido cancelado.\n\n" + texto_menu_principal(nombre_negocio)
        else:
            respuesta = "Por favor escribe *1* para confirmar o *2* para cancelar."

    # ── Fallback ─────────────────────────────────────────────────────────────
    if respuesta is None:
        clear_session(tenant_id, phone)
        respuesta = texto_menu_principal(nombre_negocio)

    await enviar_mensaje(tenant_id, phone, respuesta)
    return {"ok": True, "estado": estado, "respuesta_enviada": True}


# ── Endpoints de gestión ──────────────────────────────────────────────────────
@router.get("/waiting/{tenant_id}")
async def get_waiting_customers(tenant_id: str):
    """Clientes esperando asesor humano."""
    waiting = []
    prefix = f"chatbot:{tenant_id}:"
    now = _time.time()
    for k, v in list(_memory_sessions.items()):
        if k.startswith(prefix) and v.get("expires_at", 0) > now:
            data = v.get("data", {})
            if data.get("estado") == Estado.ESPERANDO_ASESOR:
                waiting.append({
                    "phone": k.replace(prefix, ""),
                    "nombre": data.get("nombre_cliente", "Sin nombre"),
                    "estado": "ESPERANDO_ASESOR"
                })
    return {"tenant": tenant_id, "waiting": waiting, "count": len(waiting)}

@router.post("/release/{tenant_id}/{phone}")
async def release_to_bot(tenant_id: str, phone: str):
    """El asesor termina la atención y devuelve al cliente al chatbot."""
    clear_session(tenant_id, phone)
    await enviar_mensaje(tenant_id, phone,
        "✅ El asesor terminó la atención.\n\nEscribe *menu* cuando necesites algo más. ¡Hasta pronto! 👋")
    return {"ok": True, "message": f"Cliente {phone} liberado al chatbot"}

@router.get("/session/{tenant_id}/{phone}")
async def get_session_debug(tenant_id: str, phone: str):
    sesion = get_session(tenant_id, phone)
    return {"tenant": tenant_id, "phone": phone, "sesion": sesion}

@router.delete("/session/{tenant_id}/{phone}")
async def clear_session_endpoint(tenant_id: str, phone: str):
    clear_session(tenant_id, phone)
    return {"ok": True, "message": "Sesión limpiada"}
