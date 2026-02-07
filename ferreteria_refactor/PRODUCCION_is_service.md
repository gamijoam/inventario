# Guía de Despliegue: Campo `is_service` en Producción

## ⚠️ IMPORTANTE: Situación Actual

En **desarrollo local**, aplicamos la migración de dos formas:
1. SQL directo: `ALTER TABLE products ADD COLUMN is_service...`
2. Migración Alembic generada: `5dd93f3e147f_add_is_service_field_to_products.py`

Esto causó un conflicto que resolvimos con `alembic stamp head`.

## 🚀 Despliegue en Producción (SEGURO)

### Opción 1: Usar Alembic (RECOMENDADO)

La migración de Alembic ya está creada y funcionará correctamente en producción porque **no tiene el conflicto** que tuvimos en desarrollo.

**Pasos:**

1. **Hacer commit de los cambios**:
```bash
git add .
git commit -m "feat: add is_service field for service-type products"
git push
```

2. **En el servidor de producción**:
```bash
# Pull los cambios
git pull

# Ejecutar migraciones de Alembic
alembic upgrade head
```

3. **Reiniciar el servidor**:
```bash
# Dependiendo de tu setup (Docker, systemd, etc.)
docker-compose restart backend
# O
systemctl restart ferreteria-backend
```

**✅ Esto funcionará sin problemas** porque:
- La columna NO existe en producción
- Alembic la creará correctamente
- No hay conflicto de "columna duplicada"

---

### Opción 2: SQL Directo (ALTERNATIVA)

Si prefieres no usar Alembic en producción:

```sql
-- Conectarse a la BD de producción
psql -U postgres -d nombre_bd_produccion

-- Ejecutar
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_service BOOLEAN DEFAULT FALSE;

-- Verificar
\d products
```

Luego marcar la migración como aplicada:
```bash
alembic stamp head
```

---

## 🔍 Verificación Post-Despliegue

### 1. Verificar que la columna existe:
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'is_service';
```

**Resultado esperado:**
```
 column_name | data_type | column_default 
-------------+-----------+----------------
 is_service  | boolean   | false
```

### 2. Verificar que el backend funciona:
```bash
curl https://tu-dominio.com/api/v1/products/ | jq '.[0].is_service'
```

**Resultado esperado:** `false` o `true`

### 3. Crear un producto de prueba:
```bash
curl -X POST https://tu-dominio.com/api/v1/products/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Servicio de Prueba",
    "price": 50.00,
    "is_service": true,
    "category_id": 1
  }'
```

---

## 🛡️ Plan de Rollback (Si algo sale mal)

Si por alguna razón necesitas revertir:

### 1. Revertir la migración de Alembic:
```bash
alembic downgrade -1
```

### 2. O eliminar la columna manualmente:
```sql
ALTER TABLE products DROP COLUMN IF EXISTS is_service;
```

### 3. Revertir el código:
```bash
git revert HEAD
git push
```

---

## 📋 Checklist de Despliegue

- [ ] **Backup de la base de datos de producción**
  ```bash
  pg_dump -U postgres nombre_bd > backup_antes_is_service.sql
  ```

- [ ] **Hacer commit y push de los cambios**
  ```bash
  git add .
  git commit -m "feat: add is_service field"
  git push
  ```

- [ ] **En producción: Pull y ejecutar migraciones**
  ```bash
  git pull
  alembic upgrade head
  ```

- [ ] **Reiniciar el backend**

- [ ] **Verificar que la columna existe** (SQL query)

- [ ] **Verificar que el API responde correctamente**

- [ ] **Crear un producto de servicio de prueba**

- [ ] **Verificar que el frontend muestra el checkbox**

---

## ❓ Preguntas Frecuentes

### ¿Por qué tuvimos el error en desarrollo?

Porque ejecutamos el SQL directo **antes** de que Alembic intentara crear la columna. En producción esto no pasará porque solo ejecutaremos Alembic.

### ¿Qué pasa con los productos existentes?

Todos los productos existentes tendrán `is_service = false` por defecto. No afecta su funcionamiento.

### ¿Necesito actualizar el frontend también?

Sí, pero el frontend es compatible hacia atrás. Si despliegas solo el backend primero, no habrá problemas. El checkbox simplemente no aparecerá hasta que despliegues el frontend.

### ¿Puedo desplegar en horario de producción?

**Sí, es seguro**. La migración solo agrega una columna con valor por defecto. No afecta datos existentes ni funcionalidad actual.

---

## 🎯 Resumen

**Para producción:**
1. ✅ Hacer backup
2. ✅ `git pull`
3. ✅ `alembic upgrade head`
4. ✅ Reiniciar backend
5. ✅ Verificar

**Tiempo estimado:** 5-10 minutos

**Riesgo:** Bajo (solo agrega una columna)

**Rollback:** Fácil (revertir migración)
