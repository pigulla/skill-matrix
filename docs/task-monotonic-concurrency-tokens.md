# Task: Derive Concurrency Tokens From a Monotonic Row Version

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to work through this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also load the project's `database-changes` and `writing-tests` skills before touching code — they carry the non-negotiable persistence and test conventions this plan assumes.

**Goal:** make ETag / `If-Match` optimistic concurrency actually correct by deriving the concurrency token from a monotonic per-row `version` counter instead of from an application-clock `last_updated` timestamp.

**Origin:** critical finding 1 of [`architecture-review.md`](architecture-review.md). Supersedes [ADR 003 – Concurrency Token Hashing](003-concurrency-token-hashing.md).

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
| A **new** migration file, not an edit of `20260728160000000_skills_and_examples.sql`. | `PendingMigrationsChecker` compares migration _names_, not contents, so editing an already-applied migration leaves every existing database silently on the old schema with the guard still green. A new file is the only change that is safe on a database that already ran the old one. |
| Keep the SQL function **named** `concurrency_token`, changing only its parameter type. | Every `update.sql`/`delete.sql` keeps the same call shape; only the argument changes from `last_updated` to `version`. |
| Reserve ADR number **005** for this work. | `004` is taken by [ADR 004 – DTO Construction](004-dto-construction.md); `006` is reserved by [`task-serialization-failure-retries.md`](task-serialization-failure-retries.md). If that plan lands first, keep 005 for this one anyway — do not renumber. |

### The one thing most likely to surprise you

`pg-promise` returns `BIGINT` (`int8`) as a **JavaScript string**, not a number, to avoid precision loss. `ConnectionProvider` only overrides the `TIMESTAMP`/`TIMESTAMPTZ` type parsers, so `int8` keeps the default string behaviour. This is _convenient_: the string PostgreSQL sends is the same decimal representation that `version::text` hashes, so TypeScript can hash it verbatim with no numeric conversion and parity is exact.

Do not "fix" this by converting to `number` or `bigint`. The Zod row schema below asserts the string form, so if this ever changes the tests fail loudly instead of tokens silently diverging.

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

- Create: `migrations/20260820120000000_entity_version_concurrency_tokens.sql`
- Verify with: `test/integration/fixture/migration-round-trip.test.ts` (existing, unmodified)

**Interfaces produced:** a `version BIGINT NOT NULL DEFAULT 1` column on `teams`, `skills`, `example_kinds`, `examples`; a SQL function `concurrency_token(version BIGINT) RETURNS TEXT` returning a 32-character lowercase hex string; `view_skills_with_examples` gains a `version` column. Every later task depends on these exact names.

- [ ] **Step 1: Write the migration**

Create `migrations/20260820120000000_entity_version_concurrency_tokens.sql`. Note the view is replaced with `CREATE OR REPLACE VIEW` (legal because `version` is _appended_ after the existing columns) but the Down migration must `DROP`/`CREATE` it, since `CREATE OR REPLACE VIEW` cannot remove a column.

```sql
-- Up Migration
ALTER TABLE teams
ADD COLUMN version BIGINT NOT NULL DEFAULT 1;

ALTER TABLE skills
ADD COLUMN version BIGINT NOT NULL DEFAULT 1;

ALTER TABLE example_kinds
ADD COLUMN version BIGINT NOT NULL DEFAULT 1;

ALTER TABLE examples
ADD COLUMN version BIGINT NOT NULL DEFAULT 1;

DROP FUNCTION concurrency_token (TIMESTAMPTZ);

CREATE FUNCTION concurrency_token (version BIGINT) RETURNS TEXT AS $$
  SELECT md5(version::TEXT)
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE VIEW view_skills_with_examples AS
SELECT
  skills.id,
  skills.name,
  skills.description,
  skills.last_updated,
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
  ) AS example_ids,
  skills.version
FROM
  skills
  LEFT JOIN examples_to_skills ON examples_to_skills.skill_id = skills.id
  LEFT JOIN examples ON examples.id = examples_to_skills.example_id
GROUP BY
  skills.id;

-- Down Migration
DROP VIEW view_skills_with_examples;

CREATE VIEW view_skills_with_examples AS
SELECT
  skills.id,
  skills.name,
  skills.description,
  skills.last_updated,
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

DROP FUNCTION concurrency_token (BIGINT);

CREATE FUNCTION concurrency_token (ts TIMESTAMPTZ) RETURNS TEXT AS $$
  SELECT md5(FLOOR(EXTRACT(EPOCH FROM ts) * 1000)::BIGINT::TEXT)
$$ LANGUAGE SQL IMMUTABLE;

ALTER TABLE examples
DROP COLUMN version;

ALTER TABLE example_kinds
DROP COLUMN version;

ALTER TABLE skills
DROP COLUMN version;

ALTER TABLE teams
DROP COLUMN version;
```

