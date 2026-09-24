# Adding a Repository (end to end)

Worked reference: the `user` slice. Copy its shape for any new entity. Steps below assume an entity named `widget` with a table `widgets`.

## 1. Migration for the table

Add the schema first. See [migrations.md](migrations.md). The table's columns are `snake_case`. If the table has a foreign key, index the referencing column too — see [migrations.md § Indexing foreign keys](migrations.md#indexing-foreign-keys) — unless that column is already the leading column of a composite primary key.

## 2. Domain repository interface (the DI token)

`src/domain/widget/widget.repository.interface.ts` — an **abstract class** named `IWidgetRepository`. It doubles as the NestJS injection token, so it must be a class, not a TypeScript `interface`. Implementations `implements` it (never `extends`).

```ts
import type { Widget } from "./widget.js";
import type { WidgetID } from "./widget-id.js";

export abstract class IWidgetRepository {
    public abstract get(id: WidgetID): Promise<Widget>;
    public abstract create(widget: Widget): Promise<Widget>;
    // ...
}
```

Domain not-found / duplicate errors also live in `src/domain/widget/` as `*.error.ts` classes (e.g. `WidgetNotFoundError`, `DuplicateWidgetIdError`).

## 3. SQL files

One statement per file under `src/infrastructure/persistence/widget/sql/`: `get.sql`, `insert.sql`, `update.sql`, `delete.sql`, `get-all.sql`, etc.

- Named params `$(id)`, `$(first_name)` — never positional.
- Mutating statements that must confirm the row existed use `RETURNING` so the repo can detect a missing row (see `update.sql` / `delete.sql` in the `user` slice).
- Run `npm run format:sql` after writing them.

```sql
-- insert.sql
INSERT INTO
  widgets (id, name)
VALUES
  ($(id), $(name))
RETURNING
  id,
  name;
```

## 4. Register the queries

`src/infrastructure/persistence/widget/sql/queries.ts`:

```ts
import { queryFiles } from "../../query-files.js";

export const QUERY = queryFiles(import.meta.dirname, ["delete", "get", "get-all", "insert", "update"]);
```

`queryFiles` turns each file name into an uppercase `SNAKE_CASE` key on `QUERY` (`get-all` → `QUERY.GET_ALL`). Do not create a barrel/`index.ts` (Biome forbids it).

## 5. Row schema + `toDomain()`

`src/infrastructure/persistence/widget/sql/widgets.row.ts`. Validate the raw row and map `snake_case` columns to the domain object:

```ts
import z from "zod";
import { Widget } from "#/domain/widget/widget.js";
import { widgetIdSchema } from "#/domain/widget/widget-id.js";

export const widgetsRow = z
    .strictObject({ id: widgetIdSchema, name: z.string() })
    .transform((data) => ({ ...data, toDomain: () => new Widget({ ...data }) }))
    .readonly()
    .brand<"widgets-row">("widgets-row");
```

## 6. Repository implementation

`src/infrastructure/persistence/widget/widget.repository.ts`. `@Injectable()`, `implements IWidgetRepository`, inject `TransactionHost<TransactionalAdapterPgPromise>`, run queries on `this.txHost.tx`. Every query is wrapped in try/catch. Pattern per method:

```ts
public async get(id: WidgetID): Promise<Widget> {
  let row: unknown
  try {
    row = await this.txHost.tx.oneOrNone<unknown>(GET, { id })
  } catch (error) {
    throw new UnexpectedPersistenceError(error as Error)
  }
  if (row === null) {
    throw new WidgetNotFoundError(id)
  }
  return widgetsRow.parse(row).toDomain()
}
```

For inserts, translate expected constraint violations to domain errors before the generic fallback (constraint name matches the DB, e.g. `widgets_pkey`):

```ts
} catch (error) {
  if (isUniqueConstraintViolation('widgets_pkey', error)) {
    throw new DuplicateWidgetIdError(id)
  }
  throw new UnexpectedPersistenceError(error as Error)
}
```

Query method cheat-sheet (pg-promise): `one` (exactly one, throws otherwise), `oneOrNone` (zero or one → row or `null`), `manyOrNone` (zero+ rows), `none` (no rows returned).

## 7. Wire it in a module

Bind the token to the implementation in the relevant NestJS module (`src/module/*`): `{ provide: IWidgetRepository, useClass: WidgetRepository }`. Application services depend on `IWidgetRepository`, never on the concrete class.

## 8. Transactions live in the service (usually)

Put `@Transactional()` on the **application service** method that orchestrates the work (see `src/application/user.service.ts`). The repository doesn't manage transactions — unless the repository method itself performs multiple related writes that must succeed or fail together (e.g. inserting a row and then rebuilding its join-table associations), in which case that method may carry its own `@Transactional()` to stay atomic in isolation (see `SkillRepository.create()`/`update()`). Because `@nestjs-cls/transactional` defaults to `Propagation.Required`, this joins the caller's already-open transaction rather than starting a separate one, so it composes safely with the service-level `@Transactional()` above it. A repository method with only one statement never needs this — it's already atomic.

## 9. Integration test

`test/integration/persistence/widget.repository.test.ts`, modeled on `user.repository.test.ts`: use `setupDatabaseIntegrationTest()` (real PostgreSQL via Testcontainers — Docker required), seed with a `fixture.sql`, assert both the returned domain object and the raw DB state, and assert that error cases throw the domain error (`*NotFoundError`, `Duplicate*Error`). Run with `npm run vitest:integration`.

## 10. Concurrency token

If `widget` is mutable, it needs the same optimistic-concurrency mechanism as every other mutable entity ([ADR 003](../../../docs/003-concurrency-token-hashing.md)) — or an explicit note in the ADR explaining why it's exempt. Checklist:

- **Migration (step 1):** the table has `version BIGINT NOT NULL DEFAULT 1`.
- **SQL files (step 3):** `update.sql` sets `version = version + 1` alongside the other columns; both `update.sql` and `delete.sql` add `AND concurrency_token (version) = $(expectedToken)` to the `WHERE` clause; every `SELECT`/`RETURNING` that needs the token projects `concurrency_token (version) AS concurrency_token` — never a bare `version`.
- **Row schema (step 5):** the row schema's `.transform()` adds `getConcurrencyToken: () => data.concurrency_token`.
- **Repository interface (step 2):** methods that read or write a token-carrying row return `WithConcurrencyToken<Widget>`, not a bare `Widget`.
- `version` itself never appears in a row schema field or a repository return type — only `concurrency_token` crosses the infrastructure boundary.
