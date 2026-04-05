"""
routers/bloqueo.py
Endpoints de control de bloqueo para ventas a crédito de celulares.

Expone las acciones de bloqueo/desbloqueo directamente vinculadas
a ventas existentes en Mi Inventario Fácil, delegando la ejecución
real del push FCM a BloqueCelular.

Endpoints:
    GET  /bloqueo/apk-url                  → URL pública del APK
    POST /bloqueo/config/conectar           → Probar y guardar credenciales
    GET  /bloqueo/sales/{sale_id}/estado    → Estado del equipo
    POST /bloqueo/sales/{sale_id}/bloquear  → Bloquear equipo
    POST /bloqueo/sales/{sale_id}/desbloquear → Desbloquear equipo
    POST /bloqueo/sales/{sale_id}/nuevo-codigo → Generar nuevo BLC code
    POST /bloqueo/sales/{sale_id}/sync      → Reintentar sincronización
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timedelta

from ..database.db import get_db
from ..dependencies import get_current_active_user
from ..models import models
from ..tenant_context import get_tenant_schema
from ..services import bloqueocelular_service as bloqueo

router = APIRouter(prefix="/bloqueo", tags=["bloqueo"])

# ─── Schemas de request ───────────────────────────────────────────────────────

class BloquearRequest(BaseModel):
    motivo: Optional[str] = "Mora en pago — Mi Inventario Fácil"

class DesbloquearRequest(BaseModel):
    nueva_fecha_limite: Optional[str] = None  # YYYY-MM-DD

class ConectarRequest(BaseModel):
    email   : str
    password: str

class SyncRequest(BaseModel):
    imei         : Optional[str] = None
    num_cuotas   : Optional[int] = 6


# ─── Helper: obtener venta con validación ─────────────────────────────────────

def _get_sale_or_404(sale_id: int, db: Session, schema: str) -> models.Sale:
    sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if not sale.is_credit:
        raise HTTPException(status_code=400, detail="Esta venta no es a crédito")
    return sale


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/apk-url")
def get_apk_url():
    """
    Retorna la URL pública del APK de BloqueCelular.
    El frontend la usa para mostrar el botón de descarga y el QR.
    """
    return {
        "apk_url"    : bloqueo.APK_URL_PUBLICA,
        "descripcion": "App Android para el sistema de bloqueo de celulares a crédito",
        "instrucciones": [
            "1. Descarga e instala la app en el celular del cliente",
            "2. Abre la app e ingresa el código BLC que aparece en la venta",
            "3. El celular quedará vinculado al sistema de bloqueo",
        ]
    }


@router.post("/config/conectar")
def conectar_bloqueocelular(
    req: ConectarRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Prueba la conexión con BloqueCelular y guarda las credenciales si es exitosa.
    Llamado desde el panel de Configuración → Integraciones.
    Solo ADMIN puede configurar esto.
    """
    if current_user.role.value not in ("ADMIN",):
        raise HTTPException(status_code=403, detail="Solo el administrador puede configurar esta integración")

    schema = get_tenant_schema()

    # Probar conexión
    resultado = bloqueo.probar_conexion(req.email, req.password)
    if not resultado["ok"]:
        raise HTTPException(status_code=400, detail=resultado["error"])

    # Guardar credenciales y token
    from sqlalchemy import text as _t
    exp = (datetime.utcnow() + timedelta(days=7)).isoformat()
    for key, value in [
        ("bloqueocelular_enabled",   "true"),
        ("bloqueocelular_email",     req.email),
        ("bloqueocelular_password",  req.password),
        ("bloqueocelular_token",     resultado["token"]),
        ("bloqueocelular_token_exp", exp),
        ("bloqueocelular_tenant_id", resultado["tenant_id"]),
    ]:
        db.execute(_t(f"""
            INSERT INTO "{schema}".business_config (key, value)
            VALUES (:k, :v) ON CONFLICT (key) DO UPDATE SET value = :v
        """), {"k": key, "v": value})
    db.commit()

    return {
        "ok"       : True,
        "tenant_id": resultado["tenant_id"],
        "mensaje"  : f"✅ Conectado a BloqueCelular como '{resultado.get('nombre', req.email)}'",
    }