- [ ] **Step 2: Format and lint**

```bash
npm run format:sql && npm run lint:sql
```

Expected: both exit 0, and `format:sql` leaves no further diff.

- [ ] **Step 3: Verify the round trip**

```bash
npx vitest run test/integration/fixture/migration-round-trip.test.ts
```

Expected: PASS — every Up applies and every Down reverses cleanly with nothing left behind.

- [ ] **Step 4: Sanity-check the function against a real database**

```bash
npm run docker:compose-up
docker exec docker-db-1 psql -U postgres -d skillmatrix -tAc "SELECT concurrency_token(1::BIGINT);"
```

Expected: `c4ca4238a0b923820dcc509a6f75849b` (the MD5 of the string `1`). If the container name differs, find it with `docker compose --file docker/compose.yaml ps`.

Note: `npm run docker:compose-up` only applies migrations on first start. If your local database predates this migration, apply it explicitly (see [`.claude/skills/database-changes/migrations.md`](../.claude/skills/database-changes/migrations.md)) — the app will refuse to boot otherwise, by design.

- [ ] **Step 5: Commit**

```bash
git add migrations/20260820120000000_entity_version_concurrency_tokens.sql
git commit -m "feat(db): add per-row version column and version-based concurrency_token()"
```

---

### Task 2: Re-point the TypeScript codec at the version

**Files:**

- Create: `src/infrastructure/persistence/entity-version.ts`
- Modify: `src/infrastructure/persistence/concurrency-token.codec.ts`
- Modify: `src/infrastructure/persistence/concurrency-token.codec.test.ts`

**Interfaces consumed:** the `concurrency_token(BIGINT)` function from Task 1. **Interfaces produced:** `EntityVersion` / `entityVersionSchema`, and `toConcurrencyToken(version: EntityVersion): ConcurrencyToken`. The old `Dayjs`-taking signature is gone, so this task deliberately breaks the build until Task 3 completes — do not run the full suite in between.

- [ ] **Step 1: Rewrite the codec unit test first (TDD — it must fail)**

Replace the full contents of `src/infrastructure/persistence/concurrency-token.codec.test.ts`:

<!-- prettier-ignore -->
```ts
import { describe, expect, it } from 'vitest'

import { asEntityVersion } from './entity-version.js'
import { toConcurrencyToken } from './concurrency-token.codec.js'

describe('toConcurrencyToken', () => {
  it('should return a 32-character lowercase hex string', () => {
    expect(toConcurrencyToken(asEntityVersion('1'))).toMatch(/^[0-9a-f]{32}$/)
  })

  it('should return the md5 hash of the version as a decimal string', () => {
    expect(toConcurrencyToken(asEntityVersion('1'))).toBe('c4ca4238a0b923820dcc509a6f75849b')
    expect(toConcurrencyToken(asEntityVersion('2'))).toBe('c81e728d9d4c2f636f067f89cc14862c')
  })

  it('should return the same token for the same version', () => {
    expect(toConcurrencyToken(asEntityVersion('42'))).toBe(
      toConcurrencyToken(asEntityVersion('42')),
    )
  })

  it('should return a different token for every consecutive version', () => {
    const tokens = new Set(
      Array.from({ length: 100 }, (_, index) =>
        toConcurrencyToken(asEntityVersion(String(index + 1))),
      ),
    )

    expect(tokens.size).toBe(100)
  })
})

describe('asEntityVersion', () => {
  it.each<string>(['', '0.5', '-1', '1e3', 'abc', ' 1'])('should reject "%s"', value => {
    expect(() => asEntityVersion(value)).toThrow()
  })
})
```

