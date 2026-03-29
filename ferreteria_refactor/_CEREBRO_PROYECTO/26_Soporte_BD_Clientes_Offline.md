# 26 — Soporte y Acceso a BD en Clientes Offline (.exe)

> Cómo intervenir la base de datos de un cliente que tiene instalada la versión Windows (.exe).

---

## Arquitectura de datos en el cliente

```
C:\Users\<cliente>\AppData\Local\MiInventarioFacil\
├── postgresql\
│   ├── bin\          ← psql.exe, pg_dump.exe, pg_restore.exe, etc.
│   └── data\         ← archivos físicos PG (PG_VERSION, base/, global/)
└── backend\
    ├── .env          ← config (SECRET_KEY, DATABASE_URL, etc.)
    ├── backups\      ← backups automáticos diarios (.sql.gz, últimos 7)
    └── media\        ← imágenes de productos subidas
```

- **Base de datos:** `miinventariofacil`
- **Schema de datos:** `default` (modo SINGLE_TENANT — todos los datos del negocio aquí)
- **Schema global:** `public` (usuarios, audit_logs)
- **Usuario PG:** `postgres` sin contraseña

---

## Datos de conexión (DBeaver / HeidiSQL / pgAdmin)

| Campo | Valor |
|-------|-------|
| Host | `localhost` (local) o IP del cliente (remoto) |
| Puerto | `5432` |
| Usuario | `postgres` |
| Contraseña | *(vacía)* |
| Base de datos | `miinventariofacil` |

### Configurar search_path en DBeaver (recomendado)

Para no tener que escribir `SET search_path` cada vez:

1. Clic derecho en la conexión → **Edit Connection**
2. Pestaña **PostgreSQL** → campo **Search path**
3. Escribir: `"default", public`
4. Guardar

Así cada query ya tiene el contexto correcto automáticamente.

---

## Regla crítica — siempre usar search_path

Todas las tablas del negocio están en el schema `default`. Sin el search_path las queries caen a `public` y no encuentran nada.

```sql
-- Siempre al inicio de cualquier sesión manual
SET search_path TO "default", public;

-- Ejemplos
SELECT * FROM products LIMIT 10;
SELECT * FROM sales ORDER BY created_at DESC LIMIT 5;
UPDATE products SET stock = 50 WHERE id = 123;
```

---

## Opción A — Acceso local (presencial o TeamViewer)

La forma más simple. El cliente tiene `psql.exe` dentro de su propia instalación.

### Con psql (línea de comandos)
```bat
cd C:\Users\<cliente>\AppData\Local\MiInventarioFacil
postgresql\bin\psql.exe -h localhost -p 5432 -U postgres -d miinventariofacil
```

Dentro de psql:
```sql
SET search_path TO "default", public;
-- hacer la intervención
\q
```

### Con DBeaver / HeidiSQL instalado en la máquina del cliente
- Conectar con los datos de arriba
- Configurar search_path como se explicó
- Operar normalmente

---

## Opción B — El cliente manda el backup

Los backups automáticos están en `backend\backups\` (archivos `.sql.gz`).

**Flujo:**
1. El cliente te manda el archivo `.sql.gz` más reciente
2. Restauras en tu Postgres local:
   ```bash
   gunzip -c backup_file.sql.gz | psql -U postgres -d miinventariofacil_test
   ```
3. Haces la intervención localmente
4. Generas un dump limpio:
   ```bash
   pg_dump -U postgres -n default miinventariofacil_test > fix.sql
   ```
5. El cliente lo restaura (o tú lo aplicas via TeamViewer)

---

## Opción C — Acceso remoto directo a PostgreSQL

Por defecto PG solo escucha en `127.0.0.1`. Para acceso remoto hay que modificar dos archivos **en la máquina del cliente**:

### 1. `postgresql\data\postgresql.conf`
Buscar y cambiar:
```
listen_addresses = 'localhost'
```
Por:
```
listen_addresses = '*'
```

### 2. `postgresql\data\pg_hba.conf`
Agregar al final:
```
host    all    all    0.0.0.0/0    trust
```
> `trust` = sin contraseña. Si se quiere más seguro, usar `md5` y asignar contraseña al usuario postgres primero.

### 3. Reiniciar PostgreSQL en el cliente
Cerrar la app (stop.bat o cerrar ventana) y volver a abrir (start.bat o el .exe launcher).

### 4. Firewall Windows en el cliente
Abrir puerto 5432:
- Panel de control → Windows Defender Firewall → Reglas de entrada → Nueva regla
- Tipo: Puerto → TCP → Puerto 5432 → Permitir

### 5. Conectar desde tu máquina
Usar DBeaver/HeidiSQL con `Host = IP del cliente` (IP local de la red o IP pública si tiene).

> **Importante:** Revertir los cambios de postgresql.conf y pg_hba.conf después de terminar. No dejar el puerto abierto permanentemente.

---

## Cómo obtener la IP del cliente

En la máquina del cliente, abrir CMD y ejecutar:
```bat
ipconfig
```
Buscar "Dirección IPv4" de la conexión activa (Ethernet o Wi-Fi).

---

## Generar backup manual desde la app

Desde la interfaz web del cliente: **Configuración → Respaldos → Crear respaldo ahora**

O desde la API (con sesión activa):
```
POST http://localhost:8000/backups/create
Authorization: Bearer <token>
```

---

## Reset de contraseña de usuario admin

Si el cliente olvidó su contraseña de acceso a la app:

```sql
SET search_path TO "default", public;

-- Ver usuarios
SELECT id, username, email, role FROM users;

-- Generar nuevo hash para "admin123" (bcrypt)
-- Opción: usar el endpoint de la API si aún puede acceder con otro usuario
-- Opción directa: actualizar con hash pre-generado

UPDATE users
SET hashed_password = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMZJd.pJ7DG/9O.Md.nnLXue2G'
WHERE username = 'admin';
-- Hash de arriba corresponde a "admin123" con bcrypt rounds=12
```

> Para generar un hash fresco: `python -c "from passlib.context import CryptContext; print(CryptContext(['bcrypt']).hash('nueva_clave'))"`

---

## Resumen rápido — ¿qué usar según el caso?

| Situación | Herramienta recomendada |
|-----------|------------------------|
| Estoy físicamente con el cliente | DBeaver en su PC o psql desde CMD |
| Acceso remoto con TeamViewer/AnyDesk | DBeaver instalado en su PC, conectar a localhost |
| Cliente manda el backup | Restaurar local, intervenir, mandar de vuelta |
| Red local compartida (mismo wifi/LAN) | Acceso remoto directo (Opción C) |
| Cliente lejos, sin TeamViewer | Opción C con IP pública + port forwarding en su router |
