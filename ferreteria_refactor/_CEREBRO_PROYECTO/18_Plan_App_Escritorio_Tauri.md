# 18 — Plan: App de Escritorio con Tauri

> **Estado:** Fase 1 + Backend local COMPLETADOS ✅ | Fase 2 en progreso
> **Actualizado:** 2026-03-05 (antes: 2026-03-04)
> **Branch:** `feature/tauri-desktop`
> **Ver también:** `19_Sistema_Licencias.md`

---

## 1. Contexto y Motivación

La aplicación actualmente es 100% web (SaaS). Varios clientes POS necesitan:

- Una experiencia de **app instalada** (no depender del navegador)
- **Auto-inicio** al encender la máquina
- **Integración con impresoras** sin depender del Windows Bridge separado
- **Modo kiosk** (pantalla completa, sin barra del navegador)
- **Actualizaciones automáticas** silenciosas
- Funcionamiento con **internet inestable** (offline parcial futuro)

---

## 2. Tecnología Elegida: Tauri

### Por qué Tauri y no Electron

| Criterio | Tauri | Electron |
|----------|-------|----------|
| Bundle size | ~15 MB | ~150 MB |
| RAM en reposo | ~50 MB | ~200 MB+ |
| Renderer | WebView2 del sistema (Edge) | Chromium empaquetado |
| Integración con Vite | ✅ Nativa | ✅ Compatible |
| Auto-updater | ✅ Plugin oficial | ✅ electron-updater |
| Impresoras nativas | ✅ Rust crates (ESC/POS) | ⚠️ Node serial port |
| Target POS (low-end) | ✅ Perfecto | ❌ Muy pesado |
| Curva de aprendizaje | Rust básico para partes nativas | Solo JS |

**Decisión:** Tauri. Las máquinas POS son frecuentemente low-end (4–8 GB RAM).
WebView2 ya viene instalado en Windows 10/11 (no se empaqueta).

### Stack resultante — Arquitectura LOCAL con PostgreSQL

```
Invensoft.exe (instalador NSIS)
  ├── invensoft.exe              ← Tauri + WebView2 (UI React)
  ├── invensoft-backend.exe      ← FastAPI sidecar (PyInstaller)
  │     └── usa backend_api (sin cambios) con config de desktop
  ├── pgsql/                     ← PostgreSQL 15 portable
  │     ├── bin/postgres.exe
  │     └── data/                ← datos del cliente (local)
  └── AppData/Local/Invensoft/
        ├── license.lic          ← licencia activada
        └── secret.key           ← JWT signing key persistente

Flujo de arranque:
  Tauri inicia
    → lib.rs lanza invensoft-backend.exe (sidecar)
    → backend detecta PostgreSQL, crea schema, corre migraciones
    → React carga → IS_TAURI=true → verifica licencia en localStorage
    → Sin licencia → LicenseActivation screen
    → Licencia válida → Login → Dashboard (todo local, offline)

Axios en Tauri:
  baseURL = http://127.0.0.1:8000/api/v1/   ← backend local
  X-Tenant-ID = desktop_local                ← fijo, sin subdomain
```

**Por qué PostgreSQL local y no SQLite:**
- Cero cambios en los modelos/queries existentes
- Schemas, JSONB, arrays — todo soportado nativamente
- Si el cliente crece, migración a SaaS es PostgreSQL → PostgreSQL
- Posibilita multi-PC en LAN (varios equipos comparten la misma DB local)

**Carpeta `desktop_backend/`:**
- No duplica código — importa `backend_api` directamente
- Solo sobreescribe: config (URL local), middleware (tenant fijo), startup (init DB)
- `run.py` es el entry point compilado con PyInstaller

---

## 3. Impacto en la arquitectura actual

```
ANTES:
  Navegador web       → API en la nube
  Windows Bridge.exe  → Impresora ESC/POS (protocolo WebSocket custom)

DESPUÉS (Fase 3+):
  Invensoft.exe (Tauri)
    ├── UI React        → API en la nube
    └── Rust nativo     → Impresora ESC/POS (directo, sin bridge)

  Capacitor (Android/iOS) → sin cambios
  Acceso web normal       → sin cambios
```

---

## 4. Plan de Implementación por Fases