@router.post("/config/desconectar")
def desconectar_bloqueocelular(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Desactiva la integración con BloqueCelular para este tenant."""
    if current_user.role.value not in ("ADMIN",):
        raise HTTPException(status_code=403, detail="Solo el administrador puede configurar esta integración")

    schema = get_tenant_schema()
    from sqlalchemy import text as _t
    for key in ["bloqueocelular_enabled","bloqueocelular_token","bloqueocelular_token_exp"]:
        db.execute(_t(f"""
            INSERT INTO "{schema}".business_config (key, value)
            VALUES (:k, :v) ON CONFLICT (key) DO UPDATE SET value = :v
        """), {"k": key, "v": "false" if key == "bloqueocelular_enabled" else ""})
    db.commit()
    return {"ok": True, "mensaje": "BloqueCelular desconectado"}


@router.get("/config/estado")
def estado_config(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Retorna el estado actual de la configuración de BloqueCelular."""
    schema = get_tenant_schema()
    enabled   = bloqueo.is_enabled(db, schema)
    tenant_id = bloqueo._get_config(db, "bloqueocelular_tenant_id", schema)
    email     = bloqueo._get_config(db, "bloqueocelular_email", schema)
    token_exp = bloqueo._get_config(db, "bloqueocelular_token_exp", schema)

    token_vigente = False
    if token_exp:
        try:
            token_vigente = datetime.utcnow() < datetime.fromisoformat(token_exp)
        except ValueError:
            pass

    return {
        "enabled"      : enabled,
        "tenant_id"    : tenant_id or "",
        "email"        : email     or "",
        "token_vigente": token_vigente,
        "apk_url"      : bloqueo.APK_URL_PUBLICA,
    }


@router.get("/sales/{sale_id}/estado")
def estado_dispositivo(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Consulta el estado actual del dispositivo en BloqueCelular.
    Retorna: { id, imei, nombre_equipo, estado, saldo_pendiente, cuotas_pagadas, ... }
    """
    schema = get_tenant_schema()
    sale   = _get_sale_or_404(sale_id, db, schema)

    # Obtener bloqueo_dispositivo_id directamente de la BD
    row = db.execute(
        text(f'SELECT bloqueo_dispositivo_id, bloqueo_codigo_activacion, bloqueo_estado FROM "{schema}".sales WHERE id = :id'),
        {"id": sale_id}
    ).fetchone()

    if not row or not row[0]:
        # Puede tener cliente y código pero sin dispositivo aún (sin IMEI)
        row_extra = db.execute(
            text(f'SELECT bloqueo_sincronizado, bloqueo_codigo_activacion, bloqueo_cliente_id, bloqueo_estado FROM "{schema}".sales WHERE id = :id'),
            {"id": sale_id}
        ).fetchone()
        return {
            "sincronizado"     : bool(row_extra and row_extra[0]),
            "dispositivo_id"   : None,
            "estado"           : (row_extra[3] if row_extra and row_extra[3] else None),
            "codigo_activacion": (row_extra[1] if row_extra else None),
            "cliente_id"       : (row_extra[2] if row_extra else None),
            "mensaje"          : "Venta sincronizada sin dispositivo (falta IMEI del equipo)" if (row_extra and row_extra[0]) else "Sin dispositivo registrado en BloqueCelular",
        }

    disp_id = row[0]
    estado_local = row[2]

    # Consultar estado en BloqueCelular
    estado_remoto = bloqueo.obtener_estado(db, schema, disp_id)
    if not estado_remoto:
        return {
            "sincronizado"    : True,
            "dispositivo_id"  : disp_id,
            "estado_local"    : estado_local,
            "estado_remoto"   : None,
            "mensaje"         : "BloqueCelular no disponible momentáneamente",
        }

    # Actualizar estado local si cambió
    estado_actual = estado_remoto.get("estado", estado_local)
    if estado_actual != estado_local:
        db.execute(
            text(f'UPDATE "{schema}".sales SET bloqueo_estado = :e WHERE id = :id'),
            {"e": estado_actual, "id": sale_id}
        )
        db.commit()

    return {
        "sincronizado"     : True,
        "dispositivo_id"   : disp_id,
        "estado"           : estado_actual,
        "imei"             : estado_remoto.get("imei"),
        "nombre_equipo"    : estado_remoto.get("nombre_equipo"),
        "saldo_pendiente"  : estado_remoto.get("saldo_pendiente"),
        "cuotas_pagadas"   : estado_remoto.get("cuotas_pagadas"),
        "num_cuotas"       : estado_remoto.get("num_cuotas"),
        "fecha_limite_pago": estado_remoto.get("fecha_limite_pago"),
        "codigo_activacion": row[1],
    }


@router.post("/sales/{sale_id}/bloquear")
def bloquear_equipo(
    sale_id: int,
    req: BloquearRequest = Body(default=BloquearRequest()),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Bloquea el celular asociado a una venta a crédito.
    El bloqueo se aplica en segundos si el equipo tiene internet.
    Si no tiene internet, Firebase retiene el push hasta 4 semanas.
    """
    schema = get_tenant_schema()
    _get_sale_or_404(sale_id, db, schema)

    row = db.execute(
        text(f'SELECT bloqueo_dispositivo_id FROM "{schema}".sales WHERE id = :id'),
        {"id": sale_id}
    ).fetchone()

    if not row or not row[0]:
        raise HTTPException(
            status_code=400,
            detail="Esta venta no tiene dispositivo registrado en BloqueCelular. "
                   "Verifica que el código BLC fue ingresado en la app del celular."
        )

    ok = bloqueo.bloquear_dispositivo(
        db=db, schema=schema,
        dispositivo_id=row[0],
        motivo=req.motivo or "Mora en pago — Mi Inventario Fácil"
    )
    if not ok:
        raise HTTPException(status_code=502, detail="No se pudo enviar el comando de bloqueo a BloqueCelular")

    # Actualizar estado local
    db.execute(
        text(f'UPDATE "{schema}".sales SET bloqueo_estado = \'bloqueado\' WHERE id = :id'),
        {"id": sale_id}
    )
    db.commit()

    return {
        "ok"     : True,
        "mensaje": "✅ Comando de bloqueo enviado. El equipo se bloqueará en segundos.",
        "estado" : "bloqueado",
    }


@router.post("/sales/{sale_id}/desbloquear")
def desbloquear_equipo(
    sale_id: int,
    req: DesbloquearRequest = Body(default=DesbloquearRequest()),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Desbloquea el celular cuando el cliente paga.
    """
    schema = get_tenant_schema()
    _get_sale_or_404(sale_id, db, schema)

    row = db.execute(
        text(f'SELECT bloqueo_dispositivo_id FROM "{schema}".sales WHERE id = :id'),
        {"id": sale_id}
    ).fetchone()

    if not row or not row[0]:
        raise HTTPException(status_code=400, detail="Sin dispositivo registrado en BloqueCelular")

    ok = bloqueo.desbloquear_dispositivo(
        db=db, schema=schema,
        dispositivo_id=row[0],
        nueva_fecha_limite=req.nueva_fecha_limite
    )
    if not ok:
        raise HTTPException(status_code=502, detail="No se pudo enviar el comando de desbloqueo")

    # Actualizar estado local
    db.execute(
        text(f'UPDATE "{schema}".sales SET bloqueo_estado = \'activo\' WHERE id = :id'),
        {"id": sale_id}
    )
    db.commit()

    return {
        "ok"     : True,
        "mensaje": "✅ Comando de desbloqueo enviado. El equipo se desbloqueará en segundos.",
        "estado" : "activo",
    }


@router.post("/sales/{sale_id}/nuevo-codigo")
def generar_nuevo_codigo(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Genera un nuevo código BLC-XXXX para una venta.
    Usar cuando el código anterior expiró o fue usado para un equipo diferente.
    """
    schema = get_tenant_schema()
    _get_sale_or_404(sale_id, db, schema)

    row = db.execute(
        text(f'SELECT bloqueo_cliente_id, bloqueo_codigo_activacion FROM "{schema}".sales WHERE id = :id'),
        {"id": sale_id}
    ).fetchone()

    if not row or not row[0]:
        raise HTTPException(status_code=400, detail="Esta venta no está sincronizada con BloqueCelular")

    nuevo_codigo = bloqueo.generar_nuevo_codigo(db, schema, row[0])
    if not nuevo_codigo:
        raise HTTPException(status_code=502, detail="No se pudo generar el nuevo código")

    # Guardar nuevo código
    db.execute(
        text(f'UPDATE "{schema}".sales SET bloqueo_codigo_activacion = :c WHERE id = :id'),
        {"c": nuevo_codigo, "id": sale_id}
    )
    db.commit()

    return {
        "ok"               : True,
        "codigo_activacion": nuevo_codigo,
        "mensaje"          : f"Nuevo código generado: {nuevo_codigo}",
        "instrucciones"    : [
            "1. Abre la app BloqueCelular en el celular del cliente",
            f"2. Ingresa el código: {nuevo_codigo}",
            "3. El celular quedará vinculado al sistema de bloqueo",
        ]
    }


@router.post("/sales/{sale_id}/sync")
def sincronizar_venta(
    sale_id: int,
    req: SyncRequest = Body(default=SyncRequest()),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Reintenta la sincronización de una venta a crédito con BloqueCelular.
    Usar cuando la sincronización inicial falló (BloqueCelular estaba caído).
    """
    schema = get_tenant_schema()
    sale   = _get_sale_or_404(sale_id, db, schema)

    # Verificar que no esté ya sincronizada
    row = db.execute(
        text(f'SELECT bloqueo_sincronizado, bloqueo_codigo_activacion FROM "{schema}".sales WHERE id = :id'),
        {"id": sale_id}
    ).fetchone()

    if row and row[0]:
        return {
            "ok"               : True,
            "ya_sincronizada"  : True,
            "codigo_activacion": row[1],
            "mensaje"          : "Esta venta ya está sincronizada con BloqueCelular",
        }

    # Obtener datos del cliente
    customer = db.query(models.Customer).filter(
        models.Customer.id == sale.customer_id
    ).first() if sale.customer_id else None

    # Buscar IMEI del producto (si viene en el request o de las instancias)
    imei = req.imei
    if not imei:
        # Intentar obtenerlo de las instancias de la venta
        instance_row = db.execute(text(f"""
            SELECT pi.serial_number
            FROM "{schema}".sale_detail_instances sdi
            JOIN "{schema}".sale_details sd ON sd.id = sdi.sale_detail_id
            JOIN "{schema}".product_instances pi ON pi.id = sdi.product_instance_id
            WHERE sd.sale_id = :sid AND pi.serial_number IS NOT NULL
            LIMIT 1
        """), {"sid": sale_id}).fetchone()
        if instance_row:
            imei = instance_row[0]

    # Buscar nombre del producto principal
    prod_row = db.execute(text(f"""
        SELECT p.name
        FROM "{schema}".sale_details sd
        JOIN "{schema}".products p ON p.id = sd.product_id
        WHERE sd.sale_id = :sid
        ORDER BY sd.id ASC LIMIT 1
    """), {"sid": sale_id}).fetchone()
    product_name = prod_row[0] if prod_row else "Celular"

    resultado = bloqueo.sincronizar_venta_credito(
        db              = db,
        schema          = schema,
        sale_id         = sale_id,
        customer_name   = customer.name if customer else "Cliente",
        customer_phone  = customer.phone if customer else None,
        customer_id_number = getattr(customer, "id_number", None) if customer else None,
        customer_email  = getattr(customer, "email", None) if customer else None,
        total_amount    = float(sale.total_amount),
        balance_pending = float(sale.balance_pending or sale.total_amount),
        due_date        = sale.due_date,
        imei            = imei,
        product_name    = product_name,
        num_cuotas      = req.num_cuotas or 6,
    )

    if not resultado["ok"]:
        raise HTTPException(status_code=502, detail=resultado.get("error","Error sincronizando"))

    return {
        "ok"               : True,
        "cliente_id"       : resultado["cliente_id"],
        "dispositivo_id"   : resultado["dispositivo_id"],
        "codigo_activacion": resultado["codigo_activacion"],
        "mensaje"          : f"✅ Sincronización exitosa. Código BLC: {resultado['codigo_activacion']}",
        "apk_url"          : bloqueo.APK_URL_PUBLICA,
    }
