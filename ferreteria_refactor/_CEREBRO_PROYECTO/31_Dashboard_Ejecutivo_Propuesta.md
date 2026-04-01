# 31 — Dashboard Ejecutivo — Análisis y Propuesta

**Fecha:** 2026-04-01  
**Estado:** Propuesta aprobada — pendiente desarrollo

---

## Diagnóstico del Dashboard actual

### Dashboard.jsx (pantalla de inicio)
- Solo muestra datos de **HOY** — sin selector de periodo
- 5 KPIs fijos: ingresos hoy, ganancia, créditos, artículos vendidos, transacciones
- 1 gráfico: área de 7 días (solo ventas, sin más métricas)
- Sin comparativa real (el % "12.5%" de ganancia es hardcodeado)
- Sin rendimiento por empleado
- Sin integración del módulo Taller
- Sin alertas accionables
- CASHIER ve un panel diferente y simplificado (CashierDashboard)

### ReportsCenter.jsx (módulo de reportes)
- Tiene comparativa de periodos ✅
- Tiene filtro de fechas ✅
- Tiene métricas reales con % de cambio ✅
- Pero es demasiado técnico para uso diario del dueño

### Backend — Endpoints disponibles (sin usar en dashboard)
- `/reports/sales/period-comparison` — comparar dos periodos
- `/reports/top-products` — top productos por cantidad o ingreso
- `/reports/profit/sales` — rentabilidad por periodo
- `/reports/sales/by-payment-method` — distribución por método de pago
- `/reports/sales/by-customer` — top clientes
- `/reports/profit/month` — ganancia mensual
- `/commissions/summary` — comisiones por empleado
- `/services/orders/status/ready` — órdenes del taller pendientes

### Conclusión del diagnóstico
El backend ya tiene todo lo necesario. El gap es en el frontend:
el dashboard de inicio no aprovecha nada de esos endpoints.

---

## Propuesta — Executive Dashboard v2

### Concepto
Un **Command Center** en una sola pantalla que responde en 10 segundos
tres preguntas clave del dueño:
1. ¿Cómo va mi negocio hoy vs ayer/semana pasada?
2. ¿Qué necesita mi atención ahora mismo?
3. ¿Quiénes están rindiendo bien y qué productos se mueven?

### Selector de periodo (nuevo)
Reemplaza el "solo hoy" con pills rápidas:
[Hoy] [Ayer] [Esta semana] [Este mes] [Rango personalizado]
Compara automáticamente con el periodo equivalente anterior.

### Sección 1 — KPIs con tendencia real (6 tarjetas)
Cada tarjeta muestra valor actual + % vs periodo anterior + tendencia visual:
1. Ingresos (USD) — vs periodo anterior
2. Ganancia real (USD) — vs periodo anterior
3. Ticket promedio — vs periodo anterior
4. Total transacciones — vs periodo anterior
5. Órdenes taller activas — cantidad en RECEIVED/IN_PROGRESS/READY
6. Créditos vencidos — deudas con más de 30 días

### Sección 2 — Gráficos (2 columnas)
- **Izquierda (2/3):** Gráfico combinado (barras de ventas + línea de ganancia) con selector de granularidad: día / semana / mes
- **Derecha (1/3):** Métodos de pago (donut) + breakdown de ingresos por módulo (POS vs Taller)

### Sección 3 — Panel de alertas accionables (nuevo)
Tarjetas de colores que aparecen solo si hay algo relevante:
- 🔴 "X productos con stock en cero"
- 🟡 "X órdenes del taller en READY sin cobrar (lleva Y días)"
- 🟡 "X clientes con deuda vencida > 30 días"
- 🔵 "X comisiones pendientes de pagar esta semana"
Con botón directo que navega al lugar correcto del sistema.

### Sección 4 — Top performers (2 columnas)
- **Izquierda:** Top 5 productos más vendidos del periodo (con variación vs anterior)
- **Derecha:** Top 5 empleados por ventas del periodo (con sus comisiones generadas)

### Sección 5 — Actividad reciente (mejorada)
La tabla actual de últimas 10 ventas se mejora con:
- Columna de módulo (POS / Taller)
- Vendedor que hizo la venta
- Estado de pago (pagado / crédito)
- Filtro rápido por tipo

---

## Plan de implementación

### Archivos a crear/modificar
- `Dashboard.jsx` — reescritura completa del panel de admin
- `services/unifiedReportService.js` — agregar métodos faltantes
- (sin cambios de backend — todo existe)

### Estimación de esfuerzo
- Backend: 0 días (todos los endpoints existen)
- Frontend: 2-3 sesiones de desarrollo

### Compatibilidad
- Responsive: mobile / tablet / desktop
- El CashierDashboard (panel del cajero) NO se toca
- Feature flag: no requerido (es mejora visual del admin)