### Fase 1 — Wrapper básico funcional ✅ COMPLETADO
**Estimado:** 1–2 días
**Objetivo:** Generar un `.exe` instalable que cargue la app web.

**Tareas:**
- [x] Instalar Tauri CLI y dependencias Rust en el proyecto Vite
- [x] Crear `src-tauri/` con configuración mínima (`tauri.conf.json`)
- [x] Configurar ventana: título, ícono, tamaño mínimo (1024×768)
- [x] Backend local FastAPI como sidecar (PyInstaller)
- [x] `desktop_backend/` — importa `backend_api`, sobreescribe config/middleware/startup
- [x] DB local PostgreSQL, schema `desktop_local`, migraciones Alembic automáticas
- [x] Seeding automático (métodos de pago, monedas, almacén, caja, tasas de cambio)
- [x] `build_desktop_exe.bat` — pipeline completo para generar instalador NSIS

**Archivos creados:**
```
ferreteria_refactor/
  frontend_web/
    src-tauri/          ✅
      src/main.rs, lib.rs
      tauri.conf.json
      Cargo.toml
  desktop_backend/
    main.py, run.py, entry.py ✅
    startup.py (con seeding) ✅
    middleware.py, config.py ✅
    invensoft_backend.spec ✅
  build_desktop_exe.bat ✅
  iniciar_backend.bat ✅
```

---

### Fase 2 — Features nativos Windows
**Estimado:** 2–3 días
**Objetivo:** Experiencia de app nativa real.

**Tareas:**
- [ ] **System tray** con ícono + menú contextual (Abrir / Cerrar sesión / Salir)
- [ ] **Auto-start** al iniciar Windows (registro en `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`)
- [ ] **Kiosk mode** opcional: fullscreen, sin decoraciones, sin Alt+F4
- [ ] **Deep links** `miinventariofacil://config?...` — reutilizar el protocolo actual del Windows Bridge
- [ ] **Auto-updater** (Tauri Updater Plugin) apuntando a GitHub Releases o endpoint propio
- [ ] **Ventana única** — si el usuario intenta abrir una segunda instancia, foco a la existente
- [ ] Ícono en barra de tareas con nombre "Invensoft" / "Mi Inventario Fácil"

---

### Fase 3 — Absorber el Windows Bridge (impresoras)
**Estimado:** 3–5 días
**Objetivo:** Eliminar el Windows Bridge C# como app separada.

