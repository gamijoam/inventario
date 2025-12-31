# Hardware Bridge - Guía de Configuración

## Configuración Multi-Cliente con config.ini

El Hardware Bridge ahora utiliza un archivo `config.ini` para la configuración, lo que permite distribuir un **único ejecutable** a múltiples clientes SaaS.

---

## Archivo config.ini

El archivo `config.ini` se crea automáticamente en la misma carpeta que `BridgeInvensoft.exe` la primera vez que se ejecuta.

### Estructura

```ini
[SERVIDOR]
url_servidor = wss://demo.invensoft.lat
nombre_caja = caja-1

[IMPRESORA]
modo = VIRTUAL
nombre = POS-58
```

### Parámetros

#### Sección [SERVIDOR]

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `url_servidor` | URL WebSocket del servidor SaaS | `wss://cliente1.invensoft.lat` |
| `nombre_caja` | Identificador único de la caja | `caja-1`, `caja-principal` |

**Importante:** 
- Usar `wss://` para sitios HTTPS (producción)
- Usar `ws://` solo para desarrollo local
- El `nombre_caja` debe coincidir con `HARDWARE_CLIENT_ID` en el frontend

#### Sección [IMPRESORA]

| Parámetro | Descripción | Valores |
|-----------|-------------|---------|
| `modo` | Modo de impresión | `WINDOWS`, `VIRTUAL`, `USB` |
| `nombre` | Nombre de la impresora en Windows | `POS-58`, `EPSON TM-T20II` |

---

## Flujo de Configuración

### Primera Ejecución

1. Usuario ejecuta `BridgeInvensoft.exe`
2. El programa detecta que no existe `config.ini`
3. Crea `config.ini` con valores por defecto
4. Muestra mensaje:
   ```
   ⚠️  CONFIGURACIÓN INICIAL CREADA
   Se ha creado el archivo: C:\...\config.ini
   
   Por favor, edite el archivo config.ini con los datos correctos:
     - url_servidor: URL de su servidor (ej: wss://cliente1.invensoft.lat)
     - nombre_caja: Identificador único de esta caja (ej: caja-1)
   
   Luego, reinicie el programa.
   
   Presione ENTER para salir...
   ```
5. Usuario edita `config.ini` con sus datos
6. Usuario reinicia el programa

### Ejecuciones Posteriores

El programa lee `config.ini` y se conecta automáticamente.

---

## Distribución a Clientes

### Paso 1: Compilar Ejecutable

```bash
cd hardware_bridge
.\build_exe.bat
```

Esto genera: `dist\BridgeInvensoft.exe`

### Paso 2: Preparar Paquete

Crear carpeta con:
```
BridgeInvensoft/
├── BridgeInvensoft.exe
└── INSTRUCCIONES.txt
```

**INSTRUCCIONES.txt:**
```
HARDWARE BRIDGE - INSTRUCCIONES DE INSTALACIÓN

1. Ejecute BridgeInvensoft.exe
2. Se creará automáticamente el archivo config.ini
3. Edite config.ini con los datos de su empresa:
   - url_servidor: wss://suempresa.invensoft.lat
   - nombre_caja: caja-1 (o el nombre que prefiera)
4. Reinicie BridgeInvensoft.exe
5. Verifique que aparezca "✅ Connected to VPS"

SOPORTE: soporte@invensoft.lat
```

### Paso 3: Distribuir

- Enviar carpeta comprimida (ZIP) al cliente
- Cliente descomprime en cualquier ubicación
- Cliente ejecuta y configura

---

## Ejemplos de Configuración

### Cliente 1: Ferretería El Tornillo
```ini
[SERVIDOR]
url_servidor = wss://eltornillo.invensoft.lat
nombre_caja = caja-principal

[IMPRESORA]
modo = WINDOWS
nombre = EPSON TM-T20II Receipt
```

### Cliente 2: Supermercado La Esquina
```ini
[SERVIDOR]
url_servidor = wss://laesquina.invensoft.lat
nombre_caja = caja-1

[IMPRESORA]
modo = WINDOWS
nombre = POS-58
```

### Cliente 3: Demo/Pruebas
```ini
[SERVIDOR]
url_servidor = wss://demo.invensoft.lat
nombre_caja = caja-demo

[IMPRESORA]
modo = VIRTUAL
nombre = POS-58
```

---

## Validación de Configuración

El programa valida automáticamente:

1. **Archivo existe:** Si no, lo crea
2. **Secciones completas:** Si faltan, recrea el archivo
3. **Valores válidos:** Usa defaults si están vacíos

### Errores Comunes

#### Error: "config.ini está incompleto o corrupto"
**Solución:** El programa elimina el archivo corrupto y crea uno nuevo automáticamente.

#### Error: "WebSocket error: Invalid URL"
**Solución:** Verificar que `url_servidor` tenga formato correcto (`wss://` o `ws://`)

#### Error: "Hardware Bridge no está conectado"
**Solución:** 
1. Verificar que `BridgeInvensoft.exe` esté ejecutándose
2. Verificar que `nombre_caja` coincida con el frontend
3. Verificar conectividad a internet

---

## Ventajas del Sistema config.ini

✅ **Un solo ejecutable** para todos los clientes  
✅ **Sin recompilación** para cambiar configuración  
✅ **Fácil de editar** con Notepad  
✅ **Auto-creación** de archivo por defecto  
✅ **Validación automática** de configuración  
✅ **Portable** - funciona desde cualquier carpeta  

---

## Migración desde .env

Si tienes clientes usando la versión anterior con `.env`:

1. Eliminar archivo `.env`
2. Ejecutar nuevo `BridgeInvensoft.exe`
3. Editar `config.ini` con los valores del antiguo `.env`:
   - `VPS_URL` → `url_servidor`
   - `CLIENT_ID` → `nombre_caja`
   - `PRINTER_MODE` → `modo`
   - `PRINTER_NAME` → `nombre`

---

## Soporte Técnico

Para problemas de configuración:
1. Verificar que `config.ini` esté en la misma carpeta que el `.exe`
2. Revisar `bridge_debug.log` si existe
3. Contactar soporte con captura de pantalla del error
