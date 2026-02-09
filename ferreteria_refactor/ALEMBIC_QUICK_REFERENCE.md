# Multi-Branch Alembic Quick Reference

## 🎯 Overview

Your Alembic migrations are now split into two independent branches:
- **`shared`**: Public schema tables (`tenants`, `users`, `tenant_payments`)
- **`tenant`**: Tenant-specific tables (`products`, `sales`, `customers`, etc.)

---

## 📝 Creating Migrations

### Shared Migration (Public Schema)
```bash
alembic revision --autogenerate -m "add_admin_logs_table" -x branch=shared
```

### Tenant Migration (Tenant Schemas)
```bash
# Must specify a tenant schema for autogenerate to work
alembic revision --autogenerate -m "add_product_reviews" -x branch=tenant -x tenant=ferreteria
```

---

## 🚀 Applying Migrations

### Apply All Migrations (Recommended)
```bash
python apply_migrations.py
```

### Apply Only Shared Migrations
```bash
python apply_migrations.py --shared-only
```

### Apply Only Tenant Migrations
```bash
python apply_migrations.py --tenant-only
```

### Apply to Specific Tenant
```bash
python apply_migrations.py --tenant ferreteria
```

### Manual Application (Advanced)
```bash
# Shared migrations
alembic upgrade shared@head -x branch=shared

# Tenant migrations (single tenant)
alembic upgrade tenant@head -x branch=tenant -x tenant=ferreteria
```

---

## 🔍 Checking Migration Status

### View Shared Migration History
```bash
alembic history -x branch=shared
```

### View Tenant Migration History
```bash
alembic history -x branch=tenant -x tenant=ferreteria
```

### Check Current Version (Shared)
```bash
alembic current -x branch=shared
```

### Check Current Version (Tenant)
```bash
alembic current -x branch=tenant -x tenant=ferreteria
```

---

## 📂 Directory Structure

```
alembic/
├── versions/
│   ├── shared/          # Public schema migrations
│   │   ├── README.md
│   │   └── xxxxx_add_billing.py
│   └── tenant/          # Tenant schema migrations
│       ├── README.md
│       └── yyyyy_add_products.py
├── env.py               # Branch detection logic
├── metadata_split.py    # Metadata separation
└── script.py.mako       # Migration template
```

---

## ⚠️ Important Notes

1. **Always specify branch**: Use `-x branch=shared` or `-x branch=tenant`
2. **Tenant migrations require schema**: Must include `-x tenant=schema_name`
3. **Use apply_migrations.py for deployment**: Ensures correct order (shared → tenants)
4. **Version tables are isolated**:
   - Shared: `public.alembic_version_shared`
   - Tenant: `{schema}.alembic_version_tenant`

---

## 🐛 Troubleshooting

### Error: "Invalid branch"
**Solution**: Add `-x branch=shared` or `-x branch=tenant` to your command

### Error: "Tenant migrations require -x tenant=schema_name"
**Solution**: Add `-x tenant=ferreteria` (or your tenant schema name)

### Migrations not detected
**Solution**: Ensure your model is imported in `metadata_split.py`

### Version table conflicts
**Solution**: Check that you're using the correct branch argument

---

## 🔄 Migration Workflow Example

```bash
# 1. Create a new shared table (e.g., admin_logs)
# Edit backend_api/models/admin.py and add AdminLog model

# 2. Generate shared migration
alembic revision --autogenerate -m "add_admin_logs" -x branch=shared

# 3. Review the generated migration file
# Located in: alembic/versions/shared/xxxxx_add_admin_logs.py

# 4. Apply to production
python apply_migrations.py --shared-only

# 5. Verify
alembic current -x branch=shared
```

---

## 📞 Need Help?

- Check `implementation_plan.md` for detailed architecture explanation
- Review `alembic/versions/shared/README.md` and `alembic/versions/tenant/README.md`
- Run `python apply_migrations.py --help` for script options
