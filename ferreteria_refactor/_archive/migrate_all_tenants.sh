#!/bin/bash
# Script para ejecutar migraciones en TODOS los schemas de tenants

echo "🔍 Buscando schemas de tenants en la base de datos..."

# Obtener lista de schemas (excluyendo public, pg_*, information_schema)
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

# Ejecutar migraciones para cada schema
for SCHEMA in $SCHEMAS; do
    # Trim whitespace
    SCHEMA=$(echo $SCHEMA | xargs)
    
    if [ ! -z "$SCHEMA" ]; then
        echo "🚀 Ejecutando migraciones para schema: $SCHEMA"
        docker exec backend_prod alembic -x tenant=$SCHEMA upgrade head
        
        if [ $? -eq 0 ]; then
            echo "✅ Migraciones completadas para: $SCHEMA"
        else
            echo "❌ Error en migraciones para: $SCHEMA"
        fi
        echo "---"
    fi
done

echo ""
echo "✨ Proceso completado!"
