# 29 — Workflow IA + MCP: Reglas de Deploy y Sincronización QA ↔ PROD

## Principio fundamental

> **QA es un espejo exacto de PROD en estructura.**
> Los mismos schemas, las mismas columnas, las mismas tablas.
> Los datos son distintos (QA tiene tenants de prueba, PROD tiene clientes reales).
> El código es el mismo (mismo repo `main`).

---

## Flujo obligatorio para CUALQUIER cambio

```
┌─────────────────────────────────────────────────────────────┐
│  1. Código → commit a main (siempre primero)                │
│  2. Migración SQL → aplicar en QA primero                   │
│  3. Build imagen → tag qa-* → deploy QA                     │
│  4. Pruebas en QA (verificar que todo funciona)             │
│  5. Telegram → Gabriel aprueba                              │
│  6. Migración SQL → aplicar en PROD (mismo script de QA)    │
│  7. Build imagen → tag prod-* → deploy PROD                 │
└─────────────────────────────────────────────────────────────┘
```

**NUNCA saltar pasos. NUNCA deployar a PROD antes de QA.**

---

## Excepciones permitidas (solo con aviso explícito)

| Situación | Acción permitida |
|-----------|-----------------|
| Bug crítico que rompe PROD para TODOS los tenants | Fix directo en PROD CON aviso inmediato. Luego sincronizar QA. |
| Fix de datos específico de un cliente (password reset, stock) | Aplicar en PROD directamente. Documentar en Cerebro. No aplica en QA (datos distintos). |

Cualquier otra situación: seguir el flujo completo.

---

## Reglas para migraciones SQL

### Al crear una migración nueva:
```markdown
## ⏳ PENDIENTE — nombre_migracion

Estado: QA ⏳ | PROD ⏳

\`\`\`sql
ALTER TABLE {schema}.tabla ADD COLUMN ...;
\`\`\`
```

### Al aplicar en QA:
```markdown
Estado: QA ✅ | PROD ⏳
```

### Al aplicar en PROD (después de aprobación):
```markdown
Estado: QA ✅ | PROD ✅ (fecha)
```

---

## Reglas para imágenes Docker

| Tag | Cuándo se usa |
|-----|--------------|
| `qa-*` | Solo para QA — nunca en PROD |
| `prod-*` | Solo para PROD — debe haber pasado por QA |

Las imágenes de PROD **siempre** deben construirse del mismo código que ya está probado en QA.

---

## Cómo verificar que QA y PROD están sincronizados

```bash
# Verificar estructura de BD (debe ser idéntica)
python3 << 'EOF'
# Comparar columnas de tablas críticas entre QA (schema solucionescodecraft)
# y PROD (schema oscardemo)
# Si hay diferencias → aplicar migración faltante en el ambiente que le falta
EOF

# Verificar versión del código
cd /root/deploy/qa/code && git log --oneline -1
# Ambos ambientes deben estar en el mismo commit
```

---

## Qué hacer cuando QA y PROD se desincronizaron

### Caso A — PROD está más adelante en código que QA
```bash
# Deploy QA con el mismo código
cd /root/deploy/qa/code
docker build -f ferreteria_refactor/backend_api/Dockerfile \
  -t gamijoam/ferreteria-backend:qa-sync-$(date +%Y%m%d) .
# Deploy QA...
```

### Caso B — PROD tiene migraciones SQL que QA no tiene
```bash
# Aplicar en QA el mismo script que se aplicó en PROD
docker exec db_qa_server psql -U postgres -d invensoft_qa -c "
DO \$\$ DECLARE s TEXT; BEGIN
  FOR s IN SELECT schema_name FROM public.tenants WHERE is_active=true LOOP
    EXECUTE '... misma migración ...';
  END LOOP;
END \$\$;"
```

### Caso C — QA tiene código nuevo que aún no está en PROD
```
Situación normal → esperar aprobación de Gabriel → deploy PROD
```

---

## Comandos del MCP para deploy

```bash
# Verificar estado
docker ps --format "{{.Names}} | {{.Image}}"

# Build QA backend
cd /root/deploy/qa/code
docker build -f ferreteria_refactor/backend_api/Dockerfile \
  -t gamijoam/ferreteria-backend:qa-DESCRIPCION .

# Build QA frontend
cd /root/deploy/qa/code/ferreteria_refactor/frontend_web
docker build --no-cache -f Dockerfile.prod \
  --build-arg VITE_API_URL=https://api-qa.miinventariofacil.com/api/v1 \
  -t gamijoam/ferreteria-app:qa-DESCRIPCION .

# Build PROD (solo tras aprobación)
docker build -f ferreteria_refactor/backend_api/Dockerfile \
  -t gamijoam/ferreteria-backend:prod-DESCRIPCION .
```

---

## Trigger para CI/CD (bot de Telegram)

```bash
cd /root/deploy/qa/code
git commit --allow-empty -m "chore: trigger deploy prod — DESCRIPCION"
git push origin main
# Esperar mensaje del bot en Telegram
# Gabriel aprueba → CI/CD deploya PROD automáticamente
```
