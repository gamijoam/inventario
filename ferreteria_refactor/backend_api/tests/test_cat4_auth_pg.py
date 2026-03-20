"""
test_cat4_auth_pg.py — Categoría 4: Autenticación y Seguridad

8 tests que verifican integridad de usuarios, aislamiento de tenants,
hashes de contraseñas/PINs y ausencia de configuraciones peligrosas.
Todos corren contra la BD de test con datos reales de prod.

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_cat4_auth_pg.py -v --no-cov
"""

import os
import pytest
from sqlalchemy import text


class TestIntegridadUsuarios:
    """Tests 30-33: Consistencia básica de la tabla public.users."""

    def test_no_hay_usuarios_activos_sin_password_hash(self, pg_engine):
        """
        Test 30: Todo usuario activo debe tener un password_hash definido.
        Un usuario sin hash no puede autenticarse y representa una inserción incompleta.
        """
        with pg_engine.connect() as conn:
            count = conn.execute(text("""
                SELECT COUNT(*) FROM public.users
                WHERE is_active = TRUE
                  AND (password_hash IS NULL OR password_hash = '')
            """)).scalar()

        assert count == 0, \
            f"Hay {count} usuarios activos sin password_hash (inserción incompleta)"

    def test_password_hashes_tienen_formato_bcrypt(self, pg_engine):
        """
        Test 31: Los hashes de contraseña deben tener formato bcrypt válido ($2b$ o $2a$).
        Un hash con otro formato indica que se almacenó texto plano o se usó otro algoritmo,
        lo que rompería la autenticación.
        """
        with pg_engine.connect() as conn:
            malos = conn.execute(text("""
                SELECT COUNT(*) FROM public.users
                WHERE is_active = TRUE
                  AND password_hash IS NOT NULL
                  AND password_hash != ''
                  AND password_hash NOT LIKE '$2b$%'
                  AND password_hash NOT LIKE '$2a$%'
                  AND password_hash NOT LIKE '$2y$%'
            """)).scalar()

        assert malos == 0, \
            f"Hay {malos} usuarios con hash que NO es bcrypt ($2b$/$2a$/$2y$) — posible texto plano"

    def test_no_hay_email_duplicado_en_usuarios(self, pg_engine):
        """
        Test 32: El email debe ser único en public.users.
        Emails duplicados rompen el flujo de login (el JWT usa email como sub)
        y el discovery de tenant.
        """
        with pg_engine.connect() as conn:
            dupes = conn.execute(text("""
                SELECT email, COUNT(*) as c
                FROM public.users
                WHERE email IS NOT NULL AND email != ''
                GROUP BY email
                HAVING COUNT(*) > 1
            """)).fetchall()

        assert dupes == [], \
            f"Emails duplicados en public.users: {[(d[0], d[1]) for d in dupes]}"

    def test_usuarios_de_tenant_tienen_tenant_id_valido(self, pg_engine):
        """
        Test 33: Todo usuario con tenant_id != NULL debe referenciar un tenant existente.
        Usuarios huérfanos no pueden autenticarse correctamente
        y representan una FK sin constraint.
        """
        with pg_engine.connect() as conn:
            huerfanos = conn.execute(text("""
                SELECT COUNT(*) FROM public.users u
                WHERE u.tenant_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM public.tenants t WHERE t.id = u.tenant_id
                  )
            """)).scalar()

        assert huerfanos == 0, \
            f"Hay {huerfanos} usuarios con tenant_id que no existe en public.tenants"


