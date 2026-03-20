"""
test_func_config_pg.py — Tests funcionales de Configuración

Verifican que la tabla `business_config` persiste correctamente los datos.
Bug previo corregido: el endpoint update_business_info llamaba db.commit() después
de que el search_path se perdía, por lo que los cambios se guardaban en `public`
(que no tiene la tabla) en vez del schema del tenant. Fix: db.flush() antes del commit.

Flujos cubiertos:
  FC01 — Crear/actualizar una clave de configuración y leerla de vuelta
  FC02 — Actualización en batch (múltiples claves a la vez)
  FC03 — business_name y otras claves de info del negocio persisten
  FC04 — Clave inexistente devuelve valor vacío (no error 500)
  FC05 — Actualizar clave existente reemplaza el valor (no duplica)

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_config_pg.py -v --no-cov -s
"""

import pytest
import uuid
from sqlalchemy import text

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import BusinessConfig

TENANT = "lalicoreria"


@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


# ---------------------------------------------------------------------------
# FC01 — Crear y leer una clave de configuración
# ---------------------------------------------------------------------------

class TestFC01CrearLeerConfig:

    def test_crear_config_nueva_persiste(self, tenant_db):
        """
        FC01a: Guardar una clave nueva en business_config → leer → valor coincide.
        Este es el caso de uso básico del endpoint POST /config/{key}.
        """
        key = f"test_key_{uuid.uuid4().hex[:8]}"
        value = "valor_de_prueba_123"

        config = BusinessConfig(key=key, value=value)
        tenant_db.add(config)
        tenant_db.flush()

        # Leer de vuelta desde la misma sesión
        config_leido = tenant_db.query(BusinessConfig).get(key)
        assert config_leido is not None, f"La clave '{key}' no se encontró tras guardar"
        assert config_leido.value == value, (
            f"Valor esperado: '{value}', obtenido: '{config_leido.value}'"
        )

    def test_flush_preserva_search_path_del_tenant(self, tenant_db):
        """
        FC01b: Después de db.flush(), el search_path debe seguir apuntando
        al schema del tenant (no a 'public').
        Bug previo: update_business_info hacía db.commit() sin db.flush() previo;
        el search_path se perdía y los datos se guardaban en 'public' (sin la tabla).
        Fix: db.flush() antes de db.commit() preserva el contexto del schema.
        """
        key = f"test_sp_{uuid.uuid4().hex[:8]}"
        config = BusinessConfig(key=key, value="valor_schema_correcto")
        tenant_db.add(config)
        tenant_db.flush()  # ← el fix clave

        # Verificar que el search_path sigue siendo el del tenant
        current_path = tenant_db.execute(text("SHOW search_path")).scalar()
        assert TENANT in current_path, (
            f"search_path perdido tras flush(): '{current_path}'. "
            f"Debería contener '{TENANT}'. "
            "Esto indica que el bug del search_path persiste."
        )

        # Y el dato sigue accesible en el schema del tenant
        config_leido = tenant_db.query(BusinessConfig).filter_by(key=key).first()
        assert config_leido is not None, \
            "El dato no es accesible tras flush() — search_path perdido"
        assert config_leido.value == "valor_schema_correcto"

    def test_actualizar_config_existente(self, tenant_db):
        """
        FC01c: Actualizar una clave existente reemplaza el valor, no duplica.
        """
        key = f"test_upd_{uuid.uuid4().hex[:8]}"

        # Crear
        config = BusinessConfig(key=key, value="valor_inicial")
        tenant_db.add(config)
        tenant_db.flush()

        # Actualizar (misma lógica que el router)
        config_existente = tenant_db.query(BusinessConfig).get(key)
        config_existente.value = "valor_actualizado"
        tenant_db.flush()

        # Leer y verificar
        config_leido = tenant_db.query(BusinessConfig).get(key)
        assert config_leido.value == "valor_actualizado"

        # Verificar que solo hay UNA entrada con esa clave
        count = tenant_db.query(BusinessConfig).filter_by(key=key).count()
        assert count == 1, f"Hay {count} entradas para la clave '{key}', debería haber 1"


