# Migrations

Schema changes are plain SQL migration files applied with **node-pg-migrate**.

## File location and naming

- One file per migration in `migrations/` at the repo root.
- Name: `<timestamp>_<name>.sql`, e.g. `20260422132117694_users.sql`. The timestamp prefix orders migrations; the filename **without** `.sql` is the migration's identity — the running app compares these names against the applied set (see startup guard below), so **never rename or delete a migration that has already been applied**.

## File format

node-pg-migrate SQL migrations use up/down marker comments:

```sql
-- Up Migration
CREATE TABLE widgets (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT widgets_name UNIQUE
);

-- Down Migration
DROP TABLE widgets;
```

- Columns are `snake_case`.
- Name constraints explicitly (`CONSTRAINT widgets_name UNIQUE`, primary keys become `widgets_pkey`). The repository's error translation matches on these constraint names via `isUniqueConstraintViolation('widgets_pkey', error)` — keep them in sync.
- Format with `npm run format:sql` (checked by `npm run lint:sql`).

## Build

`.sql` migrations are copied into `dist/migrations` at build time by `npm run build:copy:sql`. Keep them as real files; nothing generates them.

## Startup guard (how migrations are enforced)

On module init, `PendingMigrationsChecker` (`src/infrastructure/persistence/migration/`) asserts every defined migration file has been applied:

- `DefinedMigrationsProvider` globs `migrations/*.sql` for the defined set.
- `MigrationRepository` reads the applied set from the migrations table.
- Mismatch → `MigrationsPendingError`; zero defined files → `NoMigrationsFoundError`.

So after adding a migration file you must apply it to the database (via the node-pg-migrate CLI) before the app will boot. There is no `npm run migrate` wrapper yet — check how the environment applies migrations rather than assuming one exists.

## Checklist for a schema change

1. Add `migrations/<timestamp>_<name>.sql` with Up + Down sections.
2. `npm run format:sql`.
3. Apply the migration to your local/test database.
4. Update the affected repository, `.sql` queries, and row schema (see [adding-a-repository.md](adding-a-repository.md)).
5. Update/extend the integration test and run `npm run vitest:integration`.
