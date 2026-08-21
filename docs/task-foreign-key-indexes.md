# Task: Index Every Foreign-Key Referencing Column

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to work through this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also load the project's `database-changes` skill before touching code — it carries the non-negotiable persistence conventions this plan assumes.

**Goal:** add the four missing indexes on foreign-key referencing columns.

**Origin:** critical finding 4 of [`architecture-review.md`](architecture-review.md).

This plan is independent of the other two extracted findings ([`task-monotonic-concurrency-tokens.md`](task-monotonic-concurrency-tokens.md), [`task-serialization-failure-conflict.md`](task-serialization-failure-conflict.md)) and can run before, after, or alongside either. It touches no TypeScript source at all — three migration edits, three doc edits.

---

## Context: why this is broken today

The three migrations create eleven constraints and **zero** indexes (`grep -c "CREATE INDEX" migrations/*.sql` returns 0 for all three).

PostgreSQL creates an index automatically for `PRIMARY KEY` and `UNIQUE` constraints, and a foreign key's _referenced_ side is always a primary key here — so it is covered. What PostgreSQL never creates is an index on the _referencing_ column, and that is the side every `ON DELETE RESTRICT` / `ON DELETE CASCADE` check reads.

When you `DELETE FROM teams WHERE id = $1`, PostgreSQL's referential-integrity trigger for `users_team_fkey` runs, in effect:

```sql
SELECT 1 FROM users WHERE team_id = $1 FOR KEY SHARE LIMIT 1
```

With no index on `users.team_id`, that is a full scan of `users`, once per deleted row.

### The four gaps, and what each one costs

| Referencing column | Constraint | Action | Covered by an existing index? |
| --- | --- | --- | --- |
| `users.team_id` | `users_team_fkey` | `RESTRICT` | **No** — no index at all |
| `examples.example_kind_id` | `examples_example_kind_id_fkey` | `RESTRICT` | **No** — no index at all |
| `examples_to_skills.example_id` | `examples_to_skills_example_fkey` | `RESTRICT` | **No** — it is the _trailing_ column of `examples_to_skills_pkey (skill_id, example_id)`, which cannot serve a lookup on `example_id` alone |
| `skills_to_teams_with_proficiency.skill_id` | `skills_to_teams_with_proficiency_skill_fkey` | `RESTRICT` | **No** — trailing column of `skills_to_teams_with_proficiency_pkey (team_id, skill_id)` |

The two `CASCADE` foreign keys happen to be fine: `examples_to_skills.skill_id` and `skills_to_teams_with_proficiency.team_id` are each the _leading_ column of their composite primary key, so the cascade lookup uses that index.

Every one of the four gaps sits directly under a delete endpoint, and each backs exactly one domain error:

| Repository method | Error raised from the `RESTRICT` violation | Unindexed scan it depends on |
| --- | --- | --- |
| `TeamRepository.delete` (`team.repository.ts:136`) | `TeamInUseError` | `users` |
| `SkillRepository.delete` (`skill.repository.ts:180`) | `SkillInUseError` | `skills_to_teams_with_proficiency` |
| `ExampleRepository.delete` (`example.repository.ts:158`) | `ExampleInUseError` | `examples_to_skills` |
| `ExampleKindRepository.delete` (`example-kind.repository.ts:147`) | `ExampleKindInUseError` | `examples` |

So: **every `DELETE` the API exposes performs at least one full table scan**, and the scan is what produces the `409 Conflict`. Note the asymmetry — the `isForeignKeyViolation` checks on `create`/`update` validate the _referenced_ side (`teams.id`, `example_kinds.id`, `skills.id`), which is the primary key and therefore indexed. Only the delete direction is affected.

### Be honest about the magnitude

At fixture scale — a handful of rows per table — these scans cost microseconds, and the planner would choose a sequential scan even if the indexes existed. **You are not firefighting a live performance problem.** Three reasons to fix it now anyway:

1. **The cost is unbounded and invisible.** It grows linearly with table size and shows up as a slow `DELETE`, which is the last place anyone looks. `users` and `examples_to_skills` are exactly the tables that grow.
2. **It interacts badly with this application's isolation level.** Every request runs in a `SERIALIZABLE` transaction (`default-transaction-options.ts`). Per PostgreSQL's own SSI performance guidance, a sequential scan must take a _relation-level_ predicate lock rather than tuple- or page-level ones, which raises the rate of serialization failures — and those currently surface as `500`s (see [`task-serialization-failure-conflict.md`](task-serialization-failure-conflict.md)). Removing avoidable sequential scans narrows that blast radius.
3. **This is a reference codebase.** Unindexed foreign keys are the best-known PostgreSQL schema footgun, and a project that hand-writes all of its SQL specifically to keep the database legible should not ship the canonical example of the mistake.

