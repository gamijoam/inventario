# Proceso de Rebuild y Deploy en QA (VPS)

Este documento describe el proceso correcto para reconstruir y desplegar imágenes Docker en el entorno de QA del VPS.

## Contexto del Problema

El proceso de rebuild fallaba porque:
1. El `docker-compose.yml`原来的 usaba una imagen combinada (`ferreteria-app`) que incluía backend + frontend en un solo contenedor
2. El entrypoint intentaba ejecutar el backend (uvicorn) pero `/app/media` no existía
3. El frontend real estaba en una imagen separada (`ferreteria-frontend`) basada en nginx

## Arquitectura Correcta

```
┌─────────────────────────────────────────────────────────────┐
│                    docker-compose.yml                        │
├─────────────────────────────────────────────────────────────┤
│  backend_qa    → gamijoam/ferreteria-backend:qa-vXXX        │
│  frontend_qa   → gamijoam/ferreteria-frontend:qa-vXXX       │
│  frontend_admin→ gamijoam/ferreteria-admin-panel:qa-vXXX    │
│  landing_qa    → gamijoam/ferreteria-landing:qa-vXXX        │
│  db_qa         → postgres:15-alpine                         │
└─────────────────────────────────────────────────────────────┘
```

**Importante**: Cada servicio tiene su propia imagen Docker independiente.

---

## Paso 1: Corregir Bugs en el Código Fuente

Antes de hacer build, corregir cualquier error de sintaxis en el código.

### Ejemplo: Error en CreditosTab.jsx

```bash
# En el VPS, editar el archivo con problema
ssh root@212.28.176.157
vim /root/deploy/qa/code/ferreteria_refactor/frontend_web/src/pages/Sales/tabs/CreditosTab.jsx
```

Error encontrado en línea ~704:
```jsx
// ANTES (ERROR - falta cerrar paréntesis)
                                                    {inv.credit_installments && (
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            {inv.credit_installments} cuotas · ${parseFloat(inv.credit_installment_amount||0).toFixed(2)} c/u · {inv.credit_frequency||'mensual'}
                                                        </div>
                                                    )
                                                </td>

// DESPUÉS (CORRECTO)
                                                    {inv.credit_installments && (
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            {inv.credit_installments} cuotas · ${parseFloat(inv.credit_installment_amount||0).toFixed(2)} c/u · {inv.credit_frequency||'mensual'}
                                                        </div>
                                                    )}
                                                </td>
```

---

## Paso 2: Build de la Imagen Frontend (Nginx)

El frontend es una imagen nginx que sirve archivos estáticos de React.

```bash
# En el VPS
cd /root/deploy/qa/code/ferreteria_refactor/frontend_web

# Build con VITE_API_URL como build arg
docker build \
  --build-arg VITE_API_URL=https://api-qa.miinventariofacil.com/api/v1 \
  -t gamijoam/ferreteria-frontend:qa-v2026-v94 \
  -f Dockerfile.prod .
```

### Dockerfile.prod del frontend

```dockerfile
# ─────────────────────────────────────────────
# ETAPA 1: Build con Vite
# ─────────────────────────────────────────────
FROM node:22.14-alpine3.21 AS build-stage

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN echo "Building with VITE_API_URL: $VITE_API_URL"
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN npm run build

# ─────────────────────────────────────────────
# ETAPA 2: Nginx
# ─────────────────────────────────────────────
FROM nginx:1.27-alpine3.21 AS production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Paso 3: Build de la Imagen Admin Panel

```bash
cd /root/deploy/qa/code/ferreteria_refactor/saas_admin

docker build \
  --build-arg VITE_API_URL=https://api-qa.miinventariofacil.com/api/v1 \
  -t gamijoam/ferreteria-admin-panel:qa-v2026-v93 \
  .
```

---

## Paso 4: Verificar que VITE_API_URL está Embebido

```bash
# Verificar en la imagen que la URL correcta está en los JS bundles
docker run --rm --entrypoint sh gamijoam/ferreteria-frontend:qa-v2026-v94 \
  -c 'grep -o "api-qa.miinventariofacil.com" /usr/share/nginx/html/assets/*.js | head -1'

# Verificar admin panel
docker run --rm --entrypoint sh gamijoam/ferreteria-admin-panel:qa-v2026-v93 \
  -c 'grep -o "api-qa.miinventariofacil.com" /usr/share/nginx/html/assets/*.js | head -1'
