"""
bloqueocelular_service.py
Servicio de integración entre Mi Inventario Fácil y BloqueCelular.

BloqueCelular es el sistema que controla el bloqueo/desbloqueo remoto
de celulares vendidos a crédito via push FCM (Google) y HMS (Huawei).

Comunicación: HTTP directo entre contenedores Docker en la red web_publica.
URL interna:  http://backend_bloqueo_server:3000
URL externa:  https://bloqueo.miinventariofacil.com

Flujo de venta:
  1. Vendedor registra venta a crédito con IMEI
  2. Este servicio crea/busca el cliente en BloqueCelular
  3. Registra el dispositivo → BloqueCelular retorna codigo_activacion (BLC-XXXX)
  4. El código se muestra al vendedor y se incluye en el ticket
  5. Técnico instala APK en el celular usando el código
  6. Si el cliente no paga → vendedor bloquea desde Mi Inventario
  7. Si el cliente paga → vendedor desbloquea desde Mi Inventario
"""

import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

# ─── Configuración ────────────────────────────────────────────────────────────

BLOQUEO_URL     = "http://backend_bloqueo_server:3000"
APK_URL_PUBLICA = "https://bloqueo.miinventariofacil.com/public/app/bloqueo.apk"
TIMEOUT_SECS    = 10
TOKEN_BUFFER_HRS = 1  # Renovar si vence en menos de 1 hora


# ─── Helpers internos ─────────────────────────────────────────────────────────

def _get_config(db: Session, key: str, schema: str) -> Optional[str]:
    """Lee un valor de business_config del tenant actual."""
    row = db.execute(
        text(f'SELECT value FROM "{schema}".business_config WHERE key = :k'),
        {"k": key}
    ).fetchone()
    return row[0] if row else None


def _set_config(db: Session, key: str, value: str, schema: str) -> None:
    """Actualiza o inserta un valor en business_config."""
    db.execute(
        text(f"""
            INSERT INTO "{schema}".business_config (key, value)
            VALUES (:k, :v)
            ON CONFLICT (key) DO UPDATE SET value = :v
        """),
        {"k": key, "v": value}
    )
    db.commit()


def is_enabled(db: Session, schema: str) -> bool:
    """Verifica si la integración con BloqueCelular está activada en este tenant."""
    return _get_config(db, "bloqueocelular_enabled", schema) == "true"


# ─── Autenticación JWT ────────────────────────────────────────────────────────

def get_token(db: Session, schema: str) -> Optional[str]:
    """
    Retorna el token JWT vigente de BloqueCelular.
    Si está expirado o no existe, lo renueva automáticamente.
    """
    token = _get_config(db, "bloqueocelular_token", schema)
    exp   = _get_config(db, "bloqueocelular_token_exp", schema)

    # Verificar si el token sigue vigente
    if token and exp:
        try:
            exp_dt = datetime.fromisoformat(exp)
            if datetime.utcnow() < exp_dt - timedelta(hours=TOKEN_BUFFER_HRS):
                return token
        except ValueError:
            pass  # formato inválido → renovar

    # Renovar token
    return _renovar_token(db, schema)


def _renovar_token(db: Session, schema: str) -> Optional[str]:
    """Obtiene un nuevo token JWT de BloqueCelular con las credenciales guardadas."""
    email    = _get_config(db, "bloqueocelular_email", schema)
    password = _get_config(db, "bloqueocelular_password", schema)
    url      = _get_config(db, "bloqueocelular_url", schema) or BLOQUEO_URL

    if not email or not password:
        logger.warning("[Bloqueo] Sin credenciales configuradas — integración desactivada")
        return None

    try:
        with httpx.Client(timeout=TIMEOUT_SECS) as client:
            r = client.post(
                f"{url}/api/auth/login",
                json={"email": email, "password": password},
                headers={"Content-Type": "application/json"}
            )
            if r.status_code == 200:
                data  = r.json()
                token = data.get("token")
                if token:
                    # Guardar token y fecha de expiración (7 días)
                    exp = (datetime.utcnow() + timedelta(days=7)).isoformat()
                    _set_config(db, "bloqueocelular_token",     token, schema)
                    _set_config(db, "bloqueocelular_token_exp", exp,   schema)
                    # Guardar tenant_id de BloqueCelular si viene en la respuesta
                    tenant_id = data.get("admin", {}).get("tenant_id", "")
                    if tenant_id:
                        _set_config(db, "bloqueocelular_tenant_id", tenant_id, schema)
                    logger.info(f"[Bloqueo] Token renovado para schema '{schema}'")
                    return token
    except Exception as e:
        logger.error(f"[Bloqueo] Error renovando token: {e}")

    return None


