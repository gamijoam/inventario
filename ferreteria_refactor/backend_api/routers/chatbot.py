"""
chatbot.py — Motor del ChatBot WhatsApp sin IA para Mi Inventario Fácil.
Maneja la máquina de estados por conversación usando Redis.
Cada tenant tiene su propio catálogo, precios y flujo de menús.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import json, logging, httpx, asyncio
from datetime import datetime

from ..database.db import get_db
from ..models import models
from ..tenant_context import get_tenant_schema, set_tenant_schema
from ..cache import get_redis

log = logging.getLogger(__name__)
router = APIRouter(prefix="/chatbot", tags=["chatbot"])

# ── Constantes ───────────────────────────────────────────────────────────────
TTL_CONVERSACION  = 1800  # 30 minutos de inactividad → reset
MAX_RESULTADOS    = 5     # Máximo productos en búsqueda
RATE_LIMIT_MSGS   = 8     # Máximo mensajes por minuto por cliente
RATE_LIMIT_WINDOW = 60    # Ventana de rate limit en segundos

WHATSAPP_SERVICE_URL = "http://172.18.0.18:3000"  # IP del whatsapp_service en web_publica

# ── Estados de la conversación ────────────────────────────────────────────────
class Estado:
    MENU_PRINCIPAL      = "MENU_PRINCIPAL"
    BUSCANDO_PRODUCTO   = "BUSCANDO_PRODUCTO"
    VIENDO_RESULTADOS   = "VIENDO_RESULTADOS"
    CONFIRMANDO_NOMBRE  = "CONFIRMANDO_NOMBRE"
    CONFIRMANDO_CEDULA  = "CONFIRMANDO_CEDULA"
    CONFIRMANDO_PEDIDO  = "CONFIRMANDO_PEDIDO"
    ESPERANDO_ASESOR    = "ESPERANDO_ASESOR"

# ── Helpers Redis con fallback en memoria ─────────────────────────────────────
import time as _time

# Memory fallback con TTL manual: {key: {data, expires_at}}
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
    # Fallback memoria con TTL
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

# ── Envío de mensajes ─────────────────────────────────────────────────────────
async def enviar_mensaje(tenant_id: str, phone: str, mensaje: str):
    """Envía un mensaje via el whatsapp_service."""
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            await c.post(
                f"{WHATSAPP_SERVICE_URL}/instance/{tenant_id}/send",
                json={"phone": phone, "message": mensaje}
            )
    except Exception as e:
        log.error(f"[chatbot] Error enviando a {phone}: {e}")

# ── Consultas al catálogo ─────────────────────────────────────────────────────
def buscar_productos(schema: str, query: str, db: Session) -> list:
    try:
        results = db.execute(text(f"""
            SELECT id, name, price, stock, sku
            FROM {schema}.products
            WHERE is_active = true
              AND stock > 0
              AND (LOWER(name) LIKE LOWER(:q) OR LOWER(sku) LIKE LOWER(:q))
            ORDER BY stock DESC
            LIMIT {MAX_RESULTADOS}
        """), {"q": f"%{query}%"}).all()
        return [{"id": r.id, "name": r.name, "price": float(r.price or 0), "stock": float(r.stock or 0), "sku": r.sku} for r in results]
    except Exception as e:
        log.error(f"[chatbot] Error buscando productos: {e}")
        return []

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
            WHERE is_active = true AND is_default = true
            LIMIT 1
        """)).scalar()
        return float(rate or 36)
    except:
        return 36.0

