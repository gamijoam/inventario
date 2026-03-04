# Generar íconos

Una vez instalado Rust, generar los íconos desde el logo del proyecto:

```bash
# Desde ferreteria_refactor/frontend_web/
# Usa un PNG cuadrado de al menos 1024x1024 px

npm run tauri:icon -- /ruta/al/logo.png
```

Esto genera automáticamente todos los tamaños requeridos en esta carpeta:
- 32x32.png
- 128x128.png
- 128x128@2x.png
- icon.icns (macOS)
- icon.ico (Windows)

Hasta que se generen, `npm run tauri:build` fallará con "icon not found".
Puedes usar el logo existente en `ferreteria_refactor/media/` si existe.