# ─── API calls a BloqueCelular ────────────────────────────────────────────────

def sincronizar_cliente(
    db: Session,
    schema: str,
    nombre: str,
    telefono: Optional[str] = None,
    cedula: Optional[str] = None,
    email: Optional[str] = None,
    precio: float = 0,
    enganche: float = 0,
    tasa: float = 0,
    num_cuotas: int = 12,
    frecuencia: str = "mensual",
) -> Optional[dict]:
    """
    Crea o busca el cliente en BloqueCelular.
    Si la cédula ya existe, busca el cliente existente y genera un nuevo código BLC.
    Retorna: { id, nombre, codigo_activacion, codigos_pendientes }
    El campo codigo_activacion (BLC-XXXX) es el que se muestra al vendedor.
    """
    token = get_token(db, schema)
    url   = _get_config(db, "bloqueocelular_url", schema) or BLOQUEO_URL
    if not token:
        return None

    headers = {"Authorization": f"Bearer {token}"}

    try:
        with httpx.Client(timeout=TIMEOUT_SECS) as client:
            # 1. Intentar crear el cliente
            r = client.post(
                f"{url}/api/clientes",
                json={
                    "nombre"    : nombre or "Cliente",
                    "telefono"  : telefono or "00000000000",  # Fallback si no tiene teléfono
                    "cedula"    : cedula   or "",
                    "email"     : email    or "",
                    "precio"    : precio,
                    "enganche"  : enganche,
                    "tasa"      : tasa,
                    "num_cuotas": num_cuotas,
                    "frecuencia": frecuencia,
                },
                headers=headers
            )
            if r.status_code == 201:
                data = r.json()
                logger.info(f"[Bloqueo] Cliente creado id={data.get('id')} código={data.get('codigo_activacion')}")
                return data

            # 2. Si la cédula ya existe, buscar el cliente y generar nuevo código
            if r.status_code == 400 and ("cédula" in r.text or "cedula" in r.text.lower() or "registrada" in r.text.lower()):
                logger.info(f"[Bloqueo] Cédula ya existe — buscando cliente existente")
                r_list = client.get(f"{url}/api/clientes", headers=headers)
                if r_list.status_code == 200:
                    clientes = r_list.json()
                    # Buscar por cédula, teléfono o nombre
                    cliente_found = None
                    for c in clientes:
                        if (cedula and c.get("cedula") == cedula) or                            (telefono and c.get("telefono") == telefono):
                            cliente_found = c
                            break
                    if not cliente_found and clientes:
                        # Buscar por nombre como fallback
                        for c in clientes:
                            if nombre and nombre.lower() in c.get("nombre","").lower():
                                cliente_found = c
                                break

                    if cliente_found:
                        cid = cliente_found["id"]
                        logger.info(f"[Bloqueo] Cliente existente encontrado id={cid} — generando nuevo código")
                        # Generar un nuevo código BLC para esta venta
                        r_cod = client.post(f"{url}/api/clientes/{cid}/nuevo-codigo", headers=headers)
                        nuevo_codigo = None
                        if r_cod.status_code == 200:
                            nuevo_codigo = r_cod.json().get("codigo")
                        elif r_cod.status_code == 201:
                            nuevo_codigo = r_cod.json().get("codigo")

                        # Retornar con el mismo formato que un cliente nuevo
                        return {
                            "id"               : cid,
                            "nombre"           : cliente_found.get("nombre", nombre),
                            "nivel"            : cliente_found.get("nivel", "bronce"),
                            "codigo_activacion": nuevo_codigo,
                            "codigos_pendientes": [nuevo_codigo] if nuevo_codigo else [],
                        }

            logger.warning(f"[Bloqueo] Error creando cliente: {r.status_code} {r.text[:100]}")
    except Exception as e:
        logger.warning(f"[Bloqueo] Error sincronizando cliente: {e}")

    return None


