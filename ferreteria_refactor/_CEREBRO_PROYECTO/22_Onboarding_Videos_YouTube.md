# 22 - Sistema de Onboarding con Videos YouTube

Documentación completa del sistema de videos tutoriales que se muestran a los usuarios la primera vez que entran a cada módulo/pestaña de la aplicación.

---

## Concepto

Cada módulo o pestaña importante tiene asociado un video corto de YouTube (45-75 segundos) que explica su función principal. El video aparece automáticamente la **primera vez** que el usuario visita esa sección. Después puede re-verlo en cualquier momento desde el botón **"▶ Ver tutorial"**.

---

## Arquitectura del Sistema

```
src/
├── config/
│   └── onboardingVideos.js          ← Registro central de todos los videos
├── hooks/
│   └── useOnboardingVideo.js        ← Lógica "visto/no visto" con localStorage
└── components/
    └── common/
        └── OnboardingVideoModal.jsx  ← Modal con iframe YouTube 16:9
```

### Flujo de funcionamiento

```
Usuario entra a una pestaña
        ↓
useOnboardingVideo(key) consulta localStorage
        ↓
¿Ya fue visto? → No → Espera 800ms → Muestra modal
                → Sí → No muestra nada (botón "Ver tutorial" disponible)
        ↓
Usuario cierra el modal → se marca como visto en localStorage
```

### Aislamiento multi-tenant

La clave en localStorage incluye `tenantId` y `userId` para evitar que el estado de un usuario afecte a otro:

```
onboarding_video:{tenantId}:{userId}:{moduleKey}
```

Ejemplo real:
```
onboarding_video:ferreteria-norte:42:inventory:productos  → "true"
```

---

## Registro de Videos

Archivo central: `src/config/onboardingVideos.js`

### Formato de una entrada

```js
'modulo:pestana': { videoId: 'YOUTUBE_ID', title: 'Título descriptivo' }
```

- **`modulo:pestana`** — clave única en formato `snake_case` con dos niveles (módulo y sub-sección)
- **`videoId`** — el código que aparece en la URL de YouTube después de `?v=` o `youtu.be/`
- **`title`** — título que se muestra en el encabezado del modal

### Tabla de videos registrados

| Clave | Video ID | Título | Estado | Fecha |
|---|---|---|---|---|
| `inventory:productos` | `btv6ZDuO4kA` | Cómo gestionar tus productos | ✅ Publicado | 2026-03-15 |
| `inventory:categorias` | — | Organizar productos por categorías | ⏳ Pendiente | — |
| `inventory:kardex` | — | Qué es el Kardex y cómo leerlo | ⏳ Pendiente | — |
| `inventory:traslados` | — | Traslados entre almacenes | ⏳ Pendiente | — |
| `inventory:almacenes` | — | Gestión de almacenes | ⏳ Pendiente | — |
| `inventory:seriales` | — | Recepción de productos serializados | ⏳ Pendiente | — |
| `pos` | — | Cómo realizar una venta | ⏳ Pendiente | — |
| `purchases` | — | Registrar una compra a proveedor | ⏳ Pendiente | — |
| `services:reception` | — | Nueva orden de servicio técnico | ⏳ Pendiente | — |
| `customers` | — | Gestión de clientes y créditos | ⏳ Pendiente | — |
| `reports` | — | Cómo leer los reportes | ⏳ Pendiente | — |

> Para activar un video: agregar el `videoId` en `onboardingVideos.js` y descomentar la línea.

---

## Módulos con integración activa

| Módulo / Página | Archivo | Estado |
|---|---|---|
| Centro de Inventario (todas las pestañas) | `pages/Inventory/InventoryCenter.jsx` | ✅ Integrado |
| POS | — | ⏳ Pendiente |
| Compras | — | ⏳ Pendiente |
| Servicios / Recepción | — | ⏳ Pendiente |
| Clientes | — | ⏳ Pendiente |

### Cómo integrar en una nueva página

1. Importar el hook y el modal:
```jsx
import { useOnboardingVideo } from '../../hooks/useOnboardingVideo';
import OnboardingVideoModal from '../../components/common/OnboardingVideoModal';
```

2. Usar el hook con la clave del módulo:
```jsx
const { showModal, dismiss, open, videoConfig } = useOnboardingVideo('pos');
```

3. Agregar el modal en el JSX:
```jsx
{showModal && videoConfig && (
    <OnboardingVideoModal
        videoId={videoConfig.videoId}
        title={videoConfig.title}
        onClose={dismiss}
    />
)}
```

4. Opcionalmente, agregar botón "Ver tutorial":
```jsx
{videoConfig && (
    <button onClick={open}>▶ Ver tutorial</button>
)}
```

---

## Convenciones para producción de videos

### Canal de YouTube
- Videos subidos como **No listados** (accesibles por link, no aparecen en búsquedas)
- Organizados en **playlists por módulo** (ej. "Centro de Inventario", "Ventas")
- Nombre de la playlist = nombre del módulo en la app

### Formato del título en YouTube
```
[Descripción de la acción] | Mi Inventario Fácil
```
Ejemplos:
- `Cómo agregar y gestionar productos | Mi Inventario Fácil`
- `Registrar una compra a proveedor | Mi Inventario Fácil`

### Especificaciones del video
| Parámetro | Valor recomendado |
|---|---|
| Duración | 45 – 75 segundos |
| Resolución | 1080p mínimo |
| Herramienta grabación (Ubuntu) | OBS Studio o Kazam |
| Herramienta edición | Kdenlive o `ffmpeg` para cortes |
| Audio | Narración + descripción en pantalla |
| Estructura interna | 5s contexto → 35-60s demo → 5s cierre |

### Parámetros del embed (ya configurados en el modal)
```
?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3
```
- `rel=0` — no muestra videos relacionados al terminar
- `modestbranding=1` — minimiza logo de YouTube
- `iv_load_policy=3` — oculta anotaciones

---

## Decisiones de diseño

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| localStorage con userId en clave | Solo localStorage sin userId | Dos usuarios en el mismo browser verían el mismo estado |
| iframe directo (sin librería) | `react-player` / `react-youtube` | Cero dependencias; no necesitamos callback "video terminado" |
| Videos No listados en YouTube | Autohosteados / Vimeo | Gratis, sin límite de ancho de banda, mejor latencia Venezuela |
| Modal automático con delay 800ms | Mostrar inmediatamente | La página necesita cargar antes de que el modal tome foco |
| Botón "Ver tutorial" siempre visible | Solo al primer acceso | El usuario puede querer repasar en cualquier momento |

---

## Tareas pendientes

- [ ] Grabar video: `inventory:categorias`
- [ ] Grabar video: `inventory:kardex`
- [ ] Grabar video: `inventory:traslados`
- [ ] Grabar video: `inventory:almacenes`
- [ ] Grabar video: `inventory:seriales`
- [ ] Grabar video: `pos`
- [ ] Grabar video: `purchases`
- [ ] Grabar video: `services:reception`
- [ ] Integrar el hook en POS (`pages/POS/POSPage.jsx` o equivalente)
- [ ] Integrar el hook en Compras
- [ ] Integrar el hook en Recepción de Servicios
- [ ] Evaluar agregar tabla `onboarding_progress` en BD para analytics (ver si X% de usuarios completó el onboarding)
