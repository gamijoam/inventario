# 21 - Bot de Telegram (Mi Inventario Fácil)

> Documentación del chatbot de Telegram con IA para búsqueda de productos en el catálogo del tenant.
> Estado actual: **✅ Funcionando en producción local** — pendiente despliegue en VPS.

---

## 1. Descripción General

Bot de Telegram que permite a los **clientes de una tienda** buscar productos del inventario usando lenguaje natural en español. Integra Google Gemini para comprensión del lenguaje y la API central del backend para consultar el catálogo en tiempo real.

**Link del bot en producción:** `https://t.me/mi_inventario_facil_bot`

---

## 2. Arquitectura

```
Cliente Telegram
      │
      ▼
python-telegram-bot (polling)
      │
      ├─► Google Gemini 2.5 Flash
      │     Entiende el mensaje, extrae términos de búsqueda
      │     Devuelve: {"intent": "search", "queries": ["iPhone", "Samsung"]}
      │
      └─► API Central: api.miinventariofacil.com
            Header: X-Tenant-ID: <tenant>
            GET /api/v1/products/catalog?search=<query>&limit=10&min_price=X&max_price=Y
            Devuelve: {items, total, has_more}
```

### Flujo de un mensaje

```
Usuario: "Hola, tienen iphone y samsung?"
  │
  ├─ Gemini analiza → {"intent": "search", "queries": ["iPhone", "Samsung"]}
  │
  ├─ Búsqueda 1: /catalog?search=iPhone → 6 resultados
  ├─ Búsqueda 2: /catalog?search=Samsung → N resultados
  │
  └─ Bot envía: foto + nombre + precio + stock + SKU (por cada producto)
```

### Fallback sin Gemini

Si Gemini no responde (error 429, 404, timeout), `_clean_query_fallback()` limpia el texto del usuario con regex (elimina saludos, artículos, verbos de pregunta) y busca directamente.

---

## 3. Estructura de Archivos

```
telegram_bot/
├── bot.py              ← Handler principal: /start, /buscar, texto libre
├── gemini_service.py   ← Wrapper Gemini API + sistema de intents
├── inventory_api.py    ← Cliente HTTP async al backend
├── config.py           ← Variables de entorno
├── Dockerfile          ← Contenedor Python 3.12-slim
├── requirements.txt    ← Dependencias
├── .env                ← Credenciales (NO commitear)
├── .env.example        ← Template para configurar
└── .gitignore          ← Excluye .env
```

---

## 4. Configuración (.env)

```env
TELEGRAM_BOT_TOKEN=<token del bot en BotFather>
GEMINI_API_KEY=<api key de Google AI Studio>
GEMINI_MODEL=gemini-2.5-flash
BACKEND_URL=https://api.miinventariofacil.com
TENANT_SUBDOMAIN=<subdominio del tenant, ej: yaracall>
MAX_PRODUCTS_PER_MESSAGE=5
```

**Notas importantes:**
- `BACKEND_URL` apunta a la API central, NO al subdominio del tenant
- El tenant se identifica via header `X-Tenant-ID: <TENANT_SUBDOMAIN>` en cada request
- `gemini-2.5-flash` es el modelo correcto para API keys de nivel 1 con facturación activa
- `gemini-2.0-flash` puede dar error 404 con ciertas API keys

---

## 5. Sistema de Intents (Gemini)

El system prompt instruye a Gemini a responder siempre en JSON:

| Intent | Descripción | Estructura de respuesta |
|---|---|---|
| `search` | Búsqueda de productos | `{"intent": "search", "queries": ["term1"], "sort": "price_asc", "budget_min": 0, "budget_max": 200}` |
| `greeting` | Saludo sin búsqueda | `{"intent": "greeting", "response": "¡Hola!..."}` |
| `thanks` | Despedida/agradecimiento | `{"intent": "thanks", "response": "..."}` |
| `offtopic` | Mensaje no relacionado | `{"intent": "offtopic", "response": "..."}` |

**Campos del intent `search`:**
- `queries`: array de términos de búsqueda (normalización automática de sinónimos, marcas, modelos)
- `sort`: `"price_asc"` (barato), `"price_desc"` (caro), `null` (sin orden)
- `budget_min` / `budget_max`: rango de presupuesto en USD, `null` si no aplica

**Detección de presupuesto:**
- "tengo 200$" → `budget_min: 0, budget_max: 200`
- "entre 100 y 200" → `budget_min: 100, budget_max: 200`
- "como unos 200" → `budget_min: 160, budget_max: 240` (±20%)
- "más de 300" → `budget_min: 300, budget_max: null`

**Características del prompt:**
- Diccionario de sinónimos (cel/celu/tlf → "telefono", forro/case/cover → "forro", etc.)
- Normalización de marcas con typos (sansung → Samsung, aifon → iPhone)
- Detección de recomendaciones ("recomiéndame", "cuál es mejor") → siempre search
- Tolerancia a errores tipográficos y spanglish
- Regla de oro: ante la duda, buscar (nunca pedir aclaración)

