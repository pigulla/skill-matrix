# Task: Derive Concurrency Tokens From a Monotonic Row Version

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to work through this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also load the project's `database-changes` and `writing-tests` skills before touching code — they carry the non-negotiable persistence and test conventions this plan assumes.

**Goal:** make ETag / `If-Match` optimistic concurrency actually correct by deriving the concurrency token from a monotonic per-row `version` counter instead of from an application-clock `last_updated` timestamp.

**Origin:** critical finding 1 of [`architecture-review.md`](architecture-review.md). Updates [ADR 003 – Concurrency Token Hashing](003-concurrency-token-hashing.md) in place — the token is still an MD5 hash; only what gets hashed changes, so this is written up as a revision of 003, not a new ADR superseding it.

---

## Context: why this is broken today

The token is `md5()` of `last_updated` truncated to whole milliseconds, computed on both sides:

- TypeScript, on every read: `toConcurrencyToken(lastUpdated: Dayjs)` in `src/infrastructure/persistence/concurrency-token.codec.ts` hashes `String(lastUpdated.valueOf())`.
- PostgreSQL, on every write: the `concurrency_token(ts TIMESTAMPTZ)` function defined in `migrations/20260728160000000_skills_and_examples.sql` hashes `FLOOR(EXTRACT(EPOCH FROM ts) * 1000)::BIGINT::TEXT`, used inline as `... WHERE id = $(id) AND concurrency_token (last_updated) = $(expectedToken)`.