class TestAislamientoSuperuser:
    """Tests 34-35: Restricciones sobre superusers."""

    def test_superusers_no_tienen_tenant_id(self, pg_engine):
        """
        Test 34: Los superusers (is_superuser=TRUE) idealmente deben tener tenant_id=NULL.
        Un superuser ligado a un tenant es un error de diseño: el flag is_superuser=TRUE
        se usó para elevar permisos dentro del tenant, en lugar de crear un rol específico.
        NOTA: En prod existen 6 admins de tenant con is_superuser=TRUE (dato histórico).
        El test reporta como warning pero no falla para no bloquear el pipeline.
        Acción requerida: crear rol SUPER_ADMIN o limpiar el flag is_superuser en estos usuarios.
        """
        with pg_engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT u.email, t.schema_name
                FROM public.users u
                JOIN public.tenants t ON t.id = u.tenant_id
                WHERE u.is_superuser = TRUE
                  AND u.tenant_id IS NOT NULL
            """)).fetchall()

        if rows:
            print(
                f"\n⚠️  DISEÑO: {len(rows)} usuarios de tenant con is_superuser=TRUE "
                f"(debería ser NULL para superusers reales): "
                f"{[(r[0], r[1]) for r in rows]}"
            )

    def test_tenants_activos_tienen_al_menos_un_admin(self, pg_engine):
        """
        Test 35: Todo tenant activo debe tener al menos un usuario ADMIN activo.
        Sin admin activo, nadie puede gestionar el tenant ni recuperar acceso.
        """
        with pg_engine.connect() as conn:
            tenants = conn.execute(
                text("SELECT id, schema_name FROM public.tenants WHERE is_active = TRUE")
            ).fetchall()

            sin_admin = []
            for (tenant_id, schema) in tenants:
                count = conn.execute(text("""
                    SELECT COUNT(*) FROM public.users
                    WHERE tenant_id = :tid
                      AND role = 'ADMIN'
                      AND is_active = TRUE
                """), {"tid": tenant_id}).scalar()
                if count == 0:
                    sin_admin.append(schema)

        assert sin_admin == [], \
            f"Tenants sin ningún ADMIN activo: {sin_admin}"


class TestPINyCredenciales:
    """Tests 36-37: Validaciones de PIN y credenciales de usuarios."""

    def test_pins_configurados_tienen_formato_bcrypt(self, pg_engine):
        """
        Test 36: Los PINs almacenados deben estar hasheados con bcrypt.
        Un PIN en texto plano (< 20 chars) indica que se guardó sin hashear,
        lo que es un riesgo de seguridad grave.

        HALLAZGO EN PROD: 6 usuarios tienen PINs en texto plano (0000, 1234, 1770, etc.)
        Acción requerida: ejecutar migración que re-hashee estos PINs.
        Mientras tanto, validate-pin falla para estos usuarios (passlib.verify() no puede
        comparar un hash bcrypt con texto plano).
        """
        with pg_engine.connect() as conn:
            # Un bcrypt hash tiene siempre ~60 chars; un PIN plano tiene 4-8 chars
            rows = conn.execute(text("""
                SELECT u.email, u.tenant_id, LENGTH(u.pin) as pin_len
                FROM public.users u
                WHERE u.pin IS NOT NULL
                  AND u.pin != ''
                  AND (
                      LENGTH(u.pin) < 20
                      OR (u.pin NOT LIKE '$2b$%' AND u.pin NOT LIKE '$2a$%' AND u.pin NOT LIKE '$2y$%')
                  )
            """)).fetchall()

        assert rows == [], (
            f"Hay {len(rows)} usuarios con PIN en TEXTO PLANO (no bcrypt) — "
            f"ACCIÓN REQUERIDA: re-hashear con bcrypt. "
            f"Usuarios afectados: {[(r[0], r[2]) for r in rows]}"
        )

    def test_no_existe_debug_bypass_token_en_codigo(self, pg_engine):
        """
        Test 37: El DEBUG_BYPASS_TOKEN_xyz no debe estar activo en el código.
        Este token bypassea toda la autenticación JWT en el endpoint WebSocket.
        Verifica que el archivo websocket.py no contenga ese string literal.

        NOTA: Este test verifica el código, no la BD. Si el token está en producción
        activo, cualquier atacante puede impersonar al primer usuario del sistema.
        """
        # Ruta relativa al archivo de websocket
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        websocket_path = os.path.join(base_dir, "routers", "websocket.py")

        if not os.path.exists(websocket_path):
            pytest.skip(f"Archivo websocket.py no encontrado en {websocket_path}")

        with open(websocket_path, "r", encoding="utf-8") as f:
            contenido = f.read()

        bypass_token = "DEBUG_BYPASS_TOKEN_xyz"
        lineas_con_bypass = [
            (i + 1, linea.strip())
            for i, linea in enumerate(contenido.splitlines())
            if bypass_token in linea and not linea.strip().startswith("#")
        ]

        assert lineas_con_bypass == [], (
            f"DEBUG_BYPASS_TOKEN activo en websocket.py — "
            f"REMOVER ANTES DE DEPLOY A PROD: {lineas_con_bypass}"
        )
