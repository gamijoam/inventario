# 11 - Manual de Desarrollo Local (Setup Guide)

Guía para desarrolladores que deseen montar el ecosistema de **Mi Inventario Fácil** en sus máquinas locales para realizar pruebas o extender funcionalidades.

## 1. Requisitos Previos

*   **Python 3.12+**: Motor para el backend.
*   **Node.js 18+ & NPM**: Para el frontend (Vite).
*   **PostgreSQL 15+**: Motor de base de datos local.
*   **Git**: Para control de versiones.

## 2. Configuración del Backend (`backend_api`)

1.  **Clonar y Entrar**:
    ```bash
    cd backend_api
    ```
2.  **Entorno Virtual**:
    ```bash
    python -m venv venv
    source venv/bin/activate  # Windows: .\venv\Scripts\activate
    ```
3.  **Instalar Dependencias**:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Variables de Entorno**:
    Crear un archivo `.env` basado en `.env.example`:
    ```env
    DATABASE_URL=postgresql://postgres:pass@localhost:5432/inventario_db
    SECRET_KEY=dev_secret_key
    ENVIRONMENT=development
    ```
5.  **Migraciones Iniciales**:
    ```bash
    alembic upgrade head
    ```
6.  **Arranque**:
    ```bash
    uvicorn main:app --reload --port 8000
    ```

## 3. Configuración del Frontend (`frontend_web`)

1.  **Entrar e Instalar**:
    ```bash
    cd frontend_web
    npm install
    ```
2.  **Configuración de API**:
    Asegúrate de que el archivo `src/config/axios.js` apunte a `http://localhost:8000/api/v1`.
3.  **Arranque**:
    ```bash
    npm run dev -- --port 3000
    ```

## 4. Desarrollo con Multi-Tenancy Local

Para probar subdominios en localhost:
1.  Edita tu archivo `hosts` (C:\Windows\System32\drivers\etc\hosts):
    ```text
    127.0.0.1 demo.localhost
    127.0.0.1 ferreteria.localhost
    ```
2.  Accede a `http://demo.localhost:3000`. El sistema detectará `demo` como el slug de la empresa.

## 5. Simulación de Hardware (Bridge)

Si no tienes una impresora térmica física:
*   El Bridge C# puede configurarse para usar una impresora de "Microsoft Print to PDF" o un driver genérico de texto.
*   Los logs del Bridge en modo desarrollo se pueden visualizar ejecutando la aplicación desde Visual Studio o revisando la consola de salida.

## 6. Scripts de Utilidad

*   `init_dev_data.py`: Crea un tenant de prueba (`demo`), un usuario administrador y productos iniciales para no empezar desde cero.
*   `test_ws.py`: Script simple en Python para probar la conectividad de WebSockets sin usar el Bridge real.