`last_updated` is supplied by the **application** (`this.timeProvider.now().toDate()` in every repository's `create`/`update`). That makes token equality _not_ equivalent to "this row has not changed":

**Lost update, concretely.** Row `S` has `last_updated = T`.

1. Client A `GET`s `/skills/S` and receives `ETag: W/"md5(T)"`.
2. Client B `GET`s the same row and receives the same ETag.
3. Client B `PUT`s with `If-Match: W/"md5(T)"`. The predicate matches, the row is written, and `last_updated` is set to B's `now()`. If that lands in the **same millisecond** as `T`, the stored token is still `md5(T)`.
4. Client A `PUT`s with its now-stale `If-Match: W/"md5(T)"`. The predicate still matches. A overwrites B's change and receives `200`.

That is precisely the lost update the mechanism exists to prevent, and no test would catch it.

**Secondary defects of the same root cause:**

- Nothing enforces that `last_updated` moves forward. With several app instances (or an NTP step-back), a token value a client already holds can recur, so an old `If-Match` becomes valid again.
- Two implementations of the hash must agree forever — the downside ADR 003 lists as its main cost, guarded only by `test/integration/persistence/concurrency-token.parity.test.ts`.
- `FLOOR(... * 1000)` silently truncates. Any `TIMESTAMPTZ` with sub-millisecond precision (a future trigger, a hand-written fixture, `now()`) collides with its neighbours.

A monotonic integer counter incremented by the same `UPDATE` statement removes all four at once: the token changes **iff** the row changed, it never repeats, and it has no dependency on any clock.

---

## Decisions already made — do not re-litigate

| Decision | Rationale |
| --- | --- |
| Add `version BIGINT NOT NULL DEFAULT 1`; token becomes `md5(version::text)`. | Monotonic, collision-free, clock-independent, and it keeps the single-statement atomic `UPDATE ... WHERE ... AND concurrency_token(version) = $(expectedToken)` check that ADR 003 was built around. |
| **Not** `xmin`. | Zero schema change, but it changes spuriously after `VACUUM FREEZE` (tuples get `FrozenTransactionId`), producing false `412`s, and it wraps around. |
| **Keep** `last_updated` exactly as it is — same column, same app-clock writes, same `ITimeProvider` injection. | It stays useful as an audit column, and leaving it alone keeps this change surgical: no repository loses a constructor dependency and the existing `last_updated: now` assertions in the repository tests keep passing. Moving it to a SQL-side `now()` is a separate, optional follow-up. |
| **Keep** `concurrencyTokenSchema` as `z.hash('md5')` in the domain — **no domain-layer change at all**. | ADR 003's principle stands: the domain knows the token is an MD5 hash and nothing about what it is derived from. This plan touches only infrastructure, migrations, tests and docs. |
| Edit the two existing migrations in place (`20260728150000000_users_and_teams.sql`, `20260728160000000_skills_and_examples.sql`); do not add a new migration file. | `PendingMigrationsChecker` compares migration _names_, not contents, so editing an already-applied migration is only safe when no database that already ran the old content is expected to keep running. That holds here: `docker/compose.yaml`'s `db` service has no volume, so its data never survives `docker compose down`, and the integration suite always starts a fresh Testcontainers instance — nothing holds stale schema across this edit. [`task-foreign-key-indexes.md`](task-foreign-key-indexes.md) already established this precedent, editing these same two files to add indexes. The one case not covered automatically — a local `db` container left running from before this change — is handled by tearing it down before reapplying (Task 1, Step 5). |
| Keep the SQL function **named** `concurrency_token`, changing only its parameter type. | Every `update.sql`/`delete.sql` keeps the same call shape; only the argument changes from `last_updated` to `version`. |
| Rewrite ADR 003 in place; do not write a new ADR. | The algorithm decision (MD5) and the source-value decision (what gets hashed) are one and the same choice from the reader's point of view — "how is the concurrency token derived" — so they belong in one document, not a chain of ADRs superseding each other for what is still a single concern. Write the revised 003 as if the `version`-based design had been chosen from the start: no mention of `last_updated` ever having been the hashed value, no "supersedes" language. `xmin` and a `last_updated`-hash both still belong in the rewritten "Considered Options" as rejected alternatives — that is normal ADR content, not a confession that one was shipped. This consumes no ADR number, so 005 stays free. |
| Every query projects `concurrency_token (version) AS concurrency_token`; no query, row schema, or repository ever surfaces raw `version` to TypeScript. | `concurrency_token()` is a PostgreSQL built-in, so there is no reason to duplicate it in Node — TypeScript only needs to receive and forward an already-opaque string. This removes the TS/SQL parity concern entirely (there is only one implementation, so nothing can drift), and with it the `entity-version.ts` module and the `toConcurrencyToken()` codec that an earlier draft of this plan had. Raised and agreed mid-plan. |
| No unit test for `concurrency_token()`, and no TypeScript codec left to test at all. | `concurrency_token()` is exercised on every read and write by every repository integration test — the same "don't test what has no logic" exemption the `writing-tests` skill already grants every branded Zod schema in this codebase (`concurrencyTokenSchema`, every `*Id` schema). There is no function or schema beyond the domain's existing `concurrencyTokenSchema` left in TypeScript to test. |
| `STALE_CONCURRENCY_TOKEN` is `md5('0')`, computed with a one-line `node:crypto` call directly inside `test/util/concurrency-tokens.ts`, not via any production code. | Real versions are always `>= 1` (the migration's `DEFAULT 1`) and only ever increase, so `0` is guaranteed never to occur, regardless of what the actual starting value happens to be. There is no production codec left to derive this from, so the one-line hash lives in the test utility itself — it never needs to agree with anything else, since it's compared only for equality against real tokens, never recomputed. |

---

## Scope

Four tables carry `last_updated` and therefore tokens today: `teams`, `skills`, `example_kinds`, `examples`. All four get `version`. `users` and `skills_to_teams_with_proficiency` have no tokens at all today (findings 9 and 10 of the review) and are explicitly **out of scope** here.

## Global constraints

- No new npm dependency. `md5()` is built into PostgreSQL; `node:crypto` is already used.
- After any `.sql` edit: `npm run format:sql` then `npm run lint:sql`.
- After any TypeScript edit: `npm run lint:tsc` must pass.
- `npm run lint:architecture` must stay green throughout.
- Every existing test must still pass. This change alters _how_ a token is computed, never the observable repository or HTTP behaviour — a test that starts failing is a signal, not something to update to match.
- Conventional Commits (the repo uses commitizen); commit at the end of each task.
- `npm run test` (lint + vitest + openapi) must pass before the final commit.
- Integration tests need Docker running (Testcontainers).

---

### Task 1: Migration — add `version` and re-point `concurrency_token()`

**Files:**

- Modify: `migrations/20260728150000000_users_and_teams.sql`
- Modify: `migrations/20260728160000000_skills_and_examples.sql`
- Verify with: `test/integration/fixture/migration-round-trip.test.ts` (existing, unmodified)

**Interfaces produced:** a `version BIGINT NOT NULL DEFAULT 1` column on `teams`, `skills`, `example_kinds`, `examples`; a SQL function `concurrency_token(version BIGINT) RETURNS TEXT` returning a 32-character lowercase hex string; `view_skills_with_examples` gains a `version` column. Every later task depends on these exact names.

These two migrations already create every table and the `concurrency_token()` function from scratch, so the `version` column and the `BIGINT`-taking function are added directly to their `CREATE TABLE`/`CREATE FUNCTION` statements — there is nothing to `ALTER`, `DROP`, or replace, and no separate migration file. This mirrors [`task-foreign-key-indexes.md`](task-foreign-key-indexes.md)'s Task 1, which already edited these same two files in place to add indexes (see the "decisions already made" table above for why that's safe here). Do not add `ALTER TABLE ... ADD COLUMN` statements — that pattern is for a genuinely later change to an already-shipped table, which this is not, by decision.

- [ ] **Step 1: Add `version` to `teams`**

In `migrations/20260728150000000_users_and_teams.sql`, add the column to the `teams` table (the `users` table and everything below it is untouched — `users` carries no token and is out of scope):

<!-- prettier-ignore -->
```sql
CREATE TABLE teams (
  id UUID NOT NULL CONSTRAINT teams_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT teams_name UNIQUE,
  last_updated TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL DEFAULT 1
);
```

The Down migration needs no change: `DROP TABLE teams;` already drops every column defined on it, the same reason it never `ALTER TABLE ... DROP COLUMN`s before dropping the table.

- [ ] **Step 2: Re-point `concurrency_token()` and add `version` to `skills`, `example_kinds`, `examples`**

In `migrations/20260728160000000_skills_and_examples.sql`, change the function's parameter type and body, add the column to the three `CREATE TABLE` statements, and add `skills.version` to the view:

<!-- prettier-ignore -->
```sql
-- Up Migration
CREATE FUNCTION concurrency_token (version BIGINT) RETURNS TEXT AS $$
  SELECT md5(version::TEXT)
$$ LANGUAGE SQL IMMUTABLE;

CREATE TABLE skills (
  id UUID NOT NULL CONSTRAINT skills_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT skills_name UNIQUE,
  description VARCHAR NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE example_kinds (
  id UUID NOT NULL CONSTRAINT example_kinds_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT example_kinds_name UNIQUE,
  last_updated TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE examples (
  id UUID NOT NULL CONSTRAINT examples_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT examples_name UNIQUE,
  example_kind_id UUID NOT NULL CONSTRAINT examples_example_kind_id_fkey REFERENCES example_kinds (id) ON DELETE RESTRICT,
  url VARCHAR,
  last_updated TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX examples_example_kind_id_idx ON examples (example_kind_id);

CREATE TABLE examples_to_skills (
  skill_id UUID NOT NULL CONSTRAINT examples_to_skills_skill_fkey REFERENCES skills (id) ON DELETE CASCADE,
  example_id UUID NOT NULL CONSTRAINT examples_to_skills_example_fkey REFERENCES examples (id) ON DELETE RESTRICT,
  CONSTRAINT examples_to_skills_pkey PRIMARY KEY (skill_id, example_id)
);

CREATE INDEX examples_to_skills_example_id_idx ON examples_to_skills (example_id);

CREATE VIEW view_skills_with_examples AS
SELECT
  skills.id,
  skills.name,
  skills.description,
  skills.last_updated,
  skills.version,
  COALESCE(
    JSON_AGG(
      examples.id
      ORDER BY
        examples.id
    ) FILTER (
      WHERE
        examples.id IS NOT NULL
    ),
    '[]'::JSON
  ) AS example_ids
FROM
  skills
  LEFT JOIN examples_to_skills ON examples_to_skills.skill_id = skills.id
  LEFT JOIN examples ON examples.id = examples_to_skills.example_id
GROUP BY
  skills.id;

-- Down Migration
DROP VIEW view_skills_with_examples;

DROP TABLE examples_to_skills;

DROP TABLE examples;

DROP TABLE example_kinds;

DROP TABLE skills;

DROP FUNCTION concurrency_token (BIGINT);
```

Only the Down section's `DROP FUNCTION` signature changes (`TIMESTAMPTZ` → `BIGINT`, to match the Up section's new function) — `DROP TABLE`/`DROP VIEW` already reverse everything else, including the new column, with no edit needed.

