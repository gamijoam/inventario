#!/bin/bash

echo "🚀 Iniciando migración de tablas de versión para tenants..."

# Obtener lista de schemas de tenants (excluyendo public y sistema)
SCHEMAS=$(docker exec db_prod psql -U postgres -d invensoft_db -t -c "
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('public', 'information_schema', 'pg_catalog', 'pg_toast')
    AND schema_name NOT LIKE 'pg_%'
    ORDER BY schema_name;
")

echo "📋 Schemas encontrados:"
echo "$SCHEMAS"
echo ""

for SCHEMA in $SCHEMAS; do
    SCHEMA=$(echo $SCHEMA | xargs) # Trim whitespace
    
    if [ ! -z "$SCHEMA" ]; then
        echo "🔧 Procesando schema: $SCHEMA"
        
        # Verificar si existe la tabla antigua
        EXISTS_OLD=$(docker exec db_prod psql -U postgres -d invensoft_db -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = '$SCHEMA' AND table_name = 'alembic_version');")
        EXISTS_OLD=$(echo $EXISTS_OLD | xargs)
        
        # Verificar si existe la tabla nueva
        EXISTS_NEW=$(docker exec db_prod psql -U postgres -d invensoft_db -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = '$SCHEMA' AND table_name = 'alembic_version_tenant');")
        EXISTS_NEW=$(echo $EXISTS_NEW | xargs)

        if [ "$EXISTS_NEW" = "t" ]; then
             echo "✅ La tabla nueva ya existe en $SCHEMA. Nada que hacer."
        elif [ "$EXISTS_OLD" = "t" ]; then
             echo "📦 Renombrando alembic_version -> alembic_version_tenant en $SCHEMA..."
             docker exec db_prod psql -U postgres -d invensoft_db -c "ALTER TABLE $SCHEMA.alembic_version RENAME TO alembic_version_tenant;"
             echo "✅ Renombrado exitoso."
        else
             echo "⚠️ No se encontró tabla de versiones en $SCHEMA. (Es un tenant nuevo o roto?)"
             # Opcional: Crear la tabla si se desea
        fi
        echo "-----------------------------------"
    fi
done

echo "✨ Migración de tablas completada!"
