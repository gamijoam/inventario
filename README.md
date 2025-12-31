# Sistema de Gestión de Ferretería

Este es un sistema completo de punto de venta (POS) y gestión de inventario diseñado para ferreterías, desarrollado en Python utilizando PySide6 y QML para una interfaz moderna y fluida.

## 🚀 Características Principales

- **Punto de Venta (POS):** Interfaz optimizada para ventas rápidas, manejo de múltiples monedas (USD/Bs) y cálculo automático de vueltos.
- **Gestión de Inventario:** Control de stock, productos pesados (granel), ubicaciones y categorías.
- **Facturación:** Generación de recibos térmicos y control de impresoras.
- **Clientes:** Base de datos de clientes con historial de compras.
- **Reportes:** Exportación de datos y reportes de ventas (Excel/PDF).

## 🛠️ Tecnologías

- **Lenguaje:** Python 3.x
- **GUI:** PySide6 (Qt) + QML
- **Base de Datos:** SQLite (Local)
- **ORM:** SQLAlchemy
- **Reportes:** ReportLab, Pandas, OpenPyXL

## 📋 Requisitos Previos

Necesitas tener Python instalado. Se recomienda usar un entorno virtual.

```bash
# Crear entorno virtual
python -m venv venv

# Activar entorno (Windows)
.\venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

## ▶️ Ejecución

Para iniciar la aplicación principal:

```bash
python run.py
```

## 📂 Estructura del Proyecto

- `src/`: Código fuente principal (Controladores, Modelos, Vistas).
- `src/qml/`: Archivos de interfaz de usuario QML.
- `landing_page/`: Página web de presentación.
- `deployment/`: Scripts y configuraciones para compilar el ejecutable.
- `documentos/`: Guías y documentación adicional.

## ⚠️ Notas Importantes (Base de Datos)

El archivo de base de datos `ferreteria.db` **NO** se incluye en el repositorio por seguridad y para evitar conflictos. Al ejecutar la aplicación por primera vez, el sistema debería generar una nueva base de datos o deberás configurar una localmente.
