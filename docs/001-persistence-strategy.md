---
status: "accepted"
date: 2026-07-29
---

# Persistence Strategy

## Context and Problem Statement

The application needs a way to interface with PostgreSQL while enforcing a strict separation between the persistence, domain, and presentation layers. The project prioritizes clarity, maintainability, and low cognitive overhead over development convenience, because it is developed intermittently and expected to be maintained over a long lifetime by multiple contributors. How should the application read and write data to PostgreSQL without compromising that layering?

## Decision Drivers

- Strict layer separation — each layer must remain independently understandable and testable, with a clearly defined responsibility boundary.
- Low cognitive overhead for contributors who touch the project infrequently.
- Long-term maintainability over short-term development convenience.
- Full access to PostgreSQL-specific features (JSONB, window functions, advanced indexing), since the project targets PostgreSQL exclusively and has no need for database portability.

## Considered Options

- Full ORM (e.g. TypeORM, Prisma)
- Query builder (e.g. Kysely, Drizzle)
- A thin execution layer over raw SQL

## Decision Outcome

Chosen option: "A thin execution layer over raw SQL", because it is the only option that keeps SQL fully explicit and inspectable while leaving domain and persistence concerns cleanly separated; ORMs and query builders both require an abstraction layer that leaks those concerns into the domain or hides query generation. `pg-promise` is preferred over the bare `pg` driver for its `QueryFile` support, parameter binding, and SQL-injection safety.

All database queries are written as standalone `.sql` files rather than generated via an ORM or query builder. The runtime stack is a small set of narrowly-scoped libraries:

- **[`pg-promise`](https://vitaly-t.github.io/pg-promise)** — minimal execution layer that loads and executes the `.sql` files (via `QueryFile`), handles parameter binding and SQL-injection safety, and manages the connection pool. No ORM features (entity mapping, query builders, schema abstraction) are used.
- **[`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional)** — transaction propagation. Repositories run every query through an injected `TransactionHost` rather than managing pg-promise transactions directly, so transaction boundaries are controlled by the application layer.
- **[`zod`](https://zod.dev)** — each repository maps and validates result rows through a `*.row.ts` schema that exposes a `toDomain()` converter. This is the single, explicit row-to-domain mapping point, and it is how the loss of compile-time type safety on raw SQL results is mitigated at runtime.

Schema evolution is handled via **[`node-pg-migrate`](https://salsita.github.io/node-pg-migrate)** using plain-SQL up/down migration files, providing versioned migrations without introducing ORM abstractions. Migrations are applied out-of-band, not by the application itself, so `node-pg-migrate` is a development/deployment dependency only.

### Consequences

- Good, because it maintains strong separation between the persistence, domain, and presentation layers.
- Good, because SQL is fully explicit and inspectable in standalone files, with no hidden query generation or ORM conventions.
- Good, because it enables easy reproduction and debugging of database behavior.
- Good, because runtime row validation (Zod) catches schema/query drift at the boundary despite the lack of compile-time types.
- Good, because the startup guard (`PendingMigrationsChecker`) fails fast when the database schema and the migration files disagree.
- Good, because it has a low barrier to entry: contributors need to understand only SQL plus a few lightweight libraries.
- Good, because it gives full access to PostgreSQL-specific features.
- Bad, because there is no compile-time type safety on query results; mitigated by Zod row schemas at runtime.
- Bad, because manual row-to-domain mapping increases boilerplate.
- Bad, because schema changes require coordinated updates across SQL queries, migrations, and row mappings.
- Bad, because there are no ORM conveniences (automatic joins, relationship loading, entity tracking); each must be implemented explicitly.

## Pros and Cons of the Options

### Full ORM (e.g. TypeORM, Prisma)

- Neutral, because basic operations (inserts, updates, simple relations) are simplified.
- Good, because schema migrations can be auto-generated from entity/schema definitions, reducing manual migration-writing effort for straightforward schema changes.
- Good, because relationship loading (eager/lazy) removes the need to hand-write and maintain join queries and row-to-object assembly for nested object graphs.
- Good, because it has a large ecosystem and broad developer familiarity, lowering onboarding cost for contributors who already know the framework.
- Bad, because entity-centric patterns leak persistence concerns into the domain and rely on hidden query generation.
- Bad, because it undermines layer separation by coupling domain models to persistence, introducing implicit row-to-object mapping, and encouraging active-record patterns.
- Bad, because complexity increases sharply for non-trivial queries, transaction boundaries, performance-sensitive operations, bulk updates, and any access pattern outside the framework's model — where explicit SQL is often easier to work with.
- Bad, because using it effectively requires understanding framework-internal concepts (Unit of Work, identity maps, entity managers, change tracking, lazy vs. eager loading, cascading behavior, session/transaction lifecycles); without that knowledge, seemingly simple code can produce unexpected queries, inconsistent transactions, stale data, or performance issues.
- Bad, because it trades portable SQL and PostgreSQL knowledge for framework-specific expertise.
- Bad, because most ORMs prioritize database portability, which this project — targeting PostgreSQL exclusively — does not need, and which prevents direct use of features such as JSONB, window functions, and advanced indexing.

### Query builder (e.g. Kysely, Drizzle)

- Neutral, because it is lighter than a full ORM and avoids the ORM-specific complexity cliff: there is no entity tracking, identity map, unit-of-work, or cascading behavior to fight, so transactions and most non-trivial queries remain straightforward rather than requiring framework-internal knowledge.
- Good, because renaming or removing a column surfaces as a compile-time error at every call site (when the schema type is kept in sync), unlike raw SQL, where the same mistake surfaces only at runtime via Zod.
- Good, because dynamic, conditionally-constructed queries (optional filters, sort orders) are expressed naturally in code, something static `.sql` files can't do without duplicating queries or hand-building SQL strings.
- Good, because query fragments are composable and reusable across repositories, reducing duplication compared to copy-pasting near-identical SQL across files.
- Bad, because it is still an abstraction over SQL that keeps queries out of inspectable, standalone files.
- Bad, because complex, PostgreSQL-specific query shapes (CTEs, window functions, JSONB operators, lateral joins) still require dropping into raw-SQL escape hatches (e.g. Kysely's `sql` template tag), so full SQL transparency isn't actually preserved once queries go beyond the basics.
- Bad, because its compile-time type safety isn't actually guaranteed: the `Database` type is hand-maintained or generated by introspecting a live database (e.g. `kysely-codegen`), decoupled from whatever runs the migrations — including Kysely's own migrator — with nothing enforcing that the type stays in sync after a schema change.
- Bad, because contributors must learn the builder's own DSL in addition to SQL itself — a second, non-transferable API surface that's easy to forget between infrequent visits to the project.

### A thin execution layer over raw SQL

- Good, because SQL stays fully explicit and inspectable in standalone `.sql` files.
- Good, because it keeps domain models fully decoupled from persistence, with an explicit type-safe row-to-domain mapping point.
- Good, because it gives direct access to PostgreSQL-specific features (JSONB, window functions, advanced indexing) without a portability abstraction in the way.
- Good, because contributors only need SQL knowledge plus a few narrowly-scoped libraries, rather than framework-specific expertise.
- Bad, because query results have no compile-time type safety; this is mitigated by validating every row against a Zod schema at runtime.

## More Information

`pg-promise` was chosen over the bare `pg` driver specifically for its `QueryFile` support, parameter binding, and SQL-injection safety — capabilities that would otherwise need to be reimplemented on top of `pg` directly.
