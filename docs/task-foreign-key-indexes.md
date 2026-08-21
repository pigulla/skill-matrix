# Task: Index Every Foreign-Key Referencing Column

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to work through this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also load the project's `database-changes` and `writing-tests` skills before touching code — they carry the non-negotiable persistence and test conventions this plan assumes.

**Goal:** add the four missing indexes on foreign-key referencing columns, and add a catalog-driven test so a future slice cannot reintroduce the gap.

**Origin:** critical finding 4 of [`architecture-review.md`](architecture-review.md).

This plan is independent of the other two extracted findings ([`task-monotonic-concurrency-tokens.md`](task-monotonic-concurrency-tokens.md), [`task-serialization-failure-retries.md`](task-serialization-failure-retries.md)) and can run before, after, or alongside either. It touches no TypeScript source at all — one migration, one test, three doc edits.

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
2. **It interacts badly with this application's isolation level.** Every request runs in a `SERIALIZABLE` transaction (`default-transaction-options.ts`). Per PostgreSQL's own SSI performance guidance, a sequential scan must take a _relation-level_ predicate lock rather than tuple- or page-level ones, which raises the rate of serialization failures — and those currently surface as `500`s (see [`task-serialization-failure-retries.md`](task-serialization-failure-retries.md)). Removing avoidable sequential scans narrows that blast radius.
3. **This is a reference codebase.** Unindexed foreign keys are the best-known PostgreSQL schema footgun, and a project that hand-writes all of its SQL specifically to keep the database legible should not ship the canonical example of the mistake.

The lasting fix is Task 2, not Task 1: a test that fails the moment someone adds a foreign key without an index.

---

## Decisions already made — do not re-litigate

| Decision | Rationale |
| --- | --- |
| Four single-column indexes, not composite ones. | Every RI check here is `WHERE <fk_column> = $1`. A second column would only enable index-only scans for queries that do not exist. |
| Plain `CREATE INDEX`, **never** `CREATE INDEX CONCURRENTLY`. | node-pg-migrate wraps each migration in a transaction, and `CONCURRENTLY` cannot run inside a transaction block — it fails outright. The tables are also tiny and the project is not yet deployed, so there is no locking concern to design around. |
| A **new** migration file, not an edit of the three existing ones. | `PendingMigrationsChecker` compares migration _names_, not contents, so editing an already-applied migration leaves every existing database silently on the old schema with the guard still green. |
| Index naming convention: `<table>_<column>_idx`. | The `database-changes` skill already requires explicit, stable names for "primary keys, indices and constraints", but no index exists yet to set the pattern. `<table>_<column>_idx` is the PostgreSQL default shape, so it stays predictable, and it is distinct from the existing `_pkey` / `_fkey` / bare-unique names. Record it in the skill (Task 3). |
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

### Task 1: The migration

**Files:**

- Create: `migrations/20260820130000000_foreign_key_indexes.sql`
- Verify with: `test/integration/fixture/migration-round-trip.test.ts` (existing, unmodified)

**Interfaces produced:** indexes named `users_team_id_idx`, `examples_example_kind_id_idx`, `examples_to_skills_example_id_idx`, `skills_to_teams_with_proficiency_skill_id_idx`. Task 2 asserts the invariant these satisfy, not these names, so a rename would not break it — but keep them anyway.

- [ ] **Step 1: Write the migration**

Create `migrations/20260820130000000_foreign_key_indexes.sql`:

<!-- prettier-ignore -->
```sql
-- Up Migration
-- PostgreSQL indexes a foreign key's referenced side (always a primary key here) but never the referencing
-- side, which is what every ON DELETE RESTRICT / CASCADE check reads. Without these, every DELETE the API
-- exposes performs a full scan of the referencing table to decide whether it is allowed.
CREATE INDEX users_team_id_idx ON users (team_id);

CREATE INDEX examples_example_kind_id_idx ON examples (example_kind_id);

-- Trailing column of examples_to_skills_pkey (skill_id, example_id), so the primary key cannot serve it.
CREATE INDEX examples_to_skills_example_id_idx ON examples_to_skills (example_id);

-- Trailing column of skills_to_teams_with_proficiency_pkey (team_id, skill_id).
CREATE INDEX skills_to_teams_with_proficiency_skill_id_idx ON skills_to_teams_with_proficiency (skill_id);

-- Down Migration
DROP INDEX skills_to_teams_with_proficiency_skill_id_idx;

DROP INDEX examples_to_skills_example_id_idx;

DROP INDEX examples_example_kind_id_idx;

DROP INDEX users_team_id_idx;
```

The two `CASCADE` foreign keys (`examples_to_skills.skill_id`, `skills_to_teams_with_proficiency.team_id`) are deliberately absent — each is the leading column of its composite primary key and is already covered. Task 2 will confirm that judgement rather than leaving it to review.

- [ ] **Step 2: Format and lint**

```bash
npm run format:sql && npm run lint:sql
```

Expected: both exit 0. Commit whatever `format:sql` produces — the formatter owns the final layout, so do not fight it if it reflows the `CREATE INDEX` statements.

- [ ] **Step 3: Verify the round trip**

```bash
npx vitest run test/integration/fixture/migration-round-trip.test.ts
```

Expected: PASS — every Up applies and every Down reverses with nothing left behind.

- [ ] **Step 4: Prove the indexes are actually usable by the RI predicate**

This step exists because the obvious check does not work. On fixture-sized tables the planner will choose a sequential scan **even when the index exists**, so a plain `EXPLAIN` proves nothing either way. Force the planner's hand instead:

