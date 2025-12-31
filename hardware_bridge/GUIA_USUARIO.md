# Guía de Configuración Multi-Caja

## Para Usuarios Finales

### Configuración Inicial (Una vez por PC)

#### Paso 1: Instalar Hardware Bridge

1. Copie `BridgeInvensoft.exe` a una carpeta en la PC
2. Ejecute `BridgeInvensoft.exe`
3. Se creará automáticamente `config.ini`
4. Cierre el programa

#### Paso 2: Configurar Hardware Bridge

Edite `config.ini` con Notepad:

```ini
[SERVIDOR]
url_servidor = wss://suempresa.invensoft.lat
nombre_caja = caja-principal  ◄── IMPORTANTE: Anote este nombre
```

**Ejemplos de nombres:**
- PC de caja principal: `caja-principal`
- PC de caja 2: `caja-2`
- PC de escritorio: `escritorio-ventas`

#### Paso 3: Iniciar Hardware Bridge

1. Ejecute `BridgeInvensoft.exe`
2. Verifique que diga: `✅ Connected to VPS as caja-principal`
3. Minimice la ventana (déjela ejecutándose)

#### Paso 4: Configurar Navegador

1. Abra la página web del sistema
2. Intente imprimir un ticket
3. Aparecerá un cuadro pidiendo el ID de la caja
4. **Escriba EXACTAMENTE el mismo nombre** que puso en `config.ini`
   - Ejemplo: `caja-principal`
5. Click en Aceptar

✅ **Listo!** El navegador recordará esta configuración.

---

## Múltiples Cajas en el Mismo Cliente

### Ejemplo: Ferretería con 3 Cajas

#### PC 1 - Caja Principal
**config.ini:**
```ini
nombre_caja = caja-principal
```
**Navegador:** Escribir `caja-principal` cuando pregunte

#### PC 2 - Caja 2
**config.ini:**
```ini
nombre_caja = caja-2
```
**Navegador:** Escribir `caja-2` cuando pregunte

#### PC 3 - Caja 3
**config.ini:**
```ini
nombre_caja = caja-3
```
**Navegador:** Escribir `caja-3` cuando pregunte

---

## Solución de Problemas

### Error: "Hardware Bridge no está conectado"

**Causas comunes:**

1. **Hardware Bridge no está ejecutándose**
   - Solución: Ejecute `BridgeInvensoft.exe`

2. **Los nombres NO coinciden**
   - En `config.ini`: `nombre_caja = caja-principal`
   - En navegador: Configurado como `caja-2`
   - Solución: Deben ser idénticos

3. **Configuración incorrecta en navegador**
   - Solución: Abrir consola del navegador (F12)
   - Escribir: `resetPrinterConfig()`
   - Presionar Enter
   - Recargar la página
   - Configurar nuevamente con el nombre correcto

### Verificar Configuración Actual

1. Abrir consola del navegador (F12)
2. Buscar mensaje: `🖨️ Hardware Bridge Client ID: caja-principal`
3. Verificar que coincida con `config.ini`

### Cambiar Configuración

Si necesita cambiar el ID configurado en el navegador:

1. Abrir consola del navegador (F12)
2. Escribir: `resetPrinterConfig()`
3. Presionar Enter
4. Recargar la página (F5)
5. Configurar nuevamente con el nombre correcto

---

## Checklist de Instalación

- [ ] Hardware Bridge instalado en la PC
- [ ] `config.ini` editado con `nombre_caja` único
- [ ] `BridgeInvensoft.exe` ejecutándose
- [ ] Mensaje "✅ Connected to VPS" visible
- [ ] Navegador configurado con el MISMO `nombre_caja`
- [ ] Prueba de impresión exitosa

---

## Notas Importantes

⚠️ **Los nombres DEBEN coincidir exactamente:**
- Mayúsculas/minúsculas importan
- Espacios importan
- Caracteres especiales importan

✅ **Recomendaciones:**
- Use nombres simples: `caja-1`, `caja-2`, etc.
- Evite espacios: Use guiones `-` en lugar de espacios
- Use solo letras, números y guiones

❌ **Evite:**
- Nombres con espacios: `caja principal`
- Caracteres especiales: `caja#1`, `caja@principal`
- Nombres muy largos

---

## Soporte

Si después de seguir estos pasos aún tiene problemas:

1. Tome captura de pantalla del Hardware Bridge
2. Tome captura de pantalla del error en el navegador
3. Envíe ambas capturas a soporte técnico
