# Configurar Impresoras Térmicas Múltiples en POS

## Concepto Básico

Las impresoras térmicas WiFi y cableadas funcionan igual — se conectan por **IP** (TCP/IP RAW puerto 9100). La diferencia es solo el medio físico, no el protocolo.

---

## Escenario 1: Una sola impresora (Ya funcionando)

```
PC → USB/COM → Impresora térmica
```

No hay cambios. Ya está configurada.

---

## Escenario 2: Dos impresoras (Cableada + WiFi)

### Diagrama

```
                    ┌──────────────────┐
                    │   RED LOCAL      │
                    │  192.168.1.x     │
                    └────────┬─────────┘
                             │          │
              ┌──────────────┘          └──────────────┐
              │                                        │
         ┌────┴─────┐                            ┌──────┴──────┐
         │ Impresora│                            │ Impresora  │
         │ Cableada │                            │ WiFi       │
         │ USB/COM  │                            │ 192.168.1.100
         │ Ticket   │                            │ Puerto 9100
         └────┬─────┘                            └──────┬──────┘
              │                                        │
              └──────────┬─────────────────────────────┘
                         │
                    ┌────┴─────┐
                    │   PC     │
                    │  POS     │
                    └──────────┘
```

### Paso 1: Configurar la impresora WiFi

1. Conectar la impresora WiFi al router/repetidor
2. Desde el panel de la impresora o su app, asignar **IP fija**
   - Ejemplo: `192.168.1.100`
   - Máscara: `255.255.255.0`
   - Gateway: `192.168.1.1`
3. Verificar que esté en la misma red que la PC del POS
4. Probar impresión desde la app de la impresora

### Paso 2: Registrar la segunda impresora en el sistema

1. Ir a: **Configuración → Impresoras**
2. Agregar nueva impresora
3. Completar:

```
Nombre:        Cocina WiFi
Tipo:         Red (WiFi/Ethernet)
Dirección IP:  192.168.1.100
Puerto:       9100
Propósito:    Comandera de cocina
```

4. Guardar

### Paso 3: Asignar用途 en cada estación

En el POS, al momento de imprimir ticket:

```
Impresora principal (cableada) → Ticket para el cliente
Impresora secundaria (WiFi)    → Comanda para cocina
```

---

## Escenario 3: Tres impresoras

```
PC → Impresora 1 (Ticket)     → USB
PC → Impresora 2 (Cocina)      → WiFi 192.168.1.100
PC → Impresora 3 (Barra)       → WiFi 192.168.1.101
```

Registrar cada una con su IP y propósito.

---

## Configuración desde el POS

### Agregar impresora

```
1. Menú → Configuración → Impresoras
2. Click "Agregar impresora"
3. Llenar formulario:
   - Nombre: identificador (ej: "Cocina", "Barra", "Cliente")
   - Tipo: USB, Serial (COM), o Red (WiFi/Ethernet)
   - IP: dirección de la impresora (ej: 192.168.1.100)
   - Puerto: 9100 (predeterminado para ESC/POS RAW)
   - Roles: ticket, cocina, etc.
4. Guardar
```

### Asignar uso por estación

```
POS → Config → Estación:
  - Impresora de tickets: USB/Principal
  - Impresora de cocina: WiFi/Cocina
  - Impresora de barra: WiFi/Barra
```

---

## Impresión Simultánea

Cuando se completa una venta:

```
El sistema envía el mismo pedido a TODAS las impresoras asignadas
al mismo tiempo (en paralelo, no espera una para enviar la otra)
```

| Impresora | Recibe | Propósito |
|-----------|--------|-----------|
| Principal | Ticket de venta | Cliente paga y recibe |
| Cocina | Comanda (orden de preparación) | Chef prepara |
| Barra | Comanda de bebidas | Bartender prepara |

---

## Solución de Problemas

### La WiFi no imprime

1. **Verificar IP**: Hacer ping desde la PC a la impresora
   ```
   ping 192.168.1.100
   ```
2. **Verificar que el puerto 9100 está abierto**
   ```
   telnet 192.168.1.100 9100
   ```
3. **Reiniciar la impresora WiFi**
4. **Verificar que la PC y la impresora están en la misma red**

### La cableada sí funciona pero la WiFi no

1. La WiFi tiene su propia IP → verificar que sea fija, no dinámica
2. Si la IP cambia, el sistema ya no puede encontrarla

### Impresora WiFi con IP dinámica (problema)

Si la impresora toma IP automática (DHCP), podría cambiar y perder la conexión.

**Solución**: Configurar IP fija en la impresora WiFi.

---

## Resumen Rápido

| Paso | Acción |
|------|--------|
| 1 | Configurar IP fija en la impresora WiFi |
| 2 | Registrar la impresora en el POS (IP + puerto 9100) |
| 3 | Asignar propósito (ticket, cocina, barra) |
| 4 | Guardar y probar |

---

## Notas Importantes

- **No importa si es WiFi o cableada** — ambas usan TCP/IP
- **Puerto estándar ESC/POS**: 9100 (RAW)
- **Misma red**: La PC y la impresora deben estar en la misma red
- **IP fija**: La WiFi debe tener IP fija para no perder conexión
- **Firewall**: Asegurarse que el puerto 9100 no esté bloqueado