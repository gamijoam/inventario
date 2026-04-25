# 🧪 QA MANUAL - FASE 3

**Proyecto:** Rediseño Módulo de Taller  
**Fecha:** 31 de Marzo de 2026  
**Fase:** 3 - Testing & QA  
**Duración Estimada:** 4 horas  

---

## 📋 CASOS DE PRUEBA - CREAR ORDEN (Wizard)

### CP-1: Completar wizard 4 pasos
**Precondición:** Estar en dashboard, clickear "+ Nueva Orden"

**Pasos:**
1. Paso 1: Buscar cliente existente
   - [ ] Input de búsqueda aparece
   - [ ] Autocomplete funciona
   - [ ] Cliente se selecciona
   - [ ] Info cliente muestra correctamente

2. Paso 2: Seleccionar equipo
   - [ ] 4 tipos de dispositivo aparecen
   - [ ] Se puede cambiar selección
   - [ ] Campos de marca/modelo funcionan
   - [ ] Serial es opcional
   - [ ] Patrón solo muestra si checkbox activo

3. Paso 3: Diagnóstico
   - [ ] Textarea acepta texto
   - [ ] Plantillas rápidas aparecen
   - [ ] Click en plantilla auto-llena
   - [ ] Garantía se selecciona correctamente

4. Paso 4: Confirmación
   - [ ] Preview muestra todo correcto
   - [ ] Botón "Atrás" funciona
   - [ ] Botón "Crear" crea orden

**Resultado Esperado:** 
- [ ] Orden creada con ticket visible
- [ ] Toast "Orden SRV-XXX creada"
- [ ] Ticket se imprime automáticamente
- [ ] Modal se cierra
- [ ] Dashboard actualiza (tarjeta nueva aparece)

---

### CP-2: Validaciones wizard
**Escenario:** Intentar avanzar sin completar datos

**Pasos:**
1. Click Siguiente sin cliente → [ ] Error toast
2. Click Siguiente sin marca/modelo → [ ] Error toast
3. Click Siguiente sin diagnóstico → [ ] Error toast
4. Intentar crear sin confirmar datos → [ ] Error

---

## 📋 CASOS DE PRUEBA - VER/EDITAR ORDEN (Detail)

### CP-3: Abrir orden desde dashboard
**Precondición:** Tener órdenes en dashboard

**Pasos:**
1. [ ] Click en tarjeta abre detail
2. [ ] Header muestra ticket, cliente, estado
3. [ ] Stepper muestra progreso
4. [ ] Items listados correctamente
5. [ ] Sidebar con diagnóstico visible
6. [ ] Sidebar con timeline de pagos visible

---

### CP-4: Editar diagnóstico
**Precondición:** Orden abierta en detail

**Pasos:**
1. [ ] Panel diagnóstico muestra texto actual
2. [ ] Click lápiz abre textarea
3. [ ] Autofocus en textarea
4. [ ] Contador caracteres funciona
5. [ ] Click "Cancelar" cierra sin guardar
6. [ ] Click "Guardar":
   - [ ] Loading spinner aparece
   - [ ] Toast "Guardado"
   - [ ] Página NO recarga
   - [ ] Texto actualiza en panel

---

### CP-5: Agregar repuesto
**Precondición:** Orden abierta

**Pasos:**
1. [ ] Click "+ Agregar" abre modal
2. [ ] Tab "Repuesto" activo por defecto
3. [ ] Búsqueda autocomplete funciona
4. [ ] Resultados muestran stock
5. [ ] Seleccionar producto:
   - [ ] Precio auto-llena
   - [ ] Cantidad default 1
   - [ ] +/- buttons funcionan
6. [ ] Click "Agregar ítem":
   - [ ] Modal cierra
   - [ ] Toast "Ítem agregado"
   - [ ] Total se actualiza
   - [ ] Item aparece en lista

---

### CP-6: Agregar servicio manual
**Precondición:** Orden abierta

**Pasos:**
1. [ ] Click "+ Agregar"
2. [ ] Click tab "Servicio Manual"
3. [ ] Descripción input aparece
4. [ ] Selector técnico aparece
5. [ ] Llenar datos y agregar:
   - [ ] Item aparece en lista
   - [ ] Total se actualiza

---

### CP-7: Eliminar item
**Precondición:** Orden con items

**Pasos:**
1. [ ] Click ícono papelera en item
2. [ ] Confirm dialog aparece
3. [ ] Click confirmar:
   - [ ] Item desaparece
   - [ ] Total se recalcula
   - [ ] Toast "Ítem eliminado"

