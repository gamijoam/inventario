-- Script para recrear la base de datos local desde cero
-- Ejecutar con: psql -U postgres -f reset_local_db.sql

-- Terminar conexiones activas
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'prueba_db'
  AND pid <> pg_backend_pid();

-- Eliminar base de datos
DROP DATABASE IF EXISTS prueba_db;

-- Crear base de datos limpia
CREATE DATABASE prueba_db;

-- Conectar a la nueva base de datos
\c prueba_db

-- Mensaje de confirmación
\echo 'Base de datos prueba_db recreada exitosamente'
\echo 'Ahora reinicia el servidor FastAPI para que ejecute las migraciones'
