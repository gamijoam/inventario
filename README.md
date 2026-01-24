# Sistema de Gestión de Ferretería (Refactor)

Este repositorio contiene el código fuente del sistema de gestión para ferreterías, refactorizado para separar el Backend (Python/FastAPI) y el Frontend (React/Vite).

## 📋 Requisitos Previos

Para ejecutar este proyecto necesitas tener instalado:

*   **Python 3.10+**: Para el backend.
*   **Node.js 18+ y npm**: Para el frontend.
*   **Git**: Para el control de versiones.

## 🚀 Instalación y Configuración

Sigue estos pasos para configurar el entorno de desarrollo desde cero.

### 1. Backend (API Python)

El backend maneja la lógica de negocio y la base de datos.

1.  Abre una terminal en la carpeta raíz del proyecto (`ferreteria/`).
2.  (Opcional pero recomendado) Crea y activa un entorno virtual:
    ```bash
    python -m venv venv
    # En Windows:
    .\venv\Scripts\activate
    # En macOS/Linux:
    source venv/bin/activate
    ```
3.  Instala las dependencias:
    ```bash
    pip install -r requirements.txt
    ```
4.  El backend está listo para ejecutarse.

### 2. Frontend (Interfaz Web)

El frontend es una aplicación React ubicada en `ferreteria_refactor/frontend_web`.

1.  Navega a la carpeta del frontend:
    ```bash
    cd ferreteria_refactor/frontend_web
    ```
2.  Instala las dependencias de Node.js:
    ```bash
    npm install
    ```

## ▶️ Ejecución del Proyecto

Necesitarás dos terminales abiertas para correr el sistema completo (una para backend y otra para frontend).

### Terminal 1: Iniciar Backend

Desde la carpeta raíz del proyecto:

```bash
# Asegúrate de tener el entorno virtual activado si creaste uno
python run_backend.py
```

El servidor API iniciará generalmente en `http://localhost:8000` (o `0.0.0.0:8000`).

### Terminal 2: Iniciar Frontend

Desde la carpeta `ferreteria_refactor/frontend_web`:

```bash
npm run dev
```

La aplicación web estará disponible en la URL que indique Vite (usualmente `http://localhost:5173`).

## 📦 Estructura de Carpetas

*   `ferreteria_refactor/backend_api`: Código fuente de la API (FastAPI).
*   `ferreteria_refactor/frontend_web`: Código fuente del Frontend (React).
*   `run_backend.py`: Script de entrada para iniciar el servidor backend.
*   `requirements.txt`: Lista de dependencias de Python.

## ⚠️ Notas Adicionales

*   **Base de Datos**: El sistema utiliza SQLite por defecto. El archivo de base de datos se creará/buscará automáticamente según la configuración en `backend_api`.
*   **Variables de Entorno**: Revisa si existen archivos `.env.example` para configurar variables de entorno necesarias.

## 🧺 Módulo de Lavandería (Nuevo)

El sistema ahora cuenta con un módulo de lavandería inteligente:
*   **Gestión de Unidades**: Soporte para servicios por *Pieza* (ej. Planchado) y por *Peso* (ej. Lavado).
*   **Cobro Automático**: El sistema detecta el tipo de servicio y calcula el total basándose en el peso de la orden o la cantidad de piezas, según corresponda.
*   **Configuración**: Desde el inventario puedes marcar productos como `Servicio (Por Pieza)` o `Servicio (Por Peso)`.

## 🛠️ Módulo de Taller y Reparaciones (Celulares)

Diseñado para servicios técnicos y reparación de equipos:
*   **Recepción Detallada**: Registro de IMEI/Serial, Marca, Modelo y estado físico.
*   **Seguridad**: Campo para registrar el **Patrón de Desbloqueo** o PIN del dispositivo.
*   **Flujo de Estado**: Seguimiento desde Recepción -> Diagnóstico -> Reparación -> Entrega.
*   **Diagnóstico**: Espacio para notas técnicas y presupuesto.

## 🍽️ Módulo de Restaurante (Beta)

*En desarrollo activo.* Este módulo ofrece:
*   **Mapa de Mesas**: Visualización gráfica del estado de las mesas (Libre, Ocupada, Pagando).
*   **Comandera Móvil**: Interfaz ligera para que los meseros tomen pedidos desde el celular.
*   **Pantalla de Cocina**: Vista en tiempo real para que los cocineros reciban las órdenes.

## 🐳 Despliegue con Docker

Para desplegar usando la imagen oficial `gamijoam/ferreteria-saas`, utiliza las variables de entorno para activar/desactivar módulos. No es necesario reconstruir la imagen.

**Ejemplo de configuración (docker-compose.yml):**

```yaml
services:
  app:
    image: gamijoam/ferreteria-saas:latest
    environment:
      # Feature Flags (Controlan qué módulos ve el usuario)
      - MODULE_LAUNDRY_ENABLED=true
      - MODULE_RESTAURANT_ENABLED=false
      - MODULE_SERVICES_ENABLED=true
      # ... base de datos y secretos ...
```