```bash
npx vitest run src/infrastructure/persistence/concurrency-token.codec.test.ts
```

Expected: FAIL — `entity-version.js` does not exist yet.

- [ ] **Step 2: Add the version schema**

Create `src/infrastructure/persistence/entity-version.ts`:

<!-- prettier-ignore -->
```ts
import z from 'zod'

// pg-promise returns BIGINT (int8) as a string rather than a number, so a version arrives here in exactly the
// decimal form that Postgres's `version::TEXT` hashes. Keeping it a string all the way to the hash makes the
// TypeScript and SQL sides byte-identical with no numeric conversion, and avoids the 2^53 precision cliff.
// If the int8 type parser is ever overridden, this schema fails loudly instead of tokens silently diverging.
export const entityVersionSchema = z
  .string()
  .regex(/^[1-9]\d*$/, 'Expected a positive integer in decimal notation')
  .brand('entity-version')

export type EntityVersion = z.infer<typeof entityVersionSchema>

export function asEntityVersion(value: string): EntityVersion {
  return entityVersionSchema.parse(value)
}
```

- [ ] **Step 3: Rewrite the codec**

Replace the full contents of `src/infrastructure/persistence/concurrency-token.codec.ts`:

<!-- prettier-ignore -->
```ts
import { createHash } from 'node:crypto'

import { asConcurrencyToken, type ConcurrencyToken } from '#/domain/concurrency-token.js'

import type { EntityVersion } from './entity-version.js'

// Must stay in sync with the concurrency_token() Postgres function in
// migrations/20260820120000000_entity_version_concurrency_tokens.sql — see
// test/integration/persistence/concurrency-token.parity.test.ts, which guards the agreement.
export function toConcurrencyToken(version: EntityVersion): ConcurrencyToken {
  return asConcurrencyToken(createHash('md5').update(version).digest('hex'))
}
```

- [ ] **Step 4: Confirm the unit test passes**

```bash
npx vitest run src/infrastructure/persistence/concurrency-token.codec.test.ts
```

Expected: PASS. `npm run lint:tsc` will still fail at this point — the four repositories and their row schemas still pass a `Dayjs`. That is fixed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/entity-version.ts \
  src/infrastructure/persistence/concurrency-token.codec.ts \
  src/infrastructure/persistence/concurrency-token.codec.test.ts
