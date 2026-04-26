# 29 - Guía de Build y Despliegue del Frontend

## Problema Conocido: Caché de Vite impide recompilación

### Síntomas
- Se editan archivos JSX en `/root/deploy/qa/code/ferreteria_refactor/frontend_web/src/`
- Se ejecuta el script de build (`build_and_deploy_qa.sh`)
- Los cambios NO aparecen en el frontend desplegado
- El bundle compilado NO contiene las modificaciones

### Causa Raíz
Vite usa un sistema de caché por capas:
1. **Caché en memoria** (`node_modules/.vite`) - persiste entre builds
2. **Capas de Docker** - si una capa no cambia, Docker usa versión en caché
3. **BuildKit cache** - Docker BuildKit cachea capas independientemente del contenido

### Solución: Rebuild Limpio

```bash
# 1. Conectarse al VPS
ssh inventario

# 2. Ir al directorio del frontend
cd /root/deploy/qa/code/ferreteria_refactor/frontend_web

# 3. LIMPIAR caché de Vite (CRÍTICO)
rm -rf node_modules/.vite
rm -rf dist

# 4. Limpiar BuildKit de Docker (CRÍTICO para forzar rebuild de capas)
docker builder prune -af

# 5. Rebuild con --no-cache y --pull para forzar descarga de imágenes base
docker build --no-cache --pull \
  -f Dockerfile.prod \
  --build-arg VITE_API_URL=https://api-qa.miinventariofacil.com/api/v1 \
  -t gamijoam/ferreteria-app:qa-version-$(date +%Y%m%d%H%M) .

# 6. Push a DockerHub
docker push gamijoam/ferreteria-app:qa-version-YYYYMMDDHHMM

# 7. Actualizar TAG en /root/deploy/qa/.env
# Editar manualmente: TAG=qa-version-YYYYMMDDHHMM

# 8. Recrear contenedor (docker-compose tiene bug con recreate)
docker rm -f frontend_qa_server
docker run -d \
  --name frontend_qa_server \
  --restart always \
  --network web_publica \
  -l traefik.enable=true \
  -l 'traefik.http.routers.frontend-qa.rule=Host(`app-qa.miinventariofacil.com`) || HostRegexp(`{subdomain:[a-z0-9-]+}.qa.miinventariofacil.com`)' \
  -l traefik.http.routers.frontend-qa.entrypoints=websecure \
  -l traefik.http.routers.frontend-qa.tls.certresolver=myresolver \
  -l traefik.http.services.frontend-qa.loadbalancer.server.port=80 \
  gamijoam/ferreteria-app:qa-version-YYYYMMDDHHMM
```

## Script Alternativo: rebuild_frontend.sh

Existe un script en `/root/deploy/qa/rebuild_frontend.sh` pero USAR CON PRECAUCIÓN - no limpia caché de Vite:

```bash
cd /root/deploy/qa
./rebuild_frontend.sh
```

**Problema**: Este script no elimina `node_modules/.vite` ni limpia BuildKit, por lo que los cambios pueden no reflejarse.

## Script Recomendado: fix_frontend.sh

```bash
cd /root/deploy/qa
./fix_frontend.sh
```

Este script:
1. Elimina el contenedor problemático
2. Ejecuta `docker system prune -f`
3. Levanta nuevo contenedor con docker-compose

**Pero sigue sin resolver el problema de caché de Vite.**

## Verificación Post-Build

Para verificar que los cambios están en el bundle:

```bash
# Verificar que el texto esperado existe en el bundle
docker run --rm gamijoam/ferreteria-app:qa-version-XXXX grep -o 'TEXTO_ESPERADO' /usr/share/nginx/html/assets/POS-*.js

# Verificar que NO existe texto antiguo
docker run --rm gamijoam/ferreteria-app:qa-version-XXXX grep -o 'Factor: x' /usr/share/nginx/html/assets/POS-*.js
```

## Arquitectura del Frontend

```
┌─────────────────────────────────────────────────────────────┐
│  Dockerfile.prod (Multi-stage build)                        │
├─────────────────────────────────────────────────────────────┤
│  Stage 1: build-stage (node:22.14-alpine3.21)              │
│  ├── COPY package.json + package-lock.json                  │
│  ├── RUN npm install --legacy-peer-deps                    │
│  ├── COPY . (todo el código fuente)                        │
│  └── RUN npm run build (Vite compila a /app/dist)         │
├─────────────────────────────────────────────────────────────┤
│  Stage 2: production (nginx:1.27-alpine3.21)              │
│  └── COPY --from=build-stage /app/dist /usr/share/nginx/   │
└─────────────────────────────────────────────────────────────┘
```

## Comandos Útiles de Debug

```bash
# Ver qué imagen está usando el contenedor
docker inspect frontend_qa_server | grep -A3 'Image'

# Ver logs del contenedor
docker logs frontend_qa_server --tail 20

# Ver contenido del bundle
docker run --rm gamijoam/ferreteria-app:qa-version-XXXX \
  sh -c 'ls /usr/share/nginx/html/assets/ | grep POS'

# Ver tamaño del bundle (si cambió, hubo recompilación)
docker run --rm gamijoam/ferreteria-app:qa-version-XXXX \
  sh -c 'wc -c /usr/share/nginx/html/assets/POS-*.js'
```

## Notas Importantes

1. **El TAG en `/root/deploy/qa/.env`** debe coincidir con la imagen pushueada a DockerHub
2. **docker-compose up** tiene un bug conocido con `'ContainerConfig'` KeyError - usar `docker run` directamente
3. **Vite cache** se ubica en `node_modules/.vite` - debe eliminarse antes de cada rebuild
4. **Docker BuildKit** puede cachear capas incluso si el código cambió - usar `--no-cache`

## Flujo Completo de Deploy Frontend QA

```
Código Fuente (VPS)
    │
    ▼
rm -rf node_modules/.vite dist
    │
    ▼
docker builder prune -af
    │
    ▼
docker build --no-cache --pull -f Dockerfile.prod ...
    │
    ▼
docker push a DockerHub
    │
    ▼
docker rm -f frontend_qa_server
    │
    ▼
docker run -d ... con nueva imagen
    │
    ▼
Verificar con Ctrl+F5 en navegador
```

---

*Creado: 2026-04-15*
*Problema original: Cambios en POSCart.jsx y UnitSelectionModal.jsx no se reflejaban tras rebuild*