---

### CP-8: Registrar pago
**Precondición:** Orden con total pendiente

**Pasos:**
1. [ ] Click "+ Agregar abono" en timeline
2. [ ] Form aparece (emerald-50)
3. [ ] Ingresar monto:
   - [ ] Input acepta decimales
   - [ ] Validar > 0
4. [ ] Seleccionar método
5. [ ] Click "Guardar":
   - [ ] Form desaparece
   - [ ] Timeline se actualiza
   - [ ] Barra de progreso se mueve
   - [ ] Toast "Pago registrado"

---

### CP-9: Cambiar estado
**Precondición:** Orden en estado actual

**Pasos:**
1. [ ] Stepper muestra estado actual (◆ azul)
2. [ ] Botón "Avanzar" visible
3. [ ] Click "Avanzar":
   - [ ] Estado avanza a siguiente
   - [ ] Stepper visualización actualiza
   - [ ] Toast "Orden marcada como..."

---

### CP-10: Imprimir ticket
**Precondición:** Impresora conectada

**Pasos:**
1. [ ] Click [🖨️ Imprimir]
2. [ ] Toast "Enviado a impresora"
3. [ ] Ticket sale por ESC/POS térmica

---

## 📋 CASOS DE PRUEBA - DASHBOARD (List)

### CP-11: Listar órdenes
**Precondición:** Sistema con órdenes

**Pasos:**
1. [ ] Dashboard carga
2. [ ] Tarjetas se muestran en grid
3. [ ] Información correcta en cada tarjeta
4. [ ] Responsive:
   - [ ] Mobile: 1 columna
   - [ ] Tablet: 2 columnas
   - [ ] Desktop: 3 columnas

---

### CP-12: Filtrar órdenes
**Precondición:** Dashboard abierto

**Pasos:**
1. Click "Hoy":
   - [ ] Solo órdenes de hoy aparecen
2. Click "En Proceso":
   - [ ] Solo órdenes IN_PROGRESS
3. Click "Listo":
   - [ ] Solo órdenes READY
4. Click "Todas":
   - [ ] Todas las órdenes aparecen

---

### CP-13: Buscar órdenes
**Precondición:** Dashboard abierto

**Pasos:**
1. [ ] Escribir ticket: SRV-001
   - [ ] Filtra por ticket
2. [ ] Escribir cliente: Juan
   - [ ] Filtra por nombre
3. [ ] Escribir IMEI: 12345678
   - [ ] Filtra por serial
4. [ ] Borrar búsqueda:
   - [ ] Muestra todas nuevamente

---

### CP-14: Estadísticas en tiempo real
**Precondición:** Dashboard abierto

**Pasos:**
1. [ ] Card "Hoy" muestra cantidad correcta
2. [ ] Card "En Proceso" actualiza
3. [ ] Card "Listas" actualiza
4. [ ] Card "Pendiente" muestra monto total

---

## 🖥️ PRUEBAS DE RESPONSIVE

### CP-15: Mobile (<768px)
**Dispositivo:** iPhone SE, Android pequeño

**Verificar:**
- [ ] Buttons min 44x44px
- [ ] Text legible sin zoom
- [ ] Modal fullscreen bottom
- [ ] Sidebar collapsa
- [ ] Inputs accesibles
- [ ] Tap targets no solapados
- [ ] Scroll smooth
- [ ] Keyboard no cubre inputs

### CP-16: Tablet (768px-1024px)
**Dispositivo:** iPad, Samsung Tab

**Verificar:**
- [ ] 2 columnas en grid
- [ ] Sidebar visible
- [ ] Comfortable spacing
- [ ] Modal centrada
- [ ] Touch gestures funcionan

### CP-17: Desktop (>1024px)
**Dispositivo:** Laptop 1920x1080

**Verificar:**
- [ ] 3 columnas en grid
- [ ] Sidebar fixed
- [ ] Hover effects activos
- [ ] Line length readable
- [ ] No overflow horizontal

---

## 🔌 PRUEBAS DE INTEGRACIÓN API

### CP-18: API Response correcta
**Precondición:** Backend respondiendo