---

## Decisions already made — do not re-litigate

| Decision | Rationale |
| --- | --- |
| Four single-column indexes, not composite ones. | Every RI check here is `WHERE <fk_column> = $1`. A second column would only enable index-only scans for queries that do not exist. |
| Plain `CREATE INDEX`, **never** `CREATE INDEX CONCURRENTLY`. | node-pg-migrate wraps each migration in a transaction, and `CONCURRENTLY` cannot run inside a transaction block — it fails outright. The tables are also tiny and the project is not yet deployed, so there is no locking concern to design around. |
| Edit each existing migration in place, next to the table (and foreign key) the index belongs to — not a new migration file. | `PendingMigrationsChecker` compares migration _names_, not contents, so editing an already-applied migration leaves an existing database silently on the old schema with the guard still green. That risk needs a database that already ran these migrations and then kept running: `docker/compose.yaml`'s `db` service has no volume, so its data does not survive `docker compose down`, and the integration suite always starts a fresh Testcontainers instance — neither holds stale state across this edit. The one case that is exposed — a `db` container left running from before this change — is handled in Task 1 by tearing it down before reapplying. |
| Index naming convention: `<table>_<column>_idx`. | The `database-changes` skill already requires explicit, stable names for "primary keys, indices and constraints", but no index exists yet to set the pattern. `<table>_<column>_idx` is the PostgreSQL default shape, so it stays predictable, and it is distinct from the existing `_pkey` / `_fkey` / bare-unique names. Record it in the skill (Task 2). |
| No ADR for this. | It reverses no earlier decision and introduces no new architectural concept — it corrects an omission and adds a convention. The convention belongs in the `database-changes` skill, where a contributor adding a table will actually read it. ADR 004 is taken and 005/006 are reserved by the other two plans; do not consume a number here. |
| Do not add an index for `view_teams_with_members`'s join. | That view is dead code (review finding 17 — created, never queried). `users.team_id` earns its index from the `users_team_fkey` check alone, whether or not the view survives. |

---

## Global constraints

- No TypeScript source changes. If you find yourself editing anything under `src/`, stop — you have left the scope of this plan.
- No new npm dependency.
- After any `.sql` edit: `npm run format:sql` then `npm run lint:sql`.
- `npm run test` (lint + full test suite + openapi) must pass before the final commit.
- Every existing test must pass unchanged. Adding an index changes no observable behaviour — a failing test is a signal, not something to adjust.
- Conventional Commits; commit at the end of each task.
- Integration tests need Docker running (Testcontainers).

---

### Task 1: The migrations

**Files:**

- Modify: `migrations/20260728150000000_users_and_teams.sql`
- Modify: `migrations/20260728160000000_skills_and_examples.sql`
- Modify: `migrations/20260729000000000_skills_to_team_proficiencies.sql`
- Verify with: `test/integration/fixture/migration-round-trip.test.ts` (existing, unmodified)

**Interfaces produced:** indexes named `users_team_id_idx`, `examples_example_kind_id_idx`, `examples_to_skills_example_id_idx`, `skills_to_teams_with_proficiency_skill_id_idx` — keep these exact names; they follow the `<table>_<column>_idx` convention recorded in the `database-changes` skill (Task 2).

Each index is added to the Up section of the migration that created its table, immediately after the `CREATE TABLE` block, before that file's `CREATE VIEW`. None of the three Down sections need a change: `DROP TABLE` already drops every index defined on that table implicitly — the same reason the existing migrations never `DROP CONSTRAINT` a `_pkey` before dropping its table.

The two `CASCADE` foreign keys (`examples_to_skills.skill_id`, `skills_to_teams_with_proficiency.team_id`) are deliberately left unindexed — each is the leading column of its composite primary key and is already covered. This judgement is recorded in the `database-changes` skill in Task 2, so it doesn't need to be rediscovered at review time.

- [ ] **Step 1: Add the `users.team_id` index**

In `migrations/20260728150000000_users_and_teams.sql`, insert between the `users` table and the view:

