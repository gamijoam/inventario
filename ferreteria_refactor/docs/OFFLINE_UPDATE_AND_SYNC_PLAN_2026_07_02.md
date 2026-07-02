# Offline updates and sync foundation - 2026-07-02

## Goal

Avoid rebuilding and redistributing the full 2GB offline installer for every normal release, while preparing a safer sync path for sales, cash, returns and catalog changes.

## What changed in this phase

- Added `local/update.bat` for installed Windows clients.
- Added `local/updater/update_offline.py`, a stdlib-only updater that can run with the embedded Python.
- Added `local/build_update_patch.py`, which publishes small update packages and a manifest.
- Updated `local/build_package.sh` so new offline installs include the updater.
- Added migration `migrations/2026_07_02_add_offline_sync_outbox.sql`.
- Applied the migration in QA.

## Update model

The full installer remains only for first install or runtime changes:

- PostgreSQL portable
- Python embedded
- Visual C++ redistributable
- Launcher runtime

Normal releases use small packages:

- `frontend-<version>.zip`
- `backend-<version>.zip`
- `updater-<version>.zip`
- `manifest.json`

The updater downloads the manifest, compares versions, validates SHA256, creates backups, applies packages and rolls back if an apply step fails.

## Offline sync foundation

The new migration creates these tenant tables:

- `sync_outbox`: durable local event queue for sales, returns, cash movements, layaways and future offline events.
- `sync_state`: per-module cursor/status for catalog, sales, cash, returns and layaways.
- `sync_conflicts`: visible conflict queue when the cloud rejects or needs manual review.

This does not yet replace the current sales sync flow. It creates the stable structure needed for the next phase.

## Pending production migration

Apply this in production when approved:

- `migrations/2026_07_02_add_offline_sync_outbox.sql`

Previous pending/offline-related migrations to keep in mind:

- `migrations/2026_07_01_add_offline_sync_metadata.sql`

## Next phase

1. Add cloud bootstrap/delta endpoints for catalog completeness.
2. Write sales/cash/returns events into `sync_outbox` locally.
3. Push outbox events idempotently to cloud.
4. Store rejected events in `sync_conflicts` instead of losing or duplicating movements.
5. Add an offline status panel showing pending events, last sync and conflicts.
