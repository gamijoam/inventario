# Recordatorios y Pendientes

> Archivo gestionado por Claude Code. No editar manualmente.

---

## [009] SQL PENDIENTE — Aplicar a PRODUCCION
**Fecha:** 2026-03-12 18:00
**Estado:** pendiente
**Categoria:** deploy

SQL pendiente para PROD: M001 (is_active) y M002 (indices sales).
Ver detalle completo en: `_CEREBRO_PROYECTO/20_Migraciones_SQL_Pendientes.md`

---

## [012] Deploy backend al VPS — min_price/max_price + AND search
**Fecha:** 2026-03-14
**Estado:** pendiente
**Categoria:** deploy

El endpoint `/api/v1/products/catalog` tiene 2 cambios no desplegados:
1. Filtro por rango de precio (`min_price`, `max_price` query params)
2. Busqueda multi-token AND (`and_(*token_conditions)`)

Mientras no se despliegue, el bot filtra client-side (funciona pero menos eficiente).

```bash
# Deploy:
./deploy_images.sh  # build + push
ssh root@212.28.176.157 "cd /root/deploy/qa && docker compose pull backend_qa && docker compose up -d backend_qa"
```

---

## [013] Deploy bot Telegram al VPS
**Fecha:** 2026-03-14
**Estado:** pendiente
**Categoria:** deploy

Bot corriendo en local. Para produccion, agregar al docker-compose o correr standalone.
Ver opciones en `_CEREBRO_PROYECTO/21_Bot_Telegram.md` seccion 9.

---