**Contexto actual:**
- El Windows Bridge C# escucha WebSocket en `ws://localhost` y envía comandos ESC/POS a la impresora
- El frontend se conecta por WebSocket al Bridge con mensajes tipo `{ type: "print", template, context, target }`
- Template engine: Scriban (C#)

**Opciones para Fase 3:**

**Opción A (más rápida):** Mantener protocolo WebSocket
El módulo Rust de Tauri levanta el servidor WebSocket localmente.
El frontend no cambia — sigue enviando `{ type: "print", ... }`.
Solo cambia quién escucha: Rust en lugar de C#.

**Opción B (más limpia):** Comandos Tauri nativos
Eliminar WebSocket. El frontend llama `invoke('print_ticket', { template, context })`.
Más eficiente pero requiere cambios en `printerService.js`.

**Tareas (Opción A recomendada para migración suave):**
- [ ] Rust: crate `escpos` o `thermal-printer` para generar bytes ESC/POS
- [ ] Rust: servidor WebSocket local (`tokio-tungstenite`)
- [ ] Rust: motor de templates (reemplazar Scriban por `tera` o `handlebars-rs`)
- [ ] Migrar templates `.scriban` a formato compatible
- [ ] Validar en impresoras 58mm y 80mm
- [ ] Deprecar Windows Bridge C# (mantener por compatibilidad en clientes que no actualicen)

**⚠️ Pendiente discutir:**
- ¿Cómo manejar clientes que tengan el Windows Bridge instalado Y el nuevo .exe?
- ¿Se mantiene compatibilidad hacia atrás por N versiones?

---

### Fase 4 — Offline parcial (futuro)
**Estimado:** 5–7 días
**Objetivo:** Funcionar con internet inestable en operaciones críticas.

**Alcance mínimo viable:**
- Cache de catálogo de productos en SQLite local (`tauri-plugin-sql`)
- Cola de ventas offline → sincronización automática al recuperar conexión
- Indicador de estado de conexión en la UI

**Pendiente discutir:**
- ¿Qué operaciones deben funcionar offline? (Solo ventas, o también caja, inventario...)
- ¿Cómo resolver conflictos al sincronizar?
- ¿Implica cambios al backend? (endpoint de bulk sync)

---

## 5. Decisiones — Estado

| # | Decisión | Resolución |
|---|----------|-----------|
| D1 | ¿Un .exe o dos builds? | **Dos builds separados**: `Invensoft-QA.exe` e `Invensoft.exe` |
| D2 | ¿Cómo distribuir updates? | **Endpoint propio en VPS** `/api/v1/desktop/updates/latest.json` |
| D3 | ¿Reemplazar Windows Bridge? | **Coexistir en Fase 2, reemplazar en Fase 3** |
| D4 | ¿Soporte Mac/Linux? | **Solo Windows por ahora** (clientes POS son Windows) |
| D5 | Firma de código | **Tolerar alerta en QA/dev**, invertir en certificado en producción masiva |
| D6 | Nombre del ejecutable | **`Invensoft.exe`** |

### Sistema de licencias
Ver documento completo: `19_Sistema_Licencias.md`

**Resumen de decisiones:**
- **device_id ligado al hardware** (cobro por computadora)
- **Días de trial configurables** por el admin (no hardcodeado)
- **Planes:** trial / monthly / annual / lifetime
- Validación **híbrida**: online al arrancar + archivo local `.lic` para offline

---

## 6. Consideraciones Técnicas

### Compatibilidad WebView2
- Windows 10 v1803+ y Windows 11: WebView2 **ya instalado**
- Windows 7/8: No soportado por WebView2 → ¿hay clientes en W7?
- El instalador Tauri puede incluir el bootstrapper de WebView2 para versiones antiguas

### Capacitor no se ve afectado
- El proyecto Vite genera el build web normal → lo usa Capacitor para Android/iOS
- Tauri usa el mismo `dist/` generado por Vite
- Ambos coexisten sin conflicto en el mismo proyecto

### HashRouter y rutas
- El frontend usa `HashRouter` (`/#/ruta`) — Tauri carga `index.html` y el hash routing funciona nativo

### Variables de entorno
- Tauri soporta múltiples perfiles de build (`tauri.conf.json` por entorno)
- `TAURI_PRIVATE_KEY` para signing de updates (se guarda en secrets del CI)

---

## 7. Estructura de Archivos (Fase 1)

```
ferreteria_refactor/frontend_web/
├── src/                     ← sin cambios
├── src-tauri/               ← NUEVO
│   ├── src/
│   │   ├── main.rs          ← Entry point Tauri
│   │   └── lib.rs           ← Commands nativos
│   ├── icons/               ← ícono en múltiples resoluciones
│   │   ├── icon.ico
│   │   ├── icon.png
│   │   └── ...
│   ├── Cargo.toml           ← dependencias Rust
│   └── tauri.conf.json      ← configuración principal
├── package.json             ← agregar @tauri-apps/cli + @tauri-apps/api
└── vite.config.js           ← agregar plugin @tauri-apps/vite-plugin
```

---

## 8. Comandos de desarrollo

```bash
# Instalar dependencias
npm install @tauri-apps/cli @tauri-apps/api
npm install @tauri-apps/vite-plugin

# Desarrollo (Tauri abre ventana nativa con hot-reload)
npm run tauri dev

# Build producción (genera .exe en src-tauri/target/release/)
npm run tauri build

# Build QA
npm run tauri build -- --config src-tauri/tauri.qa.conf.json
```

---

## 9. Estimado total

| Fase | Descripción | Días |
|------|-------------|------|
| 1 | Wrapper básico + instalador .exe | 1–2 |
| 2 | System tray, auto-start, kiosk, deep links, updater | 2–3 |
| 3 | Absorber Windows Bridge (impresoras ESC/POS en Rust) | 3–5 |
| 4 | Offline parcial (SQLite + sync queue) | 5–7 |
| **Total** | | **11–17 días** |

Las fases 1 y 2 son independientes del resto del sistema.
Las fases 3 y 4 requieren coordinación con el backend.

---

*Documento creado: 2026-03-04*
*Próxima revisión: al iniciar Fase 1*
