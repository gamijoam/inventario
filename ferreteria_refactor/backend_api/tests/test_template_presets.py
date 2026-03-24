"""
test_template_presets.py — Tests de regresión de templates térmicos

Flujos cubiertos:
  TPL01 — Templates de recepción de servicio técnico (58mm y 80mm):
           a) No truncan warranty.description con string.slice
           b) Contienen sección de firma completa (Nombre, C.I./RIF, Firma, Fecha)
           c) Texto de aceptación presente

  TPL02 — Templates de venta de servicios (58mm y 80mm):
           a) No truncan warranty.description con string.slice

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_template_presets.py -v --no-cov -s
"""

import pytest
import sys
import os

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.template_presets import (
    get_service_repair_58_template,
    get_service_repair_80_template,
    get_services_sale_58_template,
    get_services_sale_80_template,
)


# ---------------------------------------------------------------------------
# TPL01 — Templates de recepción/reparación de servicio técnico
# ---------------------------------------------------------------------------

class TestTPL01ServiceRepairTemplates:
    """
    Regresión: los templates de recepción de servicio (repair) deben mostrar
    el texto completo de garantía y tener sección de firma para el cliente.
    """

    @pytest.fixture(autouse=True)
    def load_templates(self):
        self.tpl_58 = get_service_repair_58_template()
        self.tpl_80 = get_service_repair_80_template()
        self.templates = {"58mm": self.tpl_58, "80mm": self.tpl_80}

    # --- Sin truncación ---

    def test_58mm_no_trunca_warranty_description(self):
        """TPL01a-58: El template 58mm NO debe usar string.slice en warranty.description."""
        assert "warranty.description | string.slice" not in self.tpl_58, (
            "El template 58mm sigue truncando warranty.description. "
            "El cliente necesita el texto completo para firmar el contrato."
        )

    def test_80mm_no_trunca_warranty_description(self):
        """TPL01a-80: El template 80mm NO debe usar string.slice en warranty.description."""
        assert "warranty.description | string.slice" not in self.tpl_80, (
            "El template 80mm sigue truncando warranty.description. "
            "El cliente necesita el texto completo para firmar el contrato."
        )

    # --- Sección de firma ---

    def test_58mm_contiene_campo_nombre(self):
        """TPL01b-58: El template 58mm debe tener campo 'Nombre:' para identificación."""
        assert "Nombre:" in self.tpl_58, "Template 58mm no tiene campo 'Nombre:' en sección de firma."

    def test_80mm_contiene_campo_nombre(self):
        """TPL01b-80: El template 80mm debe tener campo 'Nombre:' para identificación."""
        assert "Nombre:" in self.tpl_80, "Template 80mm no tiene campo 'Nombre:' en sección de firma."

    def test_58mm_contiene_campo_firma(self):
        """TPL01c-58: El template 58mm debe tener campo 'Firma:' para la rúbrica."""
        assert "Firma:" in self.tpl_58, "Template 58mm no tiene campo 'Firma:' en sección de firma."

    def test_80mm_contiene_campo_firma(self):
        """TPL01c-80: El template 80mm debe tener campo 'Firma:' para la rúbrica."""
        assert "Firma:" in self.tpl_80, "Template 80mm no tiene campo 'Firma:' en sección de firma."

    def test_58mm_contiene_campo_fecha(self):
        """TPL01d-58: El template 58mm debe tener campo 'Fecha:' en la sección de firma."""
        assert "Fecha:" in self.tpl_58, "Template 58mm no tiene campo 'Fecha:' en sección de firma."

    def test_80mm_contiene_campo_fecha(self):
        """TPL01d-80: El template 80mm debe tener campo 'Fecha:' en la sección de firma."""
        assert "Fecha:" in self.tpl_80, "Template 80mm no tiene campo 'Fecha:' en sección de firma."

    def test_58mm_contiene_campo_ci_rif(self):
        """TPL01e-58: El template 58mm debe tener campo C.I./RIF para identificación legal."""
        assert "C.I." in self.tpl_58 or "RIF" in self.tpl_58, (
            "Template 58mm no tiene campo C.I./RIF en sección de firma."
        )

    def test_80mm_contiene_campo_ci_rif(self):
        """TPL01e-80: El template 80mm debe tener campo C.I./RIF para identificación legal."""
        assert "C.I." in self.tpl_80 or "RIF" in self.tpl_80, (
            "Template 80mm no tiene campo C.I./RIF en sección de firma."
        )

    def test_58mm_espacio_para_escribir(self):
        """TPL01f-58: El template 58mm debe tener guiones bajos visibles para escribir."""
        assert "___" in self.tpl_58, (
            "Template 58mm no tiene guiones bajos en los campos de firma. "
            "El cliente necesita espacio visible para escribir."
        )

    def test_80mm_espacio_para_escribir(self):
        """TPL01f-80: El template 80mm debe tener guiones bajos visibles para escribir."""
        assert "___" in self.tpl_80, (
            "Template 80mm no tiene guiones bajos en los campos de firma. "
            "El cliente necesita espacio visible para escribir."
        )

    def test_58mm_mensaje_aceptacion(self):
        """TPL01g-58: El template 58mm debe indicar que la firma implica aceptación de condiciones."""
        body_lower = self.tpl_58.lower()
        assert "acepta" in body_lower or "acept" in body_lower, (
            "Template 58mm no tiene texto de aceptación. "
            "Se necesita para validez del contrato de recepción."
        )

    def test_80mm_mensaje_aceptacion(self):
        """TPL01g-80: El template 80mm debe indicar que la firma implica aceptación de condiciones."""
        body_lower = self.tpl_80.lower()
        assert "acepta" in body_lower or "acept" in body_lower, (
            "Template 80mm no tiene texto de aceptación. "
            "Se necesita para validez del contrato de recepción."
        )

    def test_templates_no_estan_vacios(self):
        """TPL01h: Ambos templates deben tener contenido sustancial (>200 chars)."""
        assert len(self.tpl_58) > 200, "Template 58mm parece vacío o incompleto."
        assert len(self.tpl_80) > 200, "Template 80mm parece vacío o incompleto."


# ---------------------------------------------------------------------------
# TPL02 — Templates de venta de servicios (no confundir con recepción)
# ---------------------------------------------------------------------------

class TestTPL02ServicesSaleTemplates:
    """
    Regresión: los templates de venta de servicios también tienen campo
    de garantía — verificar que no se trunca.
    """

    @pytest.fixture(autouse=True)
    def load_templates(self):
        self.tpl_58 = get_services_sale_58_template()
        self.tpl_80 = get_services_sale_80_template()

    def test_58mm_venta_no_trunca_warranty_description(self):
        """TPL02a-58: Template de venta 58mm no debe truncar warranty.description."""
        assert "warranty.description | string.slice" not in self.tpl_58

    def test_80mm_venta_no_trunca_warranty_description(self):
        """TPL02a-80: Template de venta 80mm no debe truncar warranty.description."""
        assert "warranty.description | string.slice" not in self.tpl_80

    def test_templates_venta_no_vacios(self):
        """TPL02b: Los templates de venta de servicio deben tener contenido."""
        assert len(self.tpl_58) > 100, "Template de venta 58mm parece vacío."
        assert len(self.tpl_80) > 100, "Template de venta 80mm parece vacío."