```

Ambos deben 输出 `api-qa.miinventariofacil.com`.

---

## Paso 5: Actualizar docker-compose.yml

```bash
cd /root/deploy/qa

# Editar docker-compose.yml para usar las imágenes correctas
vim docker-compose.yml
```

```yaml
services:
  db_qa:
    image: postgres:15-alpine
    container_name: db_qa_server
    # ... config

  backend_qa:
    image: gamijoam/ferreteria-backend:qa-v2026-v91
    container_name: backend_qa_server
    # ... config (NO usa env_file para frontend)

  frontend_qa:
    image: gamijoam/ferreteria-frontend:qa-v2026-v94
    container_name: frontend_qa_server
    restart: always
    networks:
      - web_publica
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend-qa.rule=Host(`app-qa.miinventariofacil.com`)"
      # ... more labels

  frontend_admin:
    image: gamijoam/ferreteria-admin-panel:qa-v2026-v93
    container_name: admin_panel_qa
    # ... config
```

---

## Paso 6: Desplegar

```bash
cd /root/deploy/qa

# Parar y remover contenedores antiguos
docker stop frontend_qa_server admin_panel_qa
docker rm frontend_qa_server admin_panel_qa

# Recrear y iniciar todos los servicios
docker compose up -d

# Verificar que están corriendo
docker ps | grep -E 'frontend|admin'
```

---

## Paso 7: Verificación Post-Deploy

```bash
# Test local en el VPS
curl -sI https://app-qa.miinventariofacil.com
# Debe devolver HTTP/2 200

curl -sI https://admin-qa.miinventariofacil.com
# Debe devolver HTTP/2 200

# Ver logs de los contenedores
docker logs frontend_qa_server --tail 10
docker logs admin_panel_qa --tail 10
```

---

## Comandos Rápidos de Rebuild (Resumen)

```bash
# 1. Fix código fuente en VPS
ssh root@212.28.176.157
vim /root/deploy/qa/code/ferreteria_refactor/frontend_web/src/pages/.../ArchivoConError.jsx

# 2. Build frontend
cd /root/deploy/qa/code/ferreteria_refactor/frontend_web
docker build --build-arg VITE_API_URL=https://api-qa.miinventariofacil.com/api/v1 \
  -t gamijoam/ferreteria-frontend:qa-v2026-v95 -f Dockerfile.prod .

# 3. Build admin panel
cd /root/deploy/qa/code/ferreteria_refactor/saas_admin
docker build --build-arg VITE_API_URL=https://api-qa.miinventariofacil.com/api/v1 \
  -t gamijoam/ferreteria-admin-panel:qa-v2026-v95 .

# 4. Update tag en .env (opcional si solo rebuildaste)
cd /root/deploy/qa
sed -i 's/qa-v2026-v94/qa-v2026-v95/g' .env

# 5. Restart contenedores
docker stop frontend_qa_server admin_panel_qa
docker rm frontend_qa_server admin_panel_qa
docker compose up -d

# 6. Verificar
docker ps | grep -E 'frontend|admin'
curl -sI https://app-qa.miinventariofacil.com
```

---

## Notas Importantes

### Por qué NO usar ferreteria-app (imagen combinada)
- Esa imagen incluye backend + frontend en un solo contenedor
- El entrypoint ejecuta `uvicorn` (backend Python)
- Pero serve archivos estáticos de React desde `/app/static`
- Tiene problemas de permisos y directorios faltantes (`/app/media`)

### Imágenes correctas por servicio
| Servicio | Imagen | Base |
|-----------|--------|------|
| frontend_qa | `ferreteria-frontend:qa-vXXX` | nginx:alpine |
| frontend_admin | `ferreteria-admin-panel:qa-vXXX` | nginx:alpine |
| backend_qa | `ferreteria-backend:qa-vXXX` | python:3.11 |
| landing_qa | `ferreteria-landing:qa-vXXX` | nginx:alpine |

### VITE_API_URL en Build Time
- `VITE_API_URL` es una variable de build (build arg)
- Se embebe en el JavaScript compilado durante `npm run build`
- NO se puede cambiar en runtime - requiere rebuild

### Tags de versión
- Usar formato: `qa-v2026-vXX` (ej: `qa-v2026-v94`)
- Backend y frontend pueden tener tags diferentes
- Cada build incrementando el número de versión previene conflictos de caché