**Pasos:**
1. [ ] GET /services/orders devuelve lista
2. [ ] GET /services/orders/{id} devuelve detalle
3. [ ] POST /services/orders crea orden
4. [ ] PATCH /services/orders/{id}/status actualiza
5. [ ] POST /services/orders/{id}/items agrega item
6. [ ] DELETE /services/orders/{id}/items/{id} elimina
7. [ ] POST /services/orders/{id}/payments registra pago

---

### CP-19: Manejo de errores API
**Escenario:** Simular errores backend

**Pasos:**
1. [ ] 404 Not Found → Toast error
2. [ ] 400 Bad Request → Toast detail
3. [ ] 500 Server Error → Toast generic
4. [ ] Timeout → Loading indefinido + timeout error
5. [ ] No internet → Error message

---

## 🎨 PRUEBAS DE INTERFAZ

### CP-20: Colores y estilos
**Verificar:**
- [ ] Status badges correctos por estado
- [ ] DiagnosisPanel fondo amarillo
- [ ] PaymentTimeline colores correctos
- [ ] Barra de progreso actualiza color
- [ ] Botones hover effects

### CP-21: Animaciones
**Verificar:**
- [ ] Loading spinner gira
- [ ] Transiciones suaves
- [ ] Hover effects sutiles
- [ ] Modal fade in/out
- [ ] Barra progreso anima

---

## ⚡ PRUEBAS DE PERFORMANCE

### CP-22: Carga inicial
**Escenario:** Dashboard carga

**Tiempos Objetivo:**
- [ ] Primera pintura: < 1s
- [ ] Dashboard interactivo: < 2s
- [ ] Órdenes listadas: < 3s

### CP-23: Operaciones CRUD
**Escenario:** Operaciones comunes

**Tiempos Objetivo:**
- [ ] Crear orden: < 2s
- [ ] Abrir orden: < 1s
- [ ] Guardar diagnóstico: < 1s
- [ ] Agregar ítem: < 1.5s

### CP-24: Con 100+ órdenes
**Precondición:** DB con muchas órdenes

**Verificar:**
- [ ] Dashboard carga sin lag
- [ ] Scroll smooth
- [ ] Búsqueda rápida
- [ ] Filtros instantáneos

---

## 📱 PRUEBAS DE NAVEGACIÓN

### CP-25: Flujo crear → ver → editar
**Pasos:**
1. [ ] Click "+ Nueva Orden"
2. [ ] Completar wizard
3. [ ] Orden creada
4. [ ] Click en tarjeta
5. [ ] Detail abre
6. [ ] Editar diagnóstico
7. [ ] Agregar ítem
8. [ ] Cambiar estado
9. [ ] Registrar pago

**Resultado:** Todos los pasos funcionan sin errors

---

### CP-26: Breadcrumb/Volver
**Pasos:**
1. [ ] Dashboard → Click orden → Detail
2. [ ] Click "← Volver"
3. [ ] Retorna a dashboard
4. [ ] Dashboard actualizado

---

## ✅ CHECKLIST FINAL QA

### Funcionalidad
- [ ] Crear orden (wizard 4 pasos)
- [ ] Ver orden (detail page)
- [ ] Editar diagnóstico (in-line save)
- [ ] Agregar items (modal)
- [ ] Eliminar items (confirm dialog)
- [ ] Ver pagos (timeline)
- [ ] Registrar pago (form)
- [ ] Cambiar estado (stepper)
- [ ] Imprimir (ESC/POS)
- [ ] Buscar/filtrar (dashboard)

### UX
- [ ] Mobile responsive
- [ ] Tablet responsive
- [ ] Desktop optimizado
- [ ] Colores correctos
- [ ] Animaciones suaves
- [ ] Mensajes claros

### Rendimiento
- [ ] Carga rápida
- [ ] CRUD sin lag
- [ ] 100+ órdenes smooth

### Seguridad
- [ ] Validaciones input
- [ ] No XSS
- [ ] No inyección SQL
- [ ] Errores no exponen datos

### Accesibilidad
- [ ] Focus visible
- [ ] Keyboard navigation
- [ ] Touch targets 44x44px
- [ ] Text contrast adecuado

---

## 📊 RESULTADO FINAL

**Fecha Prueba:** ___________  
**Tester:** ___________  
**Status:** [ ] PASS [ ] FAIL [ ] PARCIAL  

**Bugs Encontrados:**
```
1. 
2. 
3. 
```

**Notas:**
```

```

**Aprobado para FASE 4:** [ ] SÍ [ ] NO

---

**Generado:** 31 Marzo 2026  
**Versión:** 1.0 FASE 3 QA Manual