def crear_cotizacion(schema: str, producto: dict, cliente: dict, db: Session) -> Optional[str]:
    """Crea una cotización en el sistema y devuelve el número."""
    try:
        # Ver columnas de customers para saber qué campos tiene
        cols_cust = {r[0] for r in db.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_schema=:s AND table_name='customers'"
        ), {"s": schema}).all()}

        # Buscar o crear cliente
        customer = db.execute(text(f"""
            SELECT id FROM {schema}.customers
            WHERE phone = :phone LIMIT 1
        """), {"phone": cliente.get("phone", "")}).first()

        if not customer:
            # Construir INSERT dinámico según columnas disponibles
            fields = ["name", "phone", "is_active"]
            values = [":name", ":phone", "true"]
            params = {"name": cliente.get("nombre", "Cliente WhatsApp"), "phone": cliente.get("phone", "")}

            # cedula puede llamarse id_number o cedula
            if "id_number" in cols_cust:
                fields.append("id_number"); values.append(":cedula"); params["cedula"] = cliente.get("cedula", "")
            elif "cedula" in cols_cust:
                fields.append("cedula"); values.append(":cedula"); params["cedula"] = cliente.get("cedula", "")
            if "created_at" in cols_cust:
                fields.append("created_at"); values.append("NOW()")
            if "updated_at" in cols_cust:
                fields.append("updated_at"); values.append("NOW()")

            db.execute(text(f"""
                INSERT INTO {schema}.customers ({', '.join(fields)}) VALUES ({', '.join(values)})
            """), params)
            db.flush()
            customer = db.execute(text(f"""
                SELECT id FROM {schema}.customers WHERE phone = :phone LIMIT 1
            """), {"phone": cliente.get("phone", "")}).first()

        customer_id = customer.id if customer else None

        # Ver columnas de quotes
        cols_q = {r[0] for r in db.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_schema=:s AND table_name='quotes'"
        ), {"s": schema}).all()}

        # Crear cotización con columnas disponibles
        q_fields = ["customer_id", "status", "notes", "total_amount"]
        q_values = [":cid", "'PENDING'", ":notes", ":total"]
        q_params  = {
            "cid": customer_id,
            "notes": f"Pedido por WhatsApp 🤖 - {cliente.get('nombre', '')} ({cliente.get('cedula','')})",
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

        # Ver columnas de quote_details (puede llamarse quote_items o quote_details)
        for table in ["quote_details", "quote_items"]:
            cols_qd = {r[0] for r in db.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_schema=:s AND table_name=:t"
            ), {"s": schema, "t": table}).all()}
            if cols_qd:
                qd_fields = ["quote_id", "product_id", "quantity"]
                qd_values = [":qid", ":pid", "1"]
                qd_params  = {"qid": quote_id, "pid": producto.get("id")}
                if "unit_price" in cols_qd:
                    qd_fields.append("unit_price"); qd_values.append(":price"); qd_params["price"] = producto.get("price", 0)
                if "subtotal" in cols_qd:
                    qd_fields.append("subtotal"); qd_values.append(":price"); qd_params["price"] = producto.get("price", 0)
                if "price" in cols_qd:
                    qd_fields.append("price"); qd_values.append(":price"); qd_params["price"] = producto.get("price", 0)
                if "created_at" in cols_qd:
                    qd_fields.append("created_at"); qd_values.append("NOW()")

                db.execute(text(f"""
                    INSERT INTO {schema}.{table} ({', '.join(qd_fields)}) VALUES ({', '.join(qd_values)})
                """), qd_params)
                break

        db.commit()
        return f"COT-{str(quote_id).zfill(4)}"
    except Exception as e:
        db.rollback()
        log.error(f"[chatbot] Error creando cotización: {e}")
        return None

# ── Textos del menú ────────────────────────────────────────────────────────────
def texto_menu_principal(nombre_negocio: str) -> str:
    return (
        f"👋 ¡Bienvenido a *{nombre_negocio}*!\n\n"
        "¿En qué te podemos ayudar?\n\n"
        "1️⃣ Buscar un producto\n"
        "2️⃣ Ver catálogo de precios\n"
        "3️⃣ Hacer un pedido\n"
        "0️⃣ Hablar con un asesor\n\n"
        "_Escribe el número de tu opción_"
    )