```bash
npm run docker:compose-up
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

If the container name differs, find it with `docker compose --file docker/compose.yaml ps`. If your local database predates this migration, apply it first (see [`.claude/skills/database-changes/migrations.md`](../.claude/skills/database-changes/migrations.md)) — the app refuses to boot with pending migrations, by design.

- [ ] **Step 5: Commit**

```bash
git add migrations/20260820130000000_foreign_key_indexes.sql
git commit -m "perf(db): index every foreign-key referencing column"
```

---

### Task 2: A test that keeps the invariant true

This is the part that outlives the migration. The invariant — _every foreign key's referencing column set is the leading prefix of some index_ — is checkable directly against the PostgreSQL catalog, so it does not need to be maintained by hand or remembered by a reviewer.

**Files:** create `test/integration/persistence/foreign-key-indexes.test.ts`

Model the harness on `test/integration/persistence/concurrency-token.parity.test.ts` — it is the closest existing test: it needs only `setupIntegrationTest()`, a compiled module, and `app.get(IConnectionProvider).database`. No fixture data is involved; this reads the catalog, not rows.

- [ ] **Step 1: Write the test**

Two cases. The first is the invariant; the second guards the first against a gap in its own logic.

<!-- prettier-ignore -->
```ts
it('should have an index on every foreign-key referencing column', async () => {
  const unindexed = await db.manyOrNone<{ table: string; constraint: string; column: string }>(`
    SELECT
      fk.conrelid::REGCLASS::TEXT AS "table",
      fk.conname AS "constraint",
      att.attname AS "column"
    FROM
      pg_constraint fk
      JOIN pg_attribute att ON att.attrelid = fk.conrelid AND att.attnum = fk.conkey[1]
    WHERE
      fk.contype = 'f'
      AND fk.connamespace = 'public'::REGNAMESPACE
      AND CARDINALITY(fk.conkey) = 1
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index idx
        WHERE
          idx.indrelid = fk.conrelid
          AND idx.indkey[0] = fk.conkey[1]
          AND idx.indisvalid
          AND idx.indpred IS NULL
      )
    ORDER BY
      1, 2
  `)

  expect(unindexed).toEqual([])
})

it('should have no multi-column foreign key, which the check above does not cover', async () => {
  const multiColumn = await db.manyOrNone<{ constraint: string }>(`
    SELECT conname AS "constraint"
    FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::REGNAMESPACE AND CARDINALITY(conkey) > 1
    ORDER BY 1
  `)

  expect(multiColumn).toEqual([])
})
```

Details that matter:

- `pg_index.indkey` is an `int2vector` and is **0-based**, so `indkey[0]` is the index's first column, while `conkey` is an ordinary 1-based array — hence `conkey[1]`. Getting this backwards makes the test pass vacuously.
- `indisvalid` excludes a failed `CREATE INDEX CONCURRENTLY`, and `indpred IS NULL` excludes partial indexes, which cannot be relied on for an RI check. Both keep the test from passing on an index that would not actually be used.
- The assertion is `toEqual([])` rather than a length check on purpose: when it fails, the diff names the table, constraint and column, which is the whole message the next contributor needs.
- The second test is not padding. The first deliberately only handles single-column foreign keys, because a correct multi-column prefix check is fiddly enough to get subtly wrong. If someone adds a composite foreign key, the second test fails and tells them to extend the first rather than letting it silently skip the new constraint.
- Inline SQL is allowed here — the `database-changes` skill's no-inline-SQL rule exempts integration tests, and these are catalog queries with no home in a repository's `sql/` directory.

- [ ] **Step 2: Confirm the test has teeth**

```bash
npx vitest run test/integration/persistence/foreign-key-indexes.test.ts
```

Expected: PASS. Then prove it would have caught the original defect — temporarily comment out one `CREATE INDEX` line in the migration, re-run, and confirm it fails naming that exact column. Restore the line. A test asserting an empty set is worthless until you have watched it be non-empty.

- [ ] **Step 3: Commit**

```bash
git add test/integration/persistence/foreign-key-indexes.test.ts
git commit -m "test: assert every foreign key's referencing column is indexed"
```

---

### Task 3: Documentation

**Files:**

- Modify: `.claude/skills/database-changes/SKILL.md`
- Modify: `.claude/skills/database-changes/adding-a-repository.md`
- Modify: `docs/architecture-review.md`

- [ ] **Step 1: Make the rule part of the skill**

The skill's "Non-negotiable rules" already contains:

> **Explicit naming.** Always make the names for primary keys, indices and constraints explicit.

Extend that section (or add a sibling rule) with the substance the current wording assumes but never states:

- Every foreign-key **referencing** column needs its own index — PostgreSQL creates one for the referenced side only. The exception, worth stating explicitly because two constraints in this schema rely on it, is a column that is already the _leading_ column of a composite primary key.
- Index names follow `<table>_<column>_idx`.
- `test/integration/persistence/foreign-key-indexes.test.ts` enforces this, so a new table without the index fails the suite rather than review.

Add the same as a step in `adding-a-repository.md`'s end-to-end checklist, next to the migration step — that file is what an agent building a new slice actually follows, and its current step 1 ("Migration for the table") says nothing about indexes.

- [ ] **Step 2: Close out the finding**

In `docs/architecture-review.md`, mark critical finding 4 as resolved, pointing at the migration and the test. Leave the finding text intact so the review still reads as a record of what was found.

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

- [ ] Four indexes exist, created by a new migration that round-trips cleanly up and down.
- [ ] Each index is proven usable by its RI predicate under `SET enable_seqscan = off`.
- [ ] `foreign-key-indexes.test.ts` passes, and has been observed to fail when an index is removed.
- [ ] The multi-column-foreign-key guard test passes.
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
