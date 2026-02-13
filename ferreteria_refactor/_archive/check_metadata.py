from backend_api.database.metadata_split import tenant_metadata, shared_metadata

print("SHARED METADATA TABLES:", list(shared_metadata.tables.keys()))
print("TENANT METADATA TABLES:", list(tenant_metadata.tables.keys()))