def registrar_dispositivo(
    db: Session,
    schema: str,
    imei: str,
    nombre_equipo: str,
    cliente_bloqueo_id: int,
    precio_venta: float,
    enganche: float,
    monto_financiado: float,
    num_cuotas: int,
    monto_cuota: float,
    fecha_limite_pago: str,
    tasa_interes: float = 0,
    frecuencia: str = "mensual",
) -> Optional[dict]:
    """
    Registra el dispositivo (celular) en BloqueCelular.
    Retorna: { id, estado, saldo_pendiente, cuotas_pagadas }
    """
    token = get_token(db, schema)
    url   = _get_config(db, "bloqueocelular_url", schema) or BLOQUEO_URL
    if not token:
        return None

    try:
        with httpx.Client(timeout=TIMEOUT_SECS) as client:
            r = client.post(
                f"{url}/api/dispositivos",
                json={
                    "imei"            : imei,
                    "nombre_equipo"   : nombre_equipo,
                    "cliente_id"      : cliente_bloqueo_id,
                    "precio_venta"    : precio_venta,
                    "enganche"        : enganche,
                    "monto_financiado": monto_financiado,
                    "saldo_pendiente" : monto_financiado,
                    "num_cuotas"      : num_cuotas,
                    "frecuencia"      : frecuencia,
                    "monto_cuota"     : monto_cuota,
                    "tasa_interes"    : tasa_interes,
                    "fecha_limite_pago": fecha_limite_pago,
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            if r.status_code == 201:
                data = r.json()
                logger.info(f"[Bloqueo] Dispositivo registrado id={data.get('id')}")
                return data
            else:
                logger.warning(f"[Bloqueo] Error registrando dispositivo: {r.status_code} {r.text[:100]}")
    except Exception as e:
        logger.warning(f"[Bloqueo] Error registrando dispositivo: {e}")

    return None


def registrar_pago(
    db: Session,
    schema: str,
    dispositivo_id: int,
    monto: float,
    metodo: str = "efectivo",
    num_cuota: int = 1,
) -> bool:
    """
    Notifica a BloqueCelular cuando el cliente abona una cuota.
    Retorna True si el pago fue registrado exitosamente.
    """
    token = get_token(db, schema)
    url   = _get_config(db, "bloqueocelular_url", schema) or BLOQUEO_URL
    if not token:
        return False

    try:
        with httpx.Client(timeout=TIMEOUT_SECS) as client:
            r = client.post(
                f"{url}/api/pagos",
                json={
                    "dispositivo_id": dispositivo_id,
                    "monto"         : monto,
                    "metodo_pago"   : metodo,
                    "num_cuota"     : num_cuota,
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            if r.status_code == 201:
                data = r.json()
                logger.info(
                    f"[Bloqueo] Pago registrado dispositivo={dispositivo_id} "
                    f"saldo_pendiente={data.get('saldo_pendiente')}"
                )
                return True
            else:
                logger.warning(f"[Bloqueo] Error registrando pago: {r.status_code} {r.text[:100]}")
    except Exception as e:
        logger.warning(f"[Bloqueo] Error registrando pago: {e}")

    return False


def bloquear_dispositivo(
    db: Session,
    schema: str,
    dispositivo_id: int,
    motivo: str = "Mora en pago — Mi Inventario Fácil",
) -> bool:
    """
    Envía el comando de bloqueo FCM/HMS al celular del cliente.
    El celular se bloquea en segundos si tiene internet.
    Si no tiene internet, Firebase retiene el push hasta 4 semanas.
    """
    token = get_token(db, schema)
    url   = _get_config(db, "bloqueocelular_url", schema) or BLOQUEO_URL
    if not token:
        return False

    try:
        with httpx.Client(timeout=15) as client:
            r = client.post(
                f"{url}/api/dispositivos/{dispositivo_id}/bloquear",
                json={"motivo": motivo},
                headers={"Authorization": f"Bearer {token}"}
            )
            if r.status_code == 200:
                logger.info(f"[Bloqueo] Dispositivo {dispositivo_id} bloqueado")
                return True
            else:
                logger.warning(f"[Bloqueo] Error bloqueando: {r.status_code} {r.text[:100]}")
    except Exception as e:
        logger.warning(f"[Bloqueo] Error enviando bloqueo: {e}")

    return False


def desbloquear_dispositivo(
    db: Session,
    schema: str,
    dispositivo_id: int,
    nueva_fecha_limite: Optional[str] = None,
) -> bool:
    """
    Envía el comando de desbloqueo FCM/HMS al celular del cliente.
    """
    token = get_token(db, schema)
    url   = _get_config(db, "bloqueocelular_url", schema) or BLOQUEO_URL
    if not token:
        return False

    # Si no se da nueva fecha, usar 30 días desde hoy
    if not nueva_fecha_limite:
        nueva_fecha_limite = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")

    try:
        with httpx.Client(timeout=15) as client:
            r = client.post(
                f"{url}/api/dispositivos/{dispositivo_id}/desbloquear",
                json={"nueva_fecha_limite": nueva_fecha_limite},
                headers={"Authorization": f"Bearer {token}"}
            )
            if r.status_code == 200:
                logger.info(f"[Bloqueo] Dispositivo {dispositivo_id} desbloqueado")
                return True
            else:
                logger.warning(f"[Bloqueo] Error desbloqueando: {r.status_code} {r.text[:100]}")
    except Exception as e:
        logger.warning(f"[Bloqueo] Error enviando desbloqueo: {e}")

    return False


def obtener_estado(
    db: Session,
    schema: str,
    dispositivo_id: int,
) -> Optional[dict]:
    """
    Consulta el estado actual de un dispositivo en BloqueCelular.
    Retorna: { id, imei, nombre_equipo, estado, saldo_pendiente, cuotas_pagadas, ... }
    """
    token = get_token(db, schema)
    url   = _get_config(db, "bloqueocelular_url", schema) or BLOQUEO_URL
    if not token:
        return None

    try:
        with httpx.Client(timeout=TIMEOUT_SECS) as client:
            r = client.get(
                f"{url}/api/dispositivos/{dispositivo_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            if r.status_code == 200:
                return r.json()
            else:
                logger.warning(f"[Bloqueo] Error consultando estado: {r.status_code}")
    except Exception as e:
        logger.warning(f"[Bloqueo] Error consultando estado: {e}")

    return None


def generar_nuevo_codigo(
    db: Session,
    schema: str,
    cliente_bloqueo_id: int,
) -> Optional[str]:
    """
    Genera un nuevo código BLC-XXXX para un cliente existente.
    Usar cuando el código anterior ya fue usado o expiró (2do equipo, código perdido).
    """
    token = get_token(db, schema)
    url   = _get_config(db, "bloqueocelular_url", schema) or BLOQUEO_URL
    if not token:
        return None

    try:
        with httpx.Client(timeout=TIMEOUT_SECS) as client:
            r = client.post(
                f"{url}/api/clientes/{cliente_bloqueo_id}/nuevo-codigo",
                headers={"Authorization": f"Bearer {token}"}
            )
            if r.status_code == 200:
                return r.json().get("codigo")
    except Exception as e:
        logger.warning(f"[Bloqueo] Error generando nuevo código: {e}")

    return None


def probar_conexion(email: str, password: str, url: str = BLOQUEO_URL) -> dict:
    """
    Prueba la conexión con BloqueCelular con las credenciales dadas.
    Retorna: { ok: bool, tenant_id: str, error: str }
    Usado desde el panel de configuración del tenant.
    """
    try:
        with httpx.Client(timeout=TIMEOUT_SECS) as client:
            r = client.post(
                f"{url}/api/auth/login",
                json={"email": email, "password": password},
                headers={"Content-Type": "application/json"}
            )
            if r.status_code == 200:
                data = r.json()
                return {
                    "ok"       : True,
                    "tenant_id": data.get("admin", {}).get("tenant_id", ""),
                    "nombre"   : data.get("admin", {}).get("nombre", ""),
                    "token"    : data.get("token", ""),
                    "error"    : None,
                }
            else:
                return {"ok": False, "error": f"Credenciales inválidas (HTTP {r.status_code})"}
    except Exception as e:
        return {"ok": False, "error": f"No se pudo conectar a BloqueCelular: {str(e)[:100]}"}


# ─── Función principal: sincronizar venta a crédito ──────────────────────────

def sincronizar_venta_credito(
    db: Session,
    schema: str,
    sale_id: int,
    customer_name: str,
    customer_phone: Optional[str],
    customer_id_number: Optional[str],
    customer_email: Optional[str],
    total_amount: float,
    balance_pending: float,
    due_date: Optional[datetime],
    imei: Optional[str],
    product_name: str,
    num_cuotas: int = 6,
) -> dict:
    """
    Función principal que orquesta toda la sincronización de una venta a crédito.
    Crea el cliente, registra el dispositivo y retorna el resultado.

    Regla fundamental: esta función NUNCA lanza excepciones.
    Si algo falla, retorna un dict con ok=False y la venta sigue siendo válida.

    Returns:
        {
            ok: bool,
            cliente_id: int | None,
            dispositivo_id: int | None,
            codigo_activacion: str | None,   # "BLC-XXXX" — mostrar al vendedor
            error: str | None,
        }
    """
    resultado = {
        "ok"               : False,
        "cliente_id"       : None,
        "dispositivo_id"   : None,
        "codigo_activacion": None,
        "error"            : None,
    }

    if not is_enabled(db, schema):
        return resultado

    # Calcular datos del crédito
    enganche         = total_amount - balance_pending
    monto_cuota      = round(balance_pending / num_cuotas, 2) if num_cuotas > 0 else balance_pending
    fecha_limite_str = due_date.strftime("%Y-%m-%d") if due_date else \
                       (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")

    # 1. Crear cliente en BloqueCelular
    try:
        cliente_data = sincronizar_cliente(
            db           = db,
            schema       = schema,
            nombre       = customer_name,
            telefono     = customer_phone,
            cedula       = customer_id_number,
            email        = customer_email,
            precio       = total_amount,
            enganche     = enganche,
            num_cuotas   = num_cuotas,
        )
        if not cliente_data:
            resultado["error"] = "No se pudo crear el cliente en BloqueCelular"
            return resultado

        resultado["cliente_id"]        = cliente_data.get("id")
        resultado["codigo_activacion"] = cliente_data.get("codigo_activacion")
    except Exception as e:
        resultado["error"] = f"Error sincronizando cliente: {str(e)[:100]}"
        logger.error(f"[Bloqueo] {resultado['error']}")
        return resultado

    # 2. Registrar dispositivo (solo si tenemos IMEI)
    if imei:
        try:
            disp_data = registrar_dispositivo(
                db                = db,
                schema            = schema,
                imei              = imei,
                nombre_equipo     = product_name,
                cliente_bloqueo_id= resultado["cliente_id"],
                precio_venta      = total_amount,
                enganche          = enganche,
                monto_financiado  = balance_pending,
                num_cuotas        = num_cuotas,
                monto_cuota       = monto_cuota,
                fecha_limite_pago = fecha_limite_str,
            )
            if disp_data:
                resultado["dispositivo_id"] = disp_data.get("id")
        except Exception as e:
            logger.warning(f"[Bloqueo] Error registrando dispositivo: {e}")
            # No cancelamos — el cliente ya fue creado y tiene código BLC
    else:
        logger.info("[Bloqueo] Venta sin IMEI — cliente creado con código BLC pero sin dispositivo registrado")

    resultado["ok"] = True

    # 3. Guardar resultado en la BD de Mi Inventario
    try:
        db.execute(text(f"""
            UPDATE "{schema}".sales
            SET bloqueo_cliente_id        = :cid,
                bloqueo_dispositivo_id    = :did,
                bloqueo_codigo_activacion = :codigo,
                bloqueo_sincronizado      = TRUE,
                bloqueo_estado            = 'activo',
                bloqueo_error             = NULL
            WHERE id = :sid
        """), {
            "cid"  : resultado["cliente_id"],
            "did"  : resultado["dispositivo_id"],
            "codigo": resultado["codigo_activacion"],
            "sid"  : sale_id,
        })
        db.commit()
    except Exception as e:
        logger.error(f"[Bloqueo] Error guardando resultado en BD: {e}")

    return resultado