<!-- prettier-ignore -->
```sql
CREATE TABLE users (
  id UUID NOT NULL CONSTRAINT users_pkey PRIMARY KEY,
  email VARCHAR NOT NULL CONSTRAINT users_email UNIQUE,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  team_id UUID NOT NULL CONSTRAINT users_team_fkey REFERENCES teams (id) ON DELETE RESTRICT
);

CREATE INDEX users_team_id_idx ON users (team_id);

CREATE VIEW view_teams_with_members AS
```

- [ ] **Step 2: Add the `examples.example_kind_id` and `examples_to_skills.example_id` indexes**

In `migrations/20260728160000000_skills_and_examples.sql`, insert after the `examples` table:

<!-- prettier-ignore -->
```sql
CREATE TABLE examples (
  id UUID NOT NULL CONSTRAINT examples_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT examples_name UNIQUE,
  example_kind_id UUID NOT NULL CONSTRAINT examples_example_kind_id_fkey REFERENCES example_kinds (id) ON DELETE RESTRICT,
  url VARCHAR,
  last_updated TIMESTAMPTZ NOT NULL
);

CREATE INDEX examples_example_kind_id_idx ON examples (example_kind_id);

CREATE TABLE examples_to_skills (
```

and after the `examples_to_skills` table, in the same file:

<!-- prettier-ignore -->
```sql
CREATE TABLE examples_to_skills (
  skill_id UUID NOT NULL CONSTRAINT examples_to_skills_skill_fkey REFERENCES skills (id) ON DELETE CASCADE,
  example_id UUID NOT NULL CONSTRAINT examples_to_skills_example_fkey REFERENCES examples (id) ON DELETE RESTRICT,
  CONSTRAINT examples_to_skills_pkey PRIMARY KEY (skill_id, example_id)
);

CREATE INDEX examples_to_skills_example_id_idx ON examples_to_skills (example_id);

CREATE VIEW view_skills_with_examples AS
```

- [ ] **Step 3: Add the `skills_to_teams_with_proficiency.skill_id` index**

In `migrations/20260729000000000_skills_to_team_proficiencies.sql`, insert between the table and the view:

<!-- prettier-ignore -->
```sql
CREATE TABLE skills_to_teams_with_proficiency (
  team_id UUID NOT NULL CONSTRAINT skills_to_teams_with_proficiency_team_fkey REFERENCES teams (id) ON DELETE CASCADE,
  skill_id UUID NOT NULL CONSTRAINT skills_to_teams_with_proficiency_skill_fkey REFERENCES skills (id) ON DELETE RESTRICT,
  proficiency SMALLINT NOT NULL CONSTRAINT skills_to_teams_proficiency_check CHECK (proficiency BETWEEN 0 AND 4),
  CONSTRAINT skills_to_teams_with_proficiency_pkey PRIMARY KEY (team_id, skill_id)
);

CREATE INDEX skills_to_teams_with_proficiency_skill_id_idx ON skills_to_teams_with_proficiency (skill_id);

CREATE VIEW view_team_skill_proficiencies AS
```

- [ ] **Step 4: Format and lint**

```bash
npm run format:sql && npm run lint:sql
```

Expected: both exit 0. Commit whatever `format:sql` produces — the formatter owns the final layout, so do not fight it if it reflows the `CREATE INDEX` statements.

- [ ] **Step 5: Verify the round trip**

```bash
npx vitest run test/integration/fixture/migration-round-trip.test.ts
```

Expected: PASS — every Up applies and every Down reverses with nothing left behind. This exercises all three edited files, not just the new lines.

- [ ] **Step 6: Recreate the local database and prove the indexes are usable by the RI predicate**

These three migrations were very likely already applied to your local `db` container before this edit. `node-pg-migrate` records migrations by name in the `pgmigrations` table, so it will **not** rerun one whose name it already has — editing the file's content changes nothing for a database that already ran it. Tear the container down first:

```bash
npm run docker:compose-down
npm run docker:compose-up
```

`docker/compose.yaml`'s `db` service has no volume, so `down` discards its data completely; the next `up` starts from an empty database and `migrate` reapplies all three files from scratch, this time with the new `CREATE INDEX` statements. (This is also why CI is never at risk here: the integration suite always starts a brand-new Testcontainers instance.)