# ---------------------------------------------------------------------------
# FC02 — Actualización en batch
# ---------------------------------------------------------------------------

class TestFC02BatchConfig:

    def test_batch_guarda_multiples_claves(self, tenant_db):
        """
        FC02a: El endpoint PATCH /config/batch guarda N claves en una sola operación.
        """
        prefix = uuid.uuid4().hex[:8]
        batch = {
            f"batch_key_a_{prefix}": "valor_a",
            f"batch_key_b_{prefix}": "valor_b",
            f"batch_key_c_{prefix}": "valor_c",
        }

        # Replicar lógica del router set_configs_batch
        for key, value in batch.items():
            config = tenant_db.query(BusinessConfig).get(key)
            if not config:
                config = BusinessConfig(key=key, value=str(value))
                tenant_db.add(config)
            else:
                config.value = str(value)

        tenant_db.flush()

        # Verificar que todas quedaron guardadas
        for key, expected_value in batch.items():
            config = tenant_db.query(BusinessConfig).get(key)
            assert config is not None, f"Clave '{key}' no guardada en batch"
            assert config.value == expected_value

    def test_batch_actualiza_existentes_y_crea_nuevas(self, tenant_db):
        """
        FC02b: Si algunas claves ya existen, deben actualizarse (no duplicarse).
        Si son nuevas, deben crearse.
        """
        prefix = uuid.uuid4().hex[:8]
        key_existente = f"cfg_exist_{prefix}"
        key_nueva = f"cfg_new_{prefix}"

        # Crear la clave existente antes del batch
        tenant_db.add(BusinessConfig(key=key_existente, value="valor_viejo"))
        tenant_db.flush()

        # Ejecutar batch con ambas
        batch = {key_existente: "valor_nuevo", key_nueva: "valor_creado"}
        for key, value in batch.items():
            config = tenant_db.query(BusinessConfig).get(key)
            if not config:
                config = BusinessConfig(key=key, value=str(value))
                tenant_db.add(config)
            else:
                config.value = str(value)
        tenant_db.flush()

        # Verificar
        assert tenant_db.query(BusinessConfig).get(key_existente).value == "valor_nuevo"
        assert tenant_db.query(BusinessConfig).get(key_nueva).value == "valor_creado"

        # No debe haber duplicados
        count_existente = tenant_db.query(BusinessConfig).filter_by(key=key_existente).count()
        assert count_existente == 1, f"Duplicado en '{key_existente}'"


# ---------------------------------------------------------------------------
# FC03 — Claves específicas de business info
# ---------------------------------------------------------------------------

class TestFC03BusinessInfo:

    def test_business_name_se_guarda_y_lee(self, tenant_db):
        """
        FC03a: La clave 'business_name' (usada en tickets y reportes) debe persistir.
        """
        nombre_nuevo = f"Negocio Test {uuid.uuid4().hex[:6]}"

        # Upsert (misma lógica que update_business_info)
        config = tenant_db.query(BusinessConfig).get("business_name")
        if not config:
            config = BusinessConfig(key="business_name", value=nombre_nuevo)
            tenant_db.add(config)
        else:
            config.value = nombre_nuevo
        tenant_db.flush()

        # Leer como hace get_business_info
        leido = tenant_db.query(BusinessConfig).filter(
            BusinessConfig.key == "business_name"
        ).first()
        assert leido is not None
        assert leido.value == nombre_nuevo

    def test_default_tax_rate_acepta_decimales(self, tenant_db):
        """
        FC03b: La tasa de impuesto por defecto debe poder guardarse como Decimal/string.
        """
        prefix = uuid.uuid4().hex[:8]
        key = f"default_tax_rate_{prefix}"
        value = "16.00"

        config = BusinessConfig(key=key, value=value)
        tenant_db.add(config)
        tenant_db.flush()

        leido = tenant_db.query(BusinessConfig).get(key)
        assert leido.value == "16.00"
        # Verificar que se puede convertir a Decimal (como hace el router)
        from decimal import Decimal
        assert Decimal(leido.value) == Decimal("16.00")

    def test_todas_las_claves_de_business_info(self, tenant_db):
        """
        FC03c: Las 7 claves que componen BusinessInfo deben poder escribirse y leerse.
        """
        prefix = uuid.uuid4().hex[:8]
        claves = {
            f"business_name_{prefix}": "Ferretería Test",
            f"business_doc_{prefix}": "J-12345678-9",
            f"business_address_{prefix}": "Calle 1, Local 2",
            f"business_phone_{prefix}": "+58 412-1234567",
            f"business_email_{prefix}": "test@empresa.com",
            f"default_tax_rate_{prefix}": "16.00",
        }

        for key, value in claves.items():
            c = BusinessConfig(key=key, value=value)
            tenant_db.add(c)
        tenant_db.flush()

        for key, expected in claves.items():
            found = tenant_db.query(BusinessConfig).get(key)
            assert found is not None, f"Clave '{key}' no guardada"
            assert found.value == expected