def texto_producto(p: dict, tasa: float) -> str:
    bs = p["price"] * tasa
    disponible = "✅ Disponible" if p["stock"] > 0 else "❌ Agotado"
    return f"*{p['name']}*\n💵 ${p['price']:.2f} USD (Bs {bs:,.0f})\n{disponible}"

# ── ENDPOINT PRINCIPAL: recibe mensajes del whatsapp_service ──────────────────
@router.post("/webhook/{tenant_id}")
async def webhook_mensaje(
    tenant_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Recibe mensajes entrantes del whatsapp_service y procesa el chatbot.
    El whatsapp_service hace POST aquí con: { phone, message, name }
    """
    try:
        body = await request.json()
    except:
        return {"ok": False, "error": "JSON inválido"}

    phone   = body.get("phone", "").strip()
    mensaje = body.get("message", "").strip().lower()
    nombre  = body.get("name", "")

    if not phone or not mensaje:
        return {"ok": False, "error": "phone y message requeridos"}

    # ── Rate limiting: máx 8 mensajes por minuto ──────────────────────────────
    if not check_rate_limit(tenant_id, phone):
        log.warning(f"[chatbot] Rate limit excedido: {tenant_id}/{phone}")
        await enviar_mensaje(tenant_id, phone,
            "⚠️ Estás enviando muchos mensajes muy rápido.\nPor favor espera un momento antes de continuar.")
        return {"ok": False, "error": "rate_limit"}

    # Identificar el schema del tenant
    from ..models.tenant import Tenant
    tenant = db.query(Tenant).filter(Tenant.schema_name == tenant_id).first()
    if not tenant:
        return {"ok": False, "error": "Tenant no encontrado"}

    set_tenant_schema(tenant_id)

    # Cargar sesión actual del cliente
    sesion = get_session(tenant_id, phone)
    estado = sesion.get("estado", Estado.MENU_PRINCIPAL)

    # Info del negocio
    info = get_business_info(tenant_id, db)
    nombre_negocio = info.get("business_name", "Mi Inventario")
    tasa = get_tasa_cambio(tenant_id, db)

    respuesta = None

    # ── Si está hablando con un asesor humano, el bot NO responde ────────────
    # Solo acepta "menu" o "bot" para volver al chatbot
    if estado == Estado.ESPERANDO_ASESOR:
        if mensaje in ["menu", "menú", "bot", "chatbot", "inicio", "start"]:
            clear_session(tenant_id, phone)
            respuesta = (
                "🤖 *ChatBot activado nuevamente*\n\n" +
                texto_menu_principal(nombre_negocio)
            )
            save_session(tenant_id, phone, {"estado": Estado.MENU_PRINCIPAL})
        else:
            # Silencio total — el asesor humano maneja la conversación
            log.info(f"[chatbot] {phone} en modo ASESOR — bot silenciado")
            return {"ok": True, "estado": estado, "modo": "asesor_humano", "respuesta_enviada": False}
        await enviar_mensaje(tenant_id, phone, respuesta)
        return {"ok": True, "estado": estado, "respuesta_enviada": True}

    # ── Manejar mensajes de media (foto, audio, sticker, video, etc.) ─────────
    if mensaje.startswith("__media__:"):
        tipo = mensaje.replace("__media__:", "")
        respuestas_media = {
            "imagen":    "📸 Recibí tu imagen, pero por ahora solo proceso texto.\nEscribe *menu* para ver las opciones.",
            "audio":     "🎤 Recibí tu nota de voz, pero por ahora solo proceso texto.\nEscribe *menu* para ver las opciones.",
            "video":     "🎥 Recibí tu video, pero por ahora solo proceso texto.\nEscribe *menu* para ver las opciones.",
            "sticker":   "😄 ¡Gracias por el sticker!\nEscribe *menu* para ver las opciones.",
            "documento": "📄 Recibí tu documento, pero no puedo procesarlo.\nEscribe *menu* para ver las opciones.",
            "ubicacion": "📍 Recibí tu ubicación.\nEscribe *menu* para ver las opciones.",
            "contacto":  "👤 Recibí un contacto.\nEscribe *menu* para ver las opciones.",
        }
        respuesta = respuestas_media.get(tipo, f"Recibí un archivo ({tipo}).\nEscribe *menu* para ver las opciones.")
        await enviar_mensaje(tenant_id, phone, respuesta)
        return {"ok": True, "estado": estado, "respuesta_enviada": True}

    # ── Comandos globales (desde cualquier estado) ────────────────────────────
    if mensaje in ["hola", "hi", "hello", "buenas", "buenos dias", "buenos días",
                   "buenas tardes", "buenas noches", "menu", "menú", "inicio", "start"]:
        clear_session(tenant_id, phone)
        respuesta = texto_menu_principal(nombre_negocio)
        save_session(tenant_id, phone, {"estado": Estado.MENU_PRINCIPAL})

    elif mensaje == "0":
        respuesta = (
            "\U0001f468\u200d\U0001f4bc *Asesor en camino...*\n\n"
            "Un miembro de nuestro equipo te atender\u00e1 en breve.\n"
            "\u23f0 Tiempo de respuesta: m\u00e1x. 2 horas\n\n"
            "_Escribe *bot* o *menu* si quieres volver al chatbot_"
        )
        save_session(tenant_id, phone, {
            "estado": Estado.ESPERANDO_ASESOR,
            "nombre_cliente": nombre
        })
        log.info(f"[chatbot] \U0001f468\u200d\U0001f4bc ASESOR SOLICITADO: tenant={tenant_id} phone={phone}")

    # ── Máquina de estados ────────────────────────────────────────────────────
    elif estado == Estado.MENU_PRINCIPAL:
        if mensaje == "1":
            respuesta = "🔍 ¿Qué producto buscas?\n\nEscribe el nombre o parte del nombre:"
            save_session(tenant_id, phone, {"estado": Estado.BUSCANDO_PRODUCTO})

        elif mensaje == "2":
            # Mostrar top 10 productos con stock
            productos = db.execute(text(f"""
                SELECT name, price, stock FROM {tenant_id}.products
                WHERE is_active = true AND stock > 0
                ORDER BY name ASC LIMIT 10
            """)).all()
            if productos:
                lista = "\n".join([
                    f"• {p.name} — *${float(p.price):.2f}*"
                    for p in productos
                ])
                respuesta = (
                    f"📋 *Catálogo de productos disponibles:*\n\n"
                    f"{lista}\n\n"
                    f"_Escribe *1* para buscar un producto específico_\n"
                    f"_o *menu* para volver al inicio_"
                )
            else:
                respuesta = "No hay productos disponibles en este momento.\n\nEscribe *menu* para volver."

        elif mensaje == "3":
            respuesta = "🔍 ¿Qué producto deseas pedir?\n\nEscribe el nombre o parte del nombre:"
            save_session(tenant_id, phone, {"estado": Estado.BUSCANDO_PRODUCTO, "modo": "pedido"})

        else:
            respuesta = texto_menu_principal(nombre_negocio)

    elif estado == Estado.BUSCANDO_PRODUCTO:
        if len(mensaje) < 2:
            respuesta = "Por favor escribe al menos 2 letras para buscar. 🔍"
        else:
            productos = buscar_productos(tenant_id, mensaje, db)
            if not productos:
                respuesta = (
                    f"😕 No encontré productos con *\"{mensaje}\"*\n\n"
                    "Intenta con otro nombre o escribe *menu* para volver."
                )
            else:
                lista = "\n".join([
                    f"{i+1}️⃣ {p['name']} — *${p['price']:.2f}*"
                    for i, p in enumerate(productos)
                ])
                respuesta = (
                    f"🛒 Encontré estos productos:\n\n{lista}\n\n"
                    f"Escribe el *número* para ver detalles\n"
                    f"o *menu* para volver al inicio"
                )
                save_session(tenant_id, phone, {
                    "estado": Estado.VIENDO_RESULTADOS,
                    "productos": productos,
                    "modo": sesion.get("modo", "busqueda")
                })

    elif estado == Estado.VIENDO_RESULTADOS:
        productos = sesion.get("productos", [])
        modo = sesion.get("modo", "busqueda")

        # Si ya seleccionó un producto (modo=confirmando_pedido), procesar acciones
        if mensaje == "1" and modo == "confirmando_pedido":
            prod = sesion.get("producto_seleccionado", {})
            respuesta = (
                f"✅ Perfecto!\n\n"
                f"Para procesar tu pedido necesito algunos datos:\n\n"
                f"👤 ¿Cuál es tu *nombre completo*?"
            )
            save_session(tenant_id, phone, {
                "estado": Estado.CONFIRMANDO_NOMBRE,
                "producto": prod
            })

        elif mensaje == "2" and modo == "confirmando_pedido":
            respuesta = "🔍 ¿Qué producto buscas?\n\nEscribe el nombre:"
            save_session(tenant_id, phone, {"estado": Estado.BUSCANDO_PRODUCTO})

        elif mensaje.isdigit() and 1 <= int(mensaje) <= len(productos):
            idx = int(mensaje) - 1
            prod = productos[idx]
            detalle = texto_producto(prod, tasa)

            if modo == "pedido":
                respuesta = (
                    f"{detalle}\n\n"
                    f"¿Quieres apartar este producto?\n\n"
                    f"1️⃣ Sí, quiero hacer el pedido\n"
                    f"2️⃣ Buscar otro producto\n"
                    f"0️⃣ Hablar con un asesor"
                )
                save_session(tenant_id, phone, {
                    "estado": Estado.VIENDO_RESULTADOS,
                    "productos": productos,
                    "producto_seleccionado": prod,
                    "modo": "confirmando_pedido"
                })
            else:
                respuesta = (
                    f"{detalle}\n\n"
                    f"1️⃣ Apartar este producto\n"
                    f"2️⃣ Buscar otro\n"
                    f"0️⃣ Hablar con un asesor\n"
                    f"*menu* para volver al inicio"
                )
                save_session(tenant_id, phone, {
                    "estado": Estado.VIENDO_RESULTADOS,
                    "productos": productos,
                    "producto_seleccionado": prod,
                    "modo": "confirmando_pedido"
                })

        elif mensaje == "2":
            respuesta = "🔍 ¿Qué producto buscas?\n\nEscribe el nombre:"
            save_session(tenant_id, phone, {"estado": Estado.BUSCANDO_PRODUCTO})

        else:
            respuesta = (
                "Por favor escribe el *número* del producto\n"
                "o *menu* para volver al inicio."
            )

    elif estado == Estado.CONFIRMANDO_NOMBRE:
        if len(mensaje.strip()) < 3:
            respuesta = "Por favor escribe tu nombre completo (mínimo 3 caracteres):"
        else:
            nombre_cliente = mensaje.strip().title()
            respuesta = f"📝 Gracias *{nombre_cliente}*\n\n¿Cuál es tu número de *cédula o RIF*?"
            save_session(tenant_id, phone, {
                "estado": Estado.CONFIRMANDO_CEDULA,
                "producto": sesion.get("producto"),
                "nombre_cliente": nombre_cliente
            })

    elif estado == Estado.CONFIRMANDO_CEDULA:
        cedula = mensaje.strip().upper()
        prod   = sesion.get("producto", {})
        nombre_cliente = sesion.get("nombre_cliente", "")
        tasa   = get_tasa_cambio(tenant_id, db)
        bs     = prod.get("price", 0) * tasa

        respuesta = (
            f"📦 *Resumen de tu pedido:*\n\n"
            f"🛒 Producto: *{prod.get('name', '')}*\n"
            f"💵 Precio:   *${prod.get('price', 0):.2f} USD* (Bs {bs:,.0f})\n"
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
                    f"Un asesor te contactará pronto para coordinar\n"
                    f"el pago y la entrega. ⏰ Máx. 2 horas\n\n"
                    f"¡Gracias por preferir *{nombre_negocio}*! 🙏\n\n"
                    f"_Escribe *menu* si necesitas algo más_"
                )
                clear_session(tenant_id, phone)
            else:
                respuesta = (
                    "⚠️ Hubo un problema al registrar el pedido.\n\n"
                    "Por favor escribe *0* para hablar con un asesor."
                )
        elif mensaje == "2":
            clear_session(tenant_id, phone)
            respuesta = (
                "❌ Pedido cancelado.\n\n" +
                texto_menu_principal(nombre_negocio)
            )
        else:
            respuesta = "Por favor escribe *1* para confirmar o *2* para cancelar."

    # ── Respuesta por defecto ─────────────────────────────────────────────────
    if respuesta is None:
        clear_session(tenant_id, phone)
        respuesta = texto_menu_principal(nombre_negocio)

    # Enviar respuesta
    await enviar_mensaje(tenant_id, phone, respuesta)

    return {"ok": True, "estado": estado, "respuesta_enviada": True}


# ── ENDPOINT: listar clientes esperando asesor ───────────────────────────────
@router.get("/waiting/{tenant_id}")
async def get_waiting_customers(tenant_id: str):
    """Lista clientes en estado ESPERANDO_ASESOR para que el admin los atienda."""
    waiting = []
    prefix = f"chatbot:{tenant_id}:"
    now = _time.time()

    # Buscar en Redis
    r = get_redis()
    if r:
        try:
            keys = r.keys(f"mif:{tenant_id}:chatbot:*")
            for k in keys:
                raw = r.get(k)
                if raw:
                    data = json.loads(raw)
                    if data.get("estado") == Estado.ESPERANDO_ASESOR:
                        phone = str(k).split(":")[-1].replace("'", "")
                        waiting.append({
                            "phone": phone,
                            "nombre": data.get("nombre_cliente", "Sin nombre"),
                            "estado": data.get("estado")
                        })
        except Exception:
            pass

    # Buscar en memoria
    for k, v in list(_memory_sessions.items()):
        if k.startswith(prefix) and v.get("expires_at", 0) > now:
            data = v.get("data", {})
            if data.get("estado") == Estado.ESPERANDO_ASESOR:
                phone = k.replace(prefix, "")
                waiting.append({
                    "phone": phone,
                    "nombre": data.get("nombre_cliente", "Sin nombre"),
                    "estado": "ESPERANDO_ASESOR"
                })

    return {"tenant": tenant_id, "waiting": waiting, "count": len(waiting)}


# ── ENDPOINT: el asesor libera al cliente (vuelve al bot) ────────────────────
@router.post("/release/{tenant_id}/{phone}")
async def release_to_bot(tenant_id: str, phone: str):
    """El asesor termina la atención y devuelve al cliente al chatbot."""
    clear_session(tenant_id, phone)
    await enviar_mensaje(tenant_id, phone,
        "✅ El asesor terminó la atención.\n\n"
        "Escribe *menu* cuando necesites algo más. ¡Hasta pronto! 👋"
    )
    return {"ok": True, "message": f"Cliente {phone} liberado al chatbot"}


# ── ENDPOINT: estado de conversación (para debugging) ────────────────────────
@router.get("/session/{tenant_id}/{phone}")
async def get_session_debug(tenant_id: str, phone: str):
    """Solo para debugging — ver el estado de una conversación."""
    sesion = get_session(tenant_id, phone)
    return {"tenant": tenant_id, "phone": phone, "sesion": sesion}


# ── ENDPOINT: limpiar conversación ───────────────────────────────────────────
@router.delete("/session/{tenant_id}/{phone}")
async def clear_session_endpoint(tenant_id: str, phone: str):
    """Limpiar sesión de un cliente (resetear conversación)."""
    clear_session(tenant_id, phone)
    return {"ok": True, "message": "Sesión limpiada"}