---

## 6. Comandos del Bot

| Comando | Descripción |
|---|---|
| `/start` | Mensaje de bienvenida con instrucciones |
| `/buscar <término>` | Búsqueda directa sin pasar por Gemini |

---

## 7. Formato de Respuesta de Productos

Cada producto se envía como una tarjeta con:
- **Foto** del producto (si tiene `image_url` en la BD)
- **Nombre** en negrita
- **Precio** en USD
- **Stock** disponible (✅ En stock / ❌ Agotado)
- **SKU** del producto

Si hay más de `MAX_PRODUCTS_PER_MESSAGE` resultados, se muestran los primeros N y se indica cuántos más hay.

---

## 8. Historial de Bugs y Fixes

| Bug | Causa | Fix |
|---|---|---|
| "Disculpa, tuve un problema..." | API key `gemini-2.0-flash` no disponible (404) | Cambiar a `gemini-2.5-flash` |
| "SAMSUNG" → buscaba "S A M S U N G" | Regex `un[ao]s?` sin `\b` separaba letras | Reescribir `_clean_query` con word boundaries |
| "tiene iPhone" → no encontraba nada | `_clean_query` no quitaba "tiene" | Añadir "tiene" a lista de verbos |
| `ValueError: format code 'f' for str` | `price` viene como `"90.0000"` string del API | Función `_to_float()` antes de formatear |
| Indentación rota en `gemini_service.py` | Agentes paralelos insertaron `_clean_query` fuera de clase | Reescribir archivo completo |
| `429 RESOURCE_EXHAUSTED` | API key gratuita sin billing | Usar API key con facturación activa (nivel 1) |

---

## 9. Despliegue en VPS

### Opción A: Docker Compose (recomendada)

Agregar al `docker-compose.prod.yml`:

```yaml
telegram_bot:
  image: ghcr.io/usuario/mi-inventario-facil-telegram-bot:latest
  container_name: telegram_bot
  restart: unless-stopped
  env_file:
    - ./telegram_bot.env
  networks:
    - app_network
```

El bot usa **long polling** (no webhook), así que no necesita puerto expuesto ni dominio propio.

### Variables de entorno en el VPS

Crear `/root/deploy/prod/telegram_bot.env` con las credenciales reales. **No commitear este archivo.**

### Opción B: Proceso standalone

```bash
cd /ruta/del/bot
pip install -r requirements.txt
nohup python bot.py > /var/log/telegram_bot.log 2>&1 &
```

---

## 10. Roadmap del Bot (Propuestas)

### Fase 1 — Búsqueda + Presupuesto (✅ COMPLETADO)
- Búsqueda por lenguaje natural con sinónimos y typos
- Soporte multi-producto en un mensaje
- Fotos de productos
- Fallback sin Gemini
- Filtro por presupuesto (budget_min/budget_max) server-side y client-side
- Ordenamiento por precio (más barato/más caro)
- Respuestas humanizadas con intros aleatorios
- Detección de categorías genéricas ("telefono", "audifonos", "cargador", etc.)
- Backend: endpoint catalog con `min_price`/`max_price` query params

### Fase 2 — Carrito y Apartados (PROPUESTA)
- El cliente puede decir "apártame 1 iPhone 13" → se reserva stock
- Requiere: `POST /api/v1/orders/telegram` en backend
- Requiere: identificación del cliente por número de Telegram
- Estado de conversación por `chat_id` en memoria/Redis

### Fase 3 — Sistema de Pedidos Completo (PROPUESTA)
```
Cliente: "quiero comprar un redmi note 13 y 2 cargadores"
  Bot: "¿Cómo te llamas y cuál es tu teléfono para la orden?"
  Bot: "Tu pedido: [lista] — Total: $X — ¿Confirmas?"
  Bot: "✅ Pedido #123 creado. El vendedor te contactará."
  → Notificación al vendedor en el sistema
```

**Dependencias backend necesarias:**
- `POST /orders/telegram` — crear orden desde Telegram
- `POST /reservations` — apartar stock temporalmente
- `GET /customers/by-phone/{phone}` — identificar cliente

### Opción n8n como complemento (EVALUADO)
- n8n puede usarse para notificaciones al vendedor (Telegram → Webhook → n8n → notificación)
- NO reemplaza el bot Python para la lógica conversacional con estado
- Útil para: alertas de stock bajo, confirmaciones de pedidos, integraciones con pagos externos

---

## 11. Decisiones Técnicas

| Decisión | Alternativa considerada | Razón de la elección |
|---|---|---|
| Python + python-telegram-bot | n8n completo | Mayor control sobre estado conversacional, reutiliza stack existente |
| Long polling | Webhook | No requiere HTTPS propio ni configuración de dominio extra |
| Gemini 2.5 Flash | GPT-4o, Claude | API key ya disponible en el proyecto, costo menor |
| Búsqueda directa como fallback | Error si Gemini falla | Bot funciona aunque Gemini esté caído |