Now check that the indexes are actually usable. On fixture-sized tables the planner will choose a sequential scan **even when the index exists**, so a plain `EXPLAIN` proves nothing either way — force the planner's hand instead:

```bash
docker exec -i docker-db-1 psql -U postgres -d skillmatrix <<'SQL'
SET enable_seqscan = off;
EXPLAIN SELECT 1 FROM users WHERE team_id = '00000000-0002-4000-8000-000000000000';
EXPLAIN SELECT 1 FROM examples WHERE example_kind_id = '00000000-0005-4000-8000-000000000000';
EXPLAIN SELECT 1 FROM examples_to_skills WHERE example_id = '00000000-0004-4000-8000-000000000000';
EXPLAIN SELECT 1 FROM skills_to_teams_with_proficiency WHERE skill_id = '00000000-0003-4000-8000-000000000000';
SQL
```

The UUID literals need not exist in the database — `EXPLAIN` without `ANALYZE` plans the query without running it, so any well-formed UUID exercises the same predicate.

Expected: each plan is an `Index Scan`, `Index Only Scan`, or `Bitmap Index Scan` naming the corresponding `*_idx`. A `Seq Scan` surviving `enable_seqscan = off` means the index is not usable for that predicate — the column or the index is wrong, so fix it before moving on.

If the container name differs, find it with `docker compose --file docker/compose.yaml ps`.

- [ ] **Step 7: Commit**

```bash
git add migrations/20260728150000000_users_and_teams.sql migrations/20260728160000000_skills_and_examples.sql migrations/20260729000000000_skills_to_team_proficiencies.sql
git commit -m "perf(db): index every foreign-key referencing column"
```

---

### Task 2: Documentation

**Files:**

- Modify: `.claude/skills/database-changes/SKILL.md`
- Modify: `.claude/skills/database-changes/adding-a-repository.md`
- Modify: `.claude/skills/database-changes/migrations.md`
- Modify: `docs/architecture-review.md`

- [ ] **Step 1: Make the rule part of the skill**

The skill's "Non-negotiable rules" already contains:

> **Explicit naming.** Always make the names for primary keys, indices and constraints explicit.

Extend that section (or add a sibling rule) with the substance the current wording assumes but never states:

- Every foreign-key **referencing** column needs its own index — PostgreSQL creates one for the referenced side only. The exception, worth stating explicitly because two constraints in this schema rely on it, is a column that is already the _leading_ column of a composite primary key.
- Index names follow `<table>_<column>_idx`.

Add the same as a step in `adding-a-repository.md`'s end-to-end checklist, next to the migration step — that file is what an agent building a new slice actually follows, and its current step 1 ("Migration for the table") says nothing about indexes.

Add the mechanical detail to `migrations.md` (the deeper guide `SKILL.md` links to for migration content): the `CREATE INDEX` placement and syntax, the naming convention, and the composite-primary-key exception spelled out for both the leading-column case (no separate index needed) and the trailing-column case (still needs one).

- [ ] **Step 2: Close out the finding**

In `docs/architecture-review.md`, mark critical finding 4 as resolved, pointing at the three edited migrations. Leave the finding text intact so the review still reads as a record of what was found.

- [ ] **Step 3: Format, verify, commit**

```bash
npm run format:markdown
npm run test
git add docs .claude/skills/database-changes
git commit -m "docs: require an index on every foreign-key referencing column"
```

`npm run format:markdown` is not optional — Prettier formats every `.md` in the repo and `npm run lint:markdown` is part of `npm run lint`.

---

## Definition of done

- [ ] Four indexes exist, added to the three existing migrations, which still round-trip cleanly up and down.
- [ ] Each index is proven usable by its RI predicate under `SET enable_seqscan = off`.
- [ ] The `database-changes` skill and `adding-a-repository.md` state the rule and the naming convention.
- [ ] `docs/architecture-review.md` marks finding 4 resolved.
- [ ] `npm run test` passes.
- [ ] No file under `src/` was modified.

## Out of scope (do not expand into these)

- Dropping the dead `view_teams_with_members` (review finding 17) — a separate schema change with its own reasoning, even though it touches the same table.
- Any other index: no query in the codebase filters or sorts on a non-key column, so there is nothing else to index. Do not add speculative indexes.
- The missing `ORDER BY` in `skill/sql/get-all.sql` (review finding 14), even though it is also a `get-all` concern.
- `statement_timeout` / connection-pool configuration (review finding 15).
- Anything in the other two plans.
