# 🔍 Guía de Diagnóstico: Migraciones en Docker

## ❌ Problema: Tabla `alembic_version` no existe

Esto significa que Alembic no se está ejecutando en el contenedor.

---

## 🔧 Pasos de Diagnóstico en el VPS:

### 1. Verificar que el contenedor está usando la nueva imagen:

```bash
# SSH al VPS
ssh usuario@tu-vps

# Ver qué imagen está corriendo
docker ps
docker inspect <container_id> | grep Image
```

**Debe mostrar:** `gamijoam/ferreteria-saas:v6-nueva`

---

### 2. Ver los logs del contenedor:

```bash
# Ver logs de inicio
docker logs <container_name>

# O en tiempo real
docker logs -f <container_name>
```

**Deberías ver:**
```
🚀 Iniciando aplicación...
📝 Aplicando migraciones de base de datos...
✅ Migraciones aplicadas exitosamente
🌐 Iniciando servidor FastAPI...
```

---

### 3. Si NO ves los mensajes de migración:

**Problema:** El script `docker-entrypoint.sh` no se está ejecutando.

**Posibles causas:**

#### A. El script no tiene permisos de ejecución:
```bash
# Entrar al contenedor
docker exec -it <container_name> bash

# Verificar permisos
ls -la /app/docker-entrypoint.sh

# Debe mostrar: -rwxr-xr-x (con x)
```

#### B. El script tiene formato Windows (CRLF):
```bash
# Dentro del contenedor
file /app/docker-entrypoint.sh

# Si dice "CRLF", necesitas convertir a LF
```

---

### 4. Ejecutar migración manualmente (temporal):

```bash
# Entrar al contenedor
docker exec -it <container_name> bash

# Ir al directorio correcto
cd /app/ferreteria_refactor

# Ejecutar migración
alembic upgrade head

# Salir
exit
```

---

## ✅ Solución Permanente:

### Opción A: Convertir script a formato Unix (LF)

En tu máquina Windows, antes de construir la imagen:

```powershell
# Instalar dos2unix (si no lo tienes)
# O usar Git Bash:
dos2unix docker-entrypoint.sh

# O con PowerShell:
(Get-Content docker-entrypoint.sh -Raw) -replace "`r`n", "`n" | Set-Content docker-entrypoint.sh -NoNewline
```

---

### Opción B: Forzar LF en Git

Crear/editar `.gitattributes`:

```
*.sh text eol=lf
```

---

### Opción C: Crear script directamente en el Dockerfile

Modificar `Dockerfile`:

```dockerfile
# En lugar de COPY docker-entrypoint.sh
RUN echo '#!/bin/bash\n\
set -e\n\
echo "🚀 Iniciando aplicación..."\n\
cd /app/ferreteria_refactor\n\
echo "📝 Aplicando migraciones..."\n\
alembic upgrade head\n\
if [ $? -eq 0 ]; then\n\
    echo "✅ Migraciones aplicadas"\n\
else\n\
    echo "❌ Error en migraciones"\n\
    exit 1\n\
fi\n\
cd /app\n\
echo "🌐 Iniciando servidor..."\n\
exec uvicorn ferreteria_refactor.backend_api.main:app --host 0.0.0.0 --port 8000\n\
' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh
```

---

## 🚀 Comandos Rápidos para el VPS:

```bash
# 1. Detener contenedor actual
docker-compose down

# 2. Descargar nueva imagen
docker-compose pull

# 3. Iniciar con logs visibles
docker-compose up

# Si todo está bien, Ctrl+C y luego:
docker-compose up -d
```

---

## 🧪 Verificación Post-Migración:

```bash
# Conectar a PostgreSQL del contenedor
docker exec -it <postgres_container> psql -U postgres -d ferreteria_db

# Verificar tabla alembic_version
\dt alembic_version

# Ver versión actual
SELECT * FROM alembic_version;

# Debe mostrar: 7459b903ac5f

# Verificar columna unit_id
\d sale_details

# Salir
\q
```

---

## 📝 Checklist de Solución:

- [ ] Convertir `docker-entrypoint.sh` a formato LF
- [ ] Reconstruir imagen Docker
- [ ] Subir nueva imagen a Docker Hub
- [ ] En VPS: `docker-compose pull`
- [ ] En VPS: `docker-compose up` (ver logs)
- [ ] Verificar mensajes de migración en logs
- [ ] Verificar tabla `alembic_version` en BD
- [ ] Verificar columna `unit_id` en `sale_details`

---

## 🎯 Comando Todo-en-Uno (En tu PC):

```powershell
# Convertir a LF
(Get-Content docker-entrypoint.sh -Raw) -replace "`r`n", "`n" | Set-Content docker-entrypoint.sh -NoNewline

# Construir
docker build -t ferreteria-app .

# Etiquetar
docker tag ferreteria-app gamijoam/ferreteria-saas:v6-fix

# Subir
docker push gamijoam/ferreteria-saas:v6-fix
```

**Luego en el VPS:**
```bash
docker-compose down
docker pull gamijoam/ferreteria-saas:v6-fix
# Actualizar docker-compose.yml para usar v6-fix
docker-compose up -d
docker logs -f <container_name>
```
