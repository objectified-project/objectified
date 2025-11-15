# Objectified Database

This directory contains database migration scripts and documentation for the Objectified project.

## Migration Scripts

Migration scripts are located in the `scripts/` directory and should be run in order by timestamp:

- `20251026-012616.sql` - Initial schema (users, tenants, tenant_users, tenant_administrators)
- `20251031-223953.sql` - Projects and versions
- `20251101-005912.sql` - Properties table
- `20251101-033329.sql` - Additional schema updates
- `20251101-154100.sql` - Classes and class_properties tables
- `20251108-220159.sql` - API keys and version visibility
- `20251112-182735.sql` - **Nested properties support** (adds parent_id to class_properties)

## Running Migrations

To run a migration script:

```bash
psql -U postgres -d objectified -f scripts/YYYYMMDD-HHMMSS.sql
```

Or run all migrations in order:

```bash
for file in scripts/*.sql; do
  echo "Running $file..."
  psql -U postgres -d objectified -f "$file"
done
```

## Recent Updates

### NULL property_id Support for References (2025-11-14)

Modified the `class_properties` table to allow NULL values for `property_id`, enabling reference properties to exist without linking to the property library. This supports the new drag-and-drop reference creation workflow.

**Key Changes:**
- Removed NOT NULL constraint from `property_id` column
- Added check constraint to validate NULL property_id entries contain `$ref`
- Updated documentation for property_id column
- Enables references as class-specific relationships

**Migration:**
```bash
psql -U kenji -d kenji -f scripts/20251114-191956.sql
```

**Documentation:**
- [Migration Documentation](MIGRATION_20251114_NULL_PROPERTY_ID.md)
- [Reference Drag-Drop Implementation](../../objectified-ui/docs/REFERENCE_DRAG_DROP_IMPLEMENTATION.md)

### Nested Properties (2025-11-12)

Added support for hierarchical property structures by introducing a `parent_id` column to the `class_properties` table. This allows properties of type "object" to contain inline child properties.

**Key Changes:**
- Added `parent_id UUID` column with self-referential foreign key
- Updated unique constraint to `(class_id, parent_id, name)` for scoped uniqueness
- Added cascade deletion for child properties
- Updated TypeScript and Python code to support nested structures

**Documentation:**
- [Feature Documentation](NESTED_PROPERTIES_FEATURE.md)
- [Implementation Summary](IMPLEMENTATION_SUMMARY_NESTED_PROPERTIES.md)
- [Usage Examples](NESTED_PROPERTIES_EXAMPLE.md)

## Database Connection

The database connection settings are configured in:
- **REST API**: `objectified-rest/src/app/config.py`
- **UI**: `objectified-ui/lib/db/db.ts`

## Schema

The database uses PostgreSQL with the `odb` schema. Key tables:

- **tenants**: Multi-tenant organizations
- **users**: Application users
- **projects**: API/schema projects
- **versions**: Project versions
- **classes**: Data object definitions
- **properties**: Reusable property definitions
- **class_properties**: Junction table linking classes to properties (supports nesting via parent_id)
- **api_keys**: External API access keys

## Backup and Restore

### Backup
```bash
pg_dump -U postgres -d objectified > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore
```bash
psql -U postgres -d objectified < backup_file.sql
```

## Development

For local development:

1. Ensure PostgreSQL is installed and running
2. Create the database: `createdb -U postgres objectified`
3. Run migrations in order
4. Update connection strings in application configs