- [ ] **Step 3: Format and lint**

```bash
npm run format:sql && npm run lint:sql
```

Expected: both exit 0, and `format:sql` leaves no further diff.

- [ ] **Step 4: Verify the round trip**

```bash
npx vitest run test/integration/fixture/migration-round-trip.test.ts
```

Expected: PASS — every Up applies and every Down reverses cleanly with nothing left behind. This exercises both edited files in full, not just the new lines.

- [ ] **Step 5: Recreate your local database and sanity-check the function**

Both files are edited in place, so `node-pg-migrate` (which tracks applied migrations by name, not content — see the "decisions already made" table) will not reapply either one to a database that already ran the old versions. Tear the local container down first:

```bash
npm run docker:compose-down
npm run docker:compose-up
docker exec docker-db-1 psql -U postgres -d skillmatrix -tAc "SELECT concurrency_token(1::BIGINT);"
```

Expected: `c4ca4238a0b923820dcc509a6f75849b` (the MD5 of the string `1`). If the container name differs, find it with `docker compose --file docker/compose.yaml ps`. `docker/compose.yaml`'s `db` service has no volume, so `down` discards its data completely and the next `up` reapplies both edited migrations from scratch — this is also why CI is never at risk here: the integration suite always starts a brand-new Testcontainers instance.

- [ ] **Step 6: Commit**

```bash
git add migrations/20260728150000000_users_and_teams.sql migrations/20260728160000000_skills_and_examples.sql
git commit -m "feat(db): derive concurrency tokens from a per-row version instead of last_updated"
```

---

### Task 2: Delete the TypeScript codec — PostgreSQL is now the only implementation

**Files:**

- Delete: `src/infrastructure/persistence/concurrency-token.codec.ts`
- Delete: `src/infrastructure/persistence/concurrency-token.codec.test.ts`