git commit -m "feat: derive concurrency tokens from a monotonic entity version"
```

---

### Task 3: Migrate the four persistence slices

One task, because the codec signature changed in Task 2 and the project does not compile until every caller is converted.

Work slice by slice, in this order — `example-kind` is the simplest and is written out in full below; the other three follow the identical shape.

**Files (per slice `<s>` in `example/kind`, `team`, `example`, `skill`):**

- Modify: `src/infrastructure/persistence/<s>/sql/get.sql`, `get-all.sql`, `insert.sql`, `update.sql`, `delete.sql`
- Modify: `src/infrastructure/persistence/<s>/sql/*.row.ts`
- Modify: `src/infrastructure/persistence/<s>/<name>.repository.ts`

**The four mechanical changes, everywhere:**

1. Every `SELECT` / `RETURNING` list that names `last_updated` for token purposes names `version` instead. (`skills`' view and the `last_updated` _column_ both stay — only what the queries read changes.)
2. Every concurrency predicate becomes `AND concurrency_token (version) = $(expectedToken)`.
3. Every `UPDATE ... SET` gains `version = version + 1`. Keep `last_updated = $(lastUpdated)` as-is.
4. Row schemas replace `last_updated: dayjsSchema` with `version: entityVersionSchema` and `getConcurrencyToken: () => toConcurrencyToken(data.version)`.

`insert.sql` does **not** set `version` — the `DEFAULT 1` covers it — but must `RETURNING ... version` so the repository can mint the token for the created row.

- [ ] **Step 1: Convert the `example-kind` slice (worked reference)**

`src/infrastructure/persistence/example/kind/sql/get.sql` and `get-all.sql`: replace `last_updated` with `version` in the `SELECT` list (`get-all.sql` keeps its `ORDER BY id`).

`src/infrastructure/persistence/example/kind/sql/insert.sql`:

```sql
INSERT INTO
  example_kinds (id, name, last_updated)
VALUES
  ($(id), $(name), $(lastUpdated))
RETURNING
  id,
  name,
  version;
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
      version
  )
SELECT
  updated_row.id,
  updated_row.name,
  updated_row.version
FROM
  current_row
  LEFT JOIN updated_row ON TRUE;
```

`src/infrastructure/persistence/example/kind/sql/delete.sql`: change only the predicate line to `AND concurrency_token (version) = $(expectedToken)`.

`src/infrastructure/persistence/example/kind/sql/example-kind.row.ts`:

<!-- prettier-ignore -->
```ts
import z from 'zod'

import { ExampleKind } from '#/domain/example/kind/example-kind.js'
import { exampleKindIdSchema } from '#/domain/example/kind/example-kind-id.js'

import { toConcurrencyToken } from '../../../concurrency-token.codec.js'
import { entityVersionSchema } from '../../../entity-version.js'

export const exampleKindRow = z
  .strictObject({
    id: exampleKindIdSchema,
    name: z.string(),
    version: entityVersionSchema,
  })
  .transform(data => ({
    ...data,
    toDomain: () => new ExampleKind({ id: data.id, name: data.name }),
    getConcurrencyToken: () => toConcurrencyToken(data.version),
  }))
  .readonly()
  .brand('example-kind-row')

export const exampleKindUpdateRow = z
  .union([
    z.strictObject({
      id: exampleKindIdSchema,
      name: z.string(),
      version: entityVersionSchema,
    }),
    z.strictObject({
      id: z.null(),
      name: z.null(),
      version: z.null(),
    }),
  ])
  .readonly()
  .brand('example-kind-update-row')

export const exampleKindDeleteRow = z
  .union([z.strictObject({ id: exampleKindIdSchema }), z.strictObject({ id: z.null() })])
  .readonly()
  .brand('example-kind-delete-row')
```

Note `dayjsSchema` is no longer imported here. In `src/infrastructure/persistence/example/kind/example-kind.repository.ts`, the `update()` path currently rebuilds the token with `toConcurrencyToken(parsed.last_updated)` — change it to `toConcurrencyToken(parsed.version)`. The `ITimeProvider` injection and the `lastUpdated` query parameter stay exactly as they are.

- [ ] **Step 2: Format, lint and test the `example-kind` slice**

```bash
npm run format:sql && npm run lint:sql
npx vitest run test/integration/persistence/example-kind.repository.test.ts
```

Expected: PASS unmodified. `test/integration/fixture/get-etags.ts` still reads `last_updated`, so it will mint wrong tokens until Task 4 — if the stale-token cases in this file fail, do Task 4 Step 1 now and come back.

- [ ] **Step 3: Convert the `team` slice**

Same four changes. `team/sql/update.sql` returns `id, name, version`; `team.repository.ts`'s `update()` reconstructs `new Team({ id: parsed.id, name: parsed.name })` with `token: toConcurrencyToken(parsed.version)`.

- [ ] **Step 4: Convert the `example` slice**

Same four changes. `example/sql/update.sql` returns `id, name, example_kind_id, url, version`.

- [ ] **Step 5: Convert the `skill` slice**

Same four changes, with two wrinkles:

- `skill/sql/get.sql` and `get-all.sql` read from `view_skills_with_examples`, which now exposes `version` (Task 1) — select `version` instead of `last_updated`.
- `skill/sql/update.sql` returns only `id`, and `skill.repository.ts` re-`get()`s afterwards to pick up the aggregated `example_ids`. Leave that shape alone; only the `SET` clause and the predicate change.

- [ ] **Step 6: Typecheck and lint everything**

```bash
npm run format:sql && npm run lint:sql && npm run lint:tsc && npm run lint:architecture && npm run lint:biome
```

Expected: all exit 0. `lint:tsc` passing here is the signal that no `Dayjs`-based token call sites remain.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/persistence
git commit -m "refactor(db): derive every entity's concurrency token from its version"
```

---

### Task 4: Update the test fixtures and the parity guard

**Files:**

- Modify: `test/integration/fixture/get-etags.ts`
- Modify: `test/util/concurrency-tokens.ts`
- Modify: `test/integration/persistence/concurrency-token.parity.test.ts`

`test/integration/fixture/fixture.sql` needs **no** change — it does not set `version`, so every fixture row gets `DEFAULT 1`.

- [ ] **Step 1: Point the ETag fixture at `version`**

In `test/integration/fixture/get-etags.ts`, change each of the four queries from `SELECT id, last_updated FROM <table>` to `SELECT id, version FROM <table>`, change the row types from `{ id: …; last_updated: Dayjs }` to `{ id: …; version: EntityVersion }`, and change `toEntry(lastUpdated: Dayjs)` to `toEntry(version: EntityVersion)`. Import `EntityVersion` from `#/infrastructure/persistence/entity-version.js`; the `Dayjs` import is no longer needed.

Because the queries are raw and untyped, add a `entityVersionSchema.parse(row.version)` (or assert the shape in `toEntry`) so a type-parser regression surfaces here too rather than as a mystery `412`.

- [ ] **Step 2: Update the stale-token constant**

Replace `test/util/concurrency-tokens.ts`:

<!-- prettier-ignore -->
```ts
import { toConcurrencyToken } from '#/infrastructure/persistence/concurrency-token.codec.js'
import { asEntityVersion } from '#/infrastructure/persistence/entity-version.js'

// Well-formed but guaranteed not to match any row: versions start at 1 and only ever increase, and no test
// updates a fixture row anywhere near this many times.
export const STALE_CONCURRENCY_TOKEN = toConcurrencyToken(asEntityVersion('999999'))
```

- [ ] **Step 3: Rewrite the parity test**

In `test/integration/persistence/concurrency-token.parity.test.ts`, keep the harness exactly as it is and replace the `it.each` block:

<!-- prettier-ignore -->
```ts
it.each<string>(['1', '2', '10', '999999', '9007199254740993'])(
  'should compute the same token in TypeScript and in Postgres for version %s',
  async version => {
    const fromTypescript = toConcurrencyToken(asEntityVersion(version))
    const { fromPostgres } = await db.one<{ fromPostgres: string }>(
      'SELECT concurrency_token($(version)::BIGINT) AS "fromPostgres"',
      { version },
    )

    expect(fromPostgres).toBe(fromTypescript)
  },
)

it('should return the version as a string, so the hash input is byte-identical on both sides', async () => {
  const { version } = await db.one<{ version: unknown }>('SELECT 1::BIGINT AS version')

  expect(typeof version).toBe('string')
})
```

Adjust the imports (`asEntityVersion` in, `dayjs` out) and update the `describe` title. The `9007199254740993` case is deliberate: it is `Number.MAX_SAFE_INTEGER + 2`, so it fails if anyone ever routes the version through a JS `number`. The second test pins the `int8`-as-string assumption directly.

- [ ] **Step 4: Run the full suite**

```bash
npm run vitest
```

Expected: PASS. Any failure here is a genuine behavioural regression — investigate rather than adjust the assertion.

- [ ] **Step 5: Commit**

```bash
git add test/
git commit -m "test: assert concurrency-token parity against the row version"
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

- Create: `docs/005-optimistic-concurrency-versioning.md`
- Modify: `docs/003-concurrency-token-hashing.md`
- Modify: `README.md`
- Modify: `docs/architecture-review.md`
- Modify: `.claude/skills/database-changes/SKILL.md` and `.claude/skills/database-changes/adding-a-repository.md`

- [ ] **Step 1: Write ADR 005**

Follow the structure of the three existing ADRs (front-matter with `status` and `date`, Context and Problem Statement, Decision Drivers, Considered Options, Decision Outcome, Consequences, Pros and Cons, More Information). Considered options: reversible timestamp encoding (already rejected in 003), hashed timestamp (003's choice — record _why_ it is being replaced, using the lost-update walkthrough above), `xmin`, and the chosen monotonic `version` column. Be explicit that this supersedes 003 and that the domain-level decision from 003 — the token is an opaque MD5 hash the domain knows nothing about — is retained, not reversed.

- [ ] **Step 2: Mark ADR 003 superseded**

Change its front-matter `status` to `superseded by [005](005-optimistic-concurrency-versioning.md)` and add one sentence at the top of the document pointing at 005. Do not delete or rewrite its body — the reasoning is still the historical record.

- [ ] **Step 3: Update the README's decision-record list**

Add `- [005 – Optimistic Concurrency Versioning](docs/005-optimistic-concurrency-versioning.md)` and mark the 003 entry as superseded.

- [ ] **Step 4: Close out the finding**

In `docs/architecture-review.md`, mark critical finding 1 as resolved with a pointer to ADR 005. Leave the finding text itself intact so the review stays readable as a record.

- [ ] **Step 5: Close the documentation gap that let this spread**

The `database-changes` skill never mentions concurrency tokens, which is why `users` and `team-skill-proficiencies` were built without them. Add to `SKILL.md`'s non-negotiable rules, and to `adding-a-repository.md`'s end-to-end checklist, that a new mutable entity gets a `version BIGINT NOT NULL DEFAULT 1` column, `version = version + 1` in its `UPDATE`, the `concurrency_token (version) = $(expectedToken)` predicate in `update`/`delete`, a `getConcurrencyToken()` on its row schema, and `WithConcurrencyToken<T>` on its repository interface — or an explicit note in the ADR saying why it is exempt.

Every `.md` file in the repo is Prettier-formatted, so run `npm run format:markdown` afterwards or `npm run lint:markdown` will fail.

- [ ] **Step 6: Final verification and commit**

```bash
npm run test
```

Expected: lint + full test suite + openapi all pass. `docs/openapi.json` should come back **unchanged** — `EXAMPLE_ETAG` in `src/presentation/http/etag.ts` is computed independently of the codec and is deliberately untouched by this plan. If it did change, something reached further than intended.

```bash
git add docs README.md .claude/skills/database-changes
git commit -m "docs: record version-based optimistic concurrency in ADR 005"
```

---

## Definition of done

- [ ] `version` exists on all four token-carrying tables, defaulting to 1 and incremented by every `UPDATE`.
- [ ] `concurrency_token()` takes a `BIGINT`; no query references `concurrency_token(last_updated)`.
- [ ] `toConcurrencyToken()` takes an `EntityVersion`; no code path derives a token from a clock.
- [ ] `last_updated` is untouched as a column and as an audit value.
- [ ] The domain layer is unchanged.
- [ ] Parity test covers a value beyond `Number.MAX_SAFE_INTEGER` and pins `int8`-as-string.
- [ ] A regression test covers two updates sharing one timestamp producing different tokens.
- [ ] ADR 005 written, ADR 003 marked superseded, README and review updated, `database-changes` skill extended.
- [ ] `npm run test` passes.

## Out of scope (do not expand into these)

- Extending optimistic concurrency to `users` or `team-skill-proficiencies` (review findings 9 and 10).
- Moving `last_updated` from the application clock to a SQL-side `now()`.
- `If-None-Match` / `304` support (review finding 11).
- The transaction-retry work in [`task-serialization-failure-retries.md`](task-serialization-failure-retries.md).