# ---------------------------------------------------------------------------
# FC04 — Clave inexistente no rompe el sistema
# ---------------------------------------------------------------------------

class TestFC04ClaveInexistente:

    def test_query_clave_inexistente_retorna_none(self, tenant_db):
        """
        FC04: Buscar una clave que no existe retorna None (no lanza excepción).
        El router maneja esto creando un BusinessConfig con value="" en lugar de fallar.
        """
        key_no_existente = f"key_que_no_existe_{uuid.uuid4().hex[:12]}"
        result = tenant_db.query(BusinessConfig).get(key_no_existente)
        assert result is None, \
            "Una clave inexistente debería retornar None, no lanzar excepción"

    def test_get_business_info_con_claves_faltantes(self, tenant_db):
        """
        FC04b: get_business_info debe funcionar aunque no existan todas las claves.
        El router usa .get() con defaults vacíos para claves que no están en BD.
        """
        # Simular lo que hace get_business_info cuando no hay datos
        keys = ["business_name", "business_doc", "business_address"]
        configs = tenant_db.query(BusinessConfig).filter(
            BusinessConfig.key.in_(keys)
        ).all()
        config_dict = {c.key: c.value for c in configs}

        # Las claves faltantes deben resolverse con el default (sin KeyError)
        business_name = config_dict.get("business_name", "")
        business_doc = config_dict.get("business_doc", "")

        assert isinstance(business_name, str)
        assert isinstance(business_doc, str)


# ---------------------------------------------------------------------------
# FC05 — Valor vacío y valores especiales
# ---------------------------------------------------------------------------

class TestFC05ValoresEspeciales:

    def test_guardar_valor_vacio(self, tenant_db):
        """
        FC05a: Una configuración puede tener value="" (cadena vacía).
        No debe almacenarse como NULL.
        """
        key = f"empty_val_{uuid.uuid4().hex[:8]}"
        config = BusinessConfig(key=key, value="")
        tenant_db.add(config)
        tenant_db.flush()

        leido = tenant_db.query(BusinessConfig).get(key)
        assert leido is not None
        assert leido.value == "", "El valor vacío debe guardarse como '' no como NULL"

    def test_guardar_template_largo(self, tenant_db):
        """
        FC05b: El ticket_template puede ser un string largo (Text type en modelo).
        """
        key = f"ticket_template_{uuid.uuid4().hex[:8]}"
        template = """
        === {{business_name}} ===
        Fecha: {{date}}
        Cajero: {{user}}
        -------------------------
        {% for item in items %}
        {{item.name}}: ${{item.price}}
        {% endfor %}
        -------------------------
        TOTAL: ${{total}}
        ¡Gracias por su compra!
        """.strip()

        config = BusinessConfig(key=key, value=template)
        tenant_db.add(config)
        tenant_db.flush()

        leido = tenant_db.query(BusinessConfig).get(key)
        assert leido.value == template
        assert len(leido.value) > 100, "El template largo debe persistir completo"