**Interfaces removed:** `toConcurrencyToken()`. No replacement is created — there is no `EntityVersion`, no `entityVersionSchema`, no codec of any kind. From here on, every row schema validates a `concurrency_token` column directly against the domain's existing `concurrencyTokenSchema` (Task 3); TypeScript never computes a hash for this feature again. Deleting the codec now deliberately breaks the build until Task 3 completes — do not run the full suite in between.

- [ ] **Step 1: Delete the codec and its test**

```bash
git rm src/infrastructure/persistence/concurrency-token.codec.ts \
  src/infrastructure/persistence/concurrency-token.codec.test.ts
```

Expected: both staged for deletion. `npm run lint:tsc` will fail from here until Task 3 completes — every repository and row schema still imports `toConcurrencyToken`. That's expected and fixed in Task 3, not a signal to keep either file around.

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor: remove the TypeScript concurrency-token codec"
```

---

### Task 3: Migrate the four persistence slices

One task, because Task 2 deleted the codec every row schema imports, and the project does not compile until every caller is converted.

Work slice by slice, in this order — `example-kind` is the simplest and is written out in full below; the other three follow the identical shape.

**Files (per slice `<s>` in `example/kind`, `team`, `example`, `skill`):**

- Modify: `src/infrastructure/persistence/<s>/sql/get.sql`, `get-all.sql`, `insert.sql`, `update.sql`, `delete.sql`
- Modify: `src/infrastructure/persistence/<s>/sql/*.row.ts`
- Modify: `src/infrastructure/persistence/<s>/<name>.repository.ts`

**The four mechanical changes, everywhere:**

1. Every `SELECT` / `RETURNING` list that named `last_updated` for token purposes instead projects `concurrency_token (version) AS concurrency_token`. Never select bare `version` in an application query. (`skills`' view and the `last_updated` _column_ both stay untouched — only what the queries project for the token changes.)
2. Every concurrency predicate becomes `AND concurrency_token (version) = $(expectedToken)`. This is the one place `version` appears in application SQL without being wrapped for output — it's compared inside Postgres, never returned.
3. Every `UPDATE ... SET` gains `version = version + 1`. Keep `last_updated = $(lastUpdated)` as-is.
4. Row schemas replace `last_updated: dayjsSchema` with `concurrency_token: concurrencyTokenSchema` (imported from `#/domain/concurrency-token.js` — the same schema the domain already had) and `getConcurrencyToken: () => data.concurrency_token`. No hashing happens here; the column already holds the finished token.

`insert.sql` does **not** set `version` — the `DEFAULT 1` covers it — but must `RETURNING ... concurrency_token (version) AS concurrency_token` so the repository can mint the token for the created row without ever seeing the raw version.

- [ ] **Step 1: Convert the `example-kind` slice (worked reference)**

`src/infrastructure/persistence/example/kind/sql/get.sql` and `get-all.sql`: replace `last_updated` in the `SELECT` list with `concurrency_token (version) AS concurrency_token` (`get-all.sql` keeps its `ORDER BY id`).

`src/infrastructure/persistence/example/kind/sql/insert.sql`:

```sql
INSERT INTO
  example_kinds (id, name, last_updated)
VALUES
  ($(id), $(name), $(lastUpdated))
RETURNING
  id,
  name,
  concurrency_token (version) AS concurrency_token;
```

`src/infrastructure/persistence/example/kind/sql/update.sql`:

```sql
WITH
  current_row AS (
    SELECT
      1
    FROM
      example_kinds
    WHERE
      id = $(id)
  ),
  updated_row AS (
    UPDATE example_kinds
    SET
      name = $(name),
      last_updated = $(lastUpdated),
      version = version + 1
    WHERE
      id = $(id)
      AND concurrency_token (version) = $(expectedToken)
    RETURNING
      id,
      name,
      concurrency_token (version) AS concurrency_token
  )
SELECT
  updated_row.id,
  updated_row.name,
  updated_row.concurrency_token
FROM
  current_row
  LEFT JOIN updated_row ON TRUE;
```

`src/infrastructure/persistence/example/kind/sql/delete.sql`: change only the predicate line to `AND concurrency_token (version) = $(expectedToken)` — this one still reads raw `version`, since it's evaluated entirely inside Postgres and nothing is returned.

`src/infrastructure/persistence/example/kind/sql/example-kind.row.ts`:

<!-- prettier-ignore -->
```ts
import z from 'zod'

import { concurrencyTokenSchema } from '#/domain/concurrency-token.js'
import { ExampleKind } from '#/domain/example/kind/example-kind.js'
import { exampleKindIdSchema } from '#/domain/example/kind/example-kind-id.js'

export const exampleKindRow = z
  .strictObject({
    id: exampleKindIdSchema,
    name: z.string(),
    concurrency_token: concurrencyTokenSchema,
  })
  .transform(data => ({
    ...data,
    toDomain: () => new ExampleKind({ id: data.id, name: data.name }),
    getConcurrencyToken: () => data.concurrency_token,
  }))
  .readonly()
  .brand('example-kind-row')

export const exampleKindUpdateRow = z
  .union([
    z.strictObject({
      id: exampleKindIdSchema,
      name: z.string(),
      concurrency_token: concurrencyTokenSchema,
    }),
    z.strictObject({
      id: z.null(),
      name: z.null(),
      concurrency_token: z.null(),
    }),
  ])
  .readonly()
  .brand('example-kind-update-row')

export const exampleKindDeleteRow = z
  .union([z.strictObject({ id: exampleKindIdSchema }), z.strictObject({ id: z.null() })])
  .readonly()
  .brand('example-kind-delete-row')
```

Note `dayjsSchema` is no longer imported here, and neither is anything from `concurrency-token.codec.js` — it's gone. In `src/infrastructure/persistence/example/kind/example-kind.repository.ts`, the `update()` path currently rebuilds the token with `toConcurrencyToken(parsed.last_updated)` — change it to use `parsed.concurrency_token` directly; there is no function call, Postgres already returned the finished token. The `ITimeProvider` injection and the `lastUpdated` query parameter stay exactly as they are.

- [ ] **Step 2: Format, lint and test the `example-kind` slice**

```bash
npm run format:sql && npm run lint:sql
npx vitest run test/integration/persistence/example-kind.repository.test.ts
```

Expected: PASS unmodified. `test/integration/fixture/get-etags.ts` still reads `last_updated` and calls the now-deleted codec, so it won't even compile until Task 4 — if that breaks this file's test run, do Task 4 Step 1 now and come back.

- [ ] **Step 3: Convert the `team` slice**

Same four changes. `team/sql/update.sql` returns `id, name, concurrency_token`; `team.repository.ts`'s `update()` reconstructs `new Team({ id: parsed.id, name: parsed.name })` with `token: parsed.concurrency_token`.

- [ ] **Step 4: Convert the `example` slice**

Same four changes. `example/sql/update.sql` returns `id, name, example_kind_id, url, concurrency_token`.

- [ ] **Step 5: Convert the `skill` slice**

Same four changes, with two wrinkles:

- `skill/sql/get.sql` and `get-all.sql` read from `view_skills_with_examples`, which now exposes `version` (Task 1) — select `concurrency_token (version) AS concurrency_token` instead of `last_updated`.
- `skill/sql/update.sql` returns only `id`, and `skill.repository.ts` re-`get()`s afterwards to pick up the aggregated `example_ids`. Leave that shape alone; only the `SET` clause and the predicate change.

- [ ] **Step 6: Typecheck and lint everything**

```bash
npm run format:sql && npm run lint:sql && npm run lint:tsc && npm run lint:architecture && npm run lint:biome
```

Expected: all exit 0. `lint:tsc` passing here is the signal that no `Dayjs`-based token call sites — and no references to the deleted codec — remain anywhere.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/persistence
git commit -m "refactor(db): derive every entity's concurrency token from its version, in SQL only"
```

---

### Task 4: Update the test fixtures; delete the parity guard

**Files:**

- Modify: `test/integration/fixture/get-etags.ts`
- Modify: `test/util/concurrency-tokens.ts`
- Delete: `test/integration/persistence/concurrency-token.parity.test.ts`

`test/integration/fixture/fixture.sql` needs **no** change — it does not set `version`, so every fixture row gets `DEFAULT 1`.

- [ ] **Step 1: Point the ETag fixture at `concurrency_token()`**

In `test/integration/fixture/get-etags.ts`, change each of the four queries from `SELECT id, last_updated FROM <table>` to `SELECT id, concurrency_token (version) AS token FROM <table>`, change the row types from `{ id: …; last_updated: Dayjs }` to `{ id: …; token: string }`, and change `toEntry(lastUpdated: Dayjs)` to `toEntry(token: string)`, which now does `concurrencyTokenSchema.parse(token)` instead of calling a codec — import `concurrencyTokenSchema` from `#/domain/concurrency-token.js` instead of `toConcurrencyToken` from the (now-deleted) infrastructure codec. The `Dayjs` import is no longer needed, and neither is anything from `#/infrastructure/persistence/`.

Parsing the raw query result through `concurrencyTokenSchema` (rather than trusting the driver's string) keeps this fixture as a check that a real 32-character MD5 hex string comes back, so a regression in `concurrency_token()` itself surfaces here too rather than as a mystery `412`.

- [ ] **Step 2: Update the stale-token constant**

Replace `test/util/concurrency-tokens.ts`:

<!-- prettier-ignore -->
```ts
import { createHash } from 'node:crypto'

import { asConcurrencyToken } from '#/domain/concurrency-token.js'

// Well-formed but guaranteed not to match any row: real versions are always >= 1 (see the `version` column's
// DEFAULT in the migration) and only ever increase, so 0 never occurs, regardless of what the actual starting
// value happens to be. Hashed directly here, rather than via a shared codec, because production code never
// hashes a version in TypeScript at all — only Postgres's concurrency_token() does that.
export const STALE_CONCURRENCY_TOKEN = asConcurrencyToken(createHash('md5').update('0').digest('hex'))
```

- [ ] **Step 3: Delete the parity test**

```bash
git rm test/integration/persistence/concurrency-token.parity.test.ts
```

There is nothing left to keep in parity — `concurrency_token()` is the only implementation, and it's exercised by every repository integration test on every read and write. A test asserting Postgres agrees with itself has no content.

- [ ] **Step 4: Run the full suite**

```bash
npm run vitest
```

Expected: PASS. Any failure here is a genuine behavioural regression — investigate rather than adjust the assertion.

- [ ] **Step 5: Commit**

```bash
git add test/integration/fixture/get-etags.ts test/util/concurrency-tokens.ts
git commit -m "test: mint concurrency tokens from Postgres directly, no TypeScript-side hash"
```

---

### Task 5: Add a regression test for the bug this fixes

The whole point of the change is a scenario no existing test covers: two updates that a timestamp-derived token could not distinguish. With `version` this is trivially expressible — and it would have failed on the old implementation whenever both writes landed in the same millisecond.

**Files:** modify `test/integration/persistence/team.repository.test.ts` (or whichever repository test file you find most idiomatic — one slice is enough).

- [ ] **Step 1: Add the test**

Add a case that, with the time provider pinned to a **single fixed instant** for both writes:

1. reads a fixture team and captures its token;
2. updates it (succeeds), capturing the new token;
3. asserts the two tokens differ — under the old implementation they would have been identical, because `last_updated` was the same instant;
4. re-issues the _first_ update with the original, now-stale token and asserts it returns `err(new TeamConcurrencyError(id))`.

Use the existing `mockTimeProvider` wiring in that file so both writes genuinely share one timestamp; that is what makes this a regression test rather than a restatement of the happy path. Follow the `writing-tests` assertion convention: `expect(result).toEqual(err(new TeamConcurrencyError(id)))`.

- [ ] **Step 2: Verify it fails against the old implementation (optional but recommended)**

`git stash` the working tree, check out the pre-Task-1 state, apply just this test, and confirm it fails. This is the only step that proves the test has teeth. Restore afterwards.

- [ ] **Step 3: Run and commit**

```bash
npx vitest run test/integration/persistence/team.repository.test.ts
git add test/integration/persistence/team.repository.test.ts
git commit -m "test: cover same-instant updates producing distinct concurrency tokens"
```

---

### Task 6: Documentation

**Files:**

- Modify: `docs/003-concurrency-token-hashing.md`
- Modify: `docs/architecture-review.md`
- Modify: `.claude/skills/database-changes/SKILL.md` and `.claude/skills/database-changes/adding-a-repository.md`

`README.md` needs no change — the ADR keeps its number, title, and `status: accepted`, so the existing `- [003 – Concurrency Token Hashing](docs/003-concurrency-token-hashing.md)` entry is still accurate.

- [ ] **Step 1: Rewrite ADR 003 in place**

Replace the full contents of `docs/003-concurrency-token-hashing.md`. Keep the front-matter exactly as it is (`status: "accepted"`, `date: 2026-08-13`) — this is a rewrite of the existing decision, not a new one, so the record should read as though the `version`-based design was chosen the first time:

<!-- prettier-ignore -->
```md
---
status: "accepted"
date: 2026-08-13
---

# Concurrency Token Hashing

## Context and Problem Statement

Optimistic concurrency control is a cross-cutting concern, not a feature of any one entity: any mutable entity exposed over HTTP needs the same mechanism, designed once and reused rather than re-derived per entity. A client reading an entity gets back an ETag derived from that row's monotonic `version` counter and must present it as an `If-Match` header on a later update or delete; the server rejects the write if the row has changed since, via a single atomic SQL statement (`UPDATE/DELETE ... WHERE id = $(id) AND <token predicate>`) — no separate read, row lock, or extra round trip.

The token should not double as a readable encoding of the version — not because it's a security boundary (it isn't a credential, and a row's revision count isn't confidential), but because trivial one-line decodability is a needless internal-detail leak. Separately, token equality must be exactly equivalent to "the row has not changed": the same token must never legitimately apply to two different states of a row, no matter how many application instances are writing or how the system clock behaves. How should the token be produced so that it's opaque against casual inspection, cheap on every read and write, immune to any clock dependency, and usable inline in a single atomic SQL `WHERE` clause on the write path — without pulling in machinery this isn't actually a security boundary for, and without requiring a second implementation outside the database?

## Decision Drivers

- Token equality must be exactly equivalent to row equality — it must change whenever the row changes, never repeat for that row, and never depend on wall-clock time.
- Opacity against casual inspection, not cryptographic security — nothing about auth depends on this token being unforgeable.
- Must be usable inline in a single SQL `WHERE`/`SET` clause on the write path, not via a decode step.
- Should need only one implementation. TypeScript should never have to reproduce a hash PostgreSQL already computed — not just "must stay in sync," but structured so there's nothing that could drift.
- Runs on every read and write of every entity, so a deliberately slow, security-hardened hash is the wrong tool.
- Minimal new dependencies, consistent with [001](001-persistence-strategy.md)'s preference for narrowly-scoped, explicit tools.

## Considered Options

- Hashing PostgreSQL's `xmin` system column instead of an explicit counter
- A reversible encoding of the version (base64)
- A fast, non-cryptographic hash of the version requiring a new dependency (e.g. [FNV-1a](https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function) via [`@sindresorhus/fnv1a`](https://www.npmjs.com/package/@sindresorhus/fnv1a))
- MD5 hash of the version, computed entirely in PostgreSQL

## Decision Outcome

Chosen option: "MD5 hash of the version, computed entirely in PostgreSQL", because it is the only option where token equality is exactly row equality **and** the application needs no second implementation of the hash. The `version` column it hashes is a value the application controls completely — `BIGINT NOT NULL DEFAULT 1`, incremented by the very `UPDATE` statement the token predicate guards — so it cannot repeat for a given row, cannot regress, and has no dependency on any clock, unlike a system-maintained value such as `xmin`. MD5 then makes that counter non-reversible at a glance and needs no new npm dependency or Postgres extension. Because `md5()` is a PostgreSQL built-in, every query that needs a token — a plain read, an `INSERT ... RETURNING`, an `UPDATE ... RETURNING`, or the `WHERE`/`SET` predicate that validates one — calls the same `concurrency_token(version)` function inline, so the write path's atomic `UPDATE ... WHERE` comparison stays one SQL statement; TypeScript never derives, reconstructs, or re-hashes a token, it only ever receives and forwards the opaque string PostgreSQL already produced. MD5 is used purely as a fast, deterministic mixing function here, not for any cryptographic property — the same category of use as a hash-based cache key, not a security control.

- **PostgreSQL**: a `concurrency_token(BIGINT)` function (defined in [the migration that creates `skills`, `example_kinds`, and `examples`](../migrations/20260728160000000_skills_and_examples.sql)) computes `md5(version::text)`. Every repository query projects it directly — `SELECT concurrency_token(version) AS concurrency_token`, or `RETURNING ... concurrency_token(version) AS concurrency_token` — and the same expression appears in every `update`/`delete`'s `WHERE` clause, in the same statement that increments `version`.
- **TypeScript**: there is no codec. Row schemas parse the `concurrency_token` column straight into the domain's existing `ConcurrencyToken` type (`z.hash('md5')`, unchanged) — the token crosses the infrastructure boundary already in its final form.
- `version` itself never appears in a row schema or a repository return type — it exists purely as a column `concurrency_token()` reads inside SQL. Nothing in `src/` derives, parses, or brands a version number.
- Every mutable entity (`teams`, `skills`, `example_kinds`, `examples`) carries its own `version BIGINT NOT NULL DEFAULT 1`. `last_updated` stays on each table too, populated by the application clock (`ITimeProvider`) — a plain audit column, entirely independent of the concurrency mechanism.

### Consequences

- Good, because token equality is exactly row-change equality: the token cannot repeat for a row, cannot regress, and needs no coordination across application instances or database maintenance operations.
- Good, because the token isn't a one-line `Buffer.from(etag, 'base64')` away from revealing the version, unlike a reversible encoding.
- Good, because MD5 is fast and needs zero new dependencies — PostgreSQL's built-in `md5()` is already there.
- Good, because the write path keeps its single-statement, atomic optimistic-concurrency check, with no row lock or extra round trip.
- Good, because there is exactly one implementation. Nothing in TypeScript can drift out of sync with PostgreSQL's `md5()`, because nothing in TypeScript reimplements it.
- Bad, because MD5 offers no real cryptographic guarantee, and the pre-image space is small and enumerable — a `version` starts at 1 and increases by exactly 1 per write, so the token for any row's first several revisions is a widely-published MD5 value (`md5("1")`, `md5("2")`, …). Accepted deliberately, for the same reason as any hash used this way: the goal is closing off trivial one-line decoding, not building a secret, and a row's revision count is no more sensitive than its last-modified time would have been.

## Pros and Cons of the Options

### Hashing PostgreSQL's `xmin` system column

- Good, because it needs no schema change at all — every row already has it.
- Bad, because it changes spuriously after `VACUUM FREEZE` (frozen tuples get `FrozenTransactionId`), which would produce false `412`s unrelated to any real write.
- Bad, because it wraps around, so it isn't unbounded the way an explicit counter is.
- Bad, because it doesn't even remove the hashing question — `xmin` is a small sequential integer, so it would need the same opacity treatment as any other option here.

### A reversible encoding of the version (base64)

- Good, because it's the simplest possible implementation.
- Bad, because trivial decodability is exactly the property this token shouldn't have — unlike a hash, no lookup or brute force is even required; the value reads off directly.
- Bad, because validating "decodes to a plausible version" would couple the domain schema to an infrastructure-layer encoding detail it has no reason to know about.

### A fast, non-cryptographic hash requiring a new dependency ([FNV-1a](https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function))

- Good, because it's faster than a cryptographic hash and purpose-built for this exact shape of problem.
- Bad, because it doesn't exist in PostgreSQL, natively or via a common extension — validating it inline would mean either reimplementing it from scratch in SQL (a second, error-prone implementation of a comparatively obscure, multi-variant algorithm) or giving up single-statement atomicity for a locked read-then-write.
- Bad, because it's a new external dependency where the chosen option needs none.

### MD5 hash of the version, computed entirely in PostgreSQL

- Good, because it needs zero new dependencies and keeps the write path's atomic check a single statement.
- Good, because PostgreSQL is the only implementation — nothing in the application layer needs to reproduce the hash, so there is no second codebase to keep in sync and no parity test to maintain.
- Neutral, because a stronger cryptographic hash (SHA-256) or a keyed HMAC would close the brute-forceability gap noted above — but neither is warranted: this token secures nothing, so paying for genuine forgery-resistance or a signing secret would solve a problem this system doesn't have.

## More Information

This builds on [001](001-persistence-strategy.md): the same thin-execution-layer approach made it natural to add `concurrency_token()` as a small SQL function that every query calls directly, rather than reach for a Node-only hash and duplicate the computation across two languages. Using a dedicated `version` column rather than a database-maintained value like `xmin` keeps the token's only real invariant — monotonic, per-row, clock-free — under the application's own control rather than PostgreSQL's storage internals. If genuine forgery-resistance is ever needed (e.g. the token gets used somewhere authentication-adjacent), the right escalation is an HMAC keyed with a server-side secret, not a stronger unkeyed hash — but nothing in the current design needs that.
```

- [ ] **Step 2: Close out the finding**

In `docs/architecture-review.md`, mark critical finding 1 as resolved with a pointer to ADR 003. Leave the finding text itself intact so the review stays readable as a record.

- [ ] **Step 3: Close the documentation gap that let this spread**

The `database-changes` skill never mentions concurrency tokens, which is why `users` and `team-skill-proficiencies` were built without them. Add to `SKILL.md`'s non-negotiable rules, and to `adding-a-repository.md`'s end-to-end checklist, that a new mutable entity gets a `version BIGINT NOT NULL DEFAULT 1` column, `version = version + 1` in its `UPDATE`, the `concurrency_token (version) = $(expectedToken)` predicate in `update`/`delete`, every `SELECT`/`RETURNING` that needs the token projecting `concurrency_token (version) AS concurrency_token` (never bare `version`), a `getConcurrencyToken()` on its row schema, and `WithConcurrencyToken<T>` on its repository interface — or an explicit note in the ADR saying why it is exempt.

Every `.md` file in the repo is Prettier-formatted, so run `npm run format:markdown` afterwards or `npm run lint:markdown` will fail.

- [ ] **Step 4: Final verification and commit**

```bash
npm run test
```

Expected: lint + full test suite + openapi all pass. `docs/openapi.json` should come back **unchanged** — `EXAMPLE_ETAG` in `src/presentation/http/etag.ts` is computed independently of the codec and is deliberately untouched by this plan. If it did change, something reached further than intended.

```bash
git add docs .claude/skills/database-changes
git commit -m "docs: update ADR 003 for version-based concurrency tokens"
```

---

## Definition of done

- [ ] `version` exists on all four token-carrying tables, defaulting to 1 and incremented by every `UPDATE`.
- [ ] `concurrency_token()` takes a `BIGINT`; no query references `concurrency_token(last_updated)`.
- [ ] There is no TypeScript-side hash function and no `EntityVersion`/`entity-version.ts` — every token comes from PostgreSQL's `concurrency_token()`, and no code path derives one from a clock.
- [ ] No application query, row schema, or repository return type ever holds a raw `version` value — only `concurrency_token`.
- [ ] `last_updated` is untouched as a column and as an audit value.
- [ ] The domain layer is unchanged.
- [ ] A regression test covers two updates sharing one timestamp producing different tokens.
- [ ] ADR 003 rewritten in place to describe the version-based design, `architecture-review.md` updated, `database-changes` skill extended.
- [ ] `npm run test` passes.

## Out of scope (do not expand into these)

- Extending optimistic concurrency to `users` or `team-skill-proficiencies` (review findings 9 and 10).
- Moving `last_updated` from the application clock to a SQL-side `now()`.
- `If-None-Match` / `304` support (review finding 11).
- The transaction-retry work in [`task-serialization-failure-retries.md`](task-serialization-failure-retries.md).
