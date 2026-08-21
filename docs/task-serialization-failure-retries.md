# Task: Retry Transient Serialization Failures at the Transaction Boundary

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to work through this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also load the project's `writing-tests` skill before touching tests, and read `AGENTS.md` § Error handling — this plan changes a documented invariant of `@ResultTransactional()`.

**Goal:** stop turning PostgreSQL's expected "retry this transaction" signals into HTTP `500`s, by retrying `40001 serialization_failure` and `40P01 deadlock_detected` at the one place that owns the transaction boundary.

**Origin:** critical finding 2 of [`architecture-review.md`](architecture-review.md).

---

## Context: why this is broken today

Two facts combine badly.

**1. Every request runs in a `SERIALIZABLE` transaction.** `src/infrastructure/persistence/default-transaction-options.ts` sets serializable isolation as the default for the `@nestjs-cls/transactional` adapter, and _every_ public method of _every_ application service carries `@ResultTransactional()` (`src/util/result-transactional.decorator.ts`) — reads included, per the uniformity rule in `AGENTS.md`.

**2. Nothing anywhere handles a serialization failure.** `grep -rn "40001\|SERIALIZATION_FAILURE\|retry" src/` finds nothing outside the unused constant table in `src/infrastructure/persistence/error/error-codes.ts`. The three error-translation helpers (`isUniqueConstraintViolation`, `isForeignKeyViolation`, `isRestrictViolation`) cover integrity violations only, so a `40001` falls into every repository's catch-all:

<!-- prettier-ignore -->
```ts
throw new UnexpectedPersistenceError(error as Error)
```

…which `DomainErrorsExceptionFilter` does not recognise, so it surfaces as `500 Internal Server Error`.

Under serializable isolation a `40001` is **not** a bug and **not** an infrastructure failure. It is the documented, expected way PostgreSQL says "your transaction would have violated serializability; run it again". The current design converts a normal, expected outcome into a server error — one that also gets logged as an unexpected failure, so it will read as an incident rather than as contention.

Concretely: two clients updating two _different_ skills can conflict through predicate locks on a shared index range, and one of them gets a `500` for doing nothing wrong. There is no test covering this path, because there is no code covering it.

**Secondary cost, recorded but out of scope:** every read path (`getAll`, `get`) pays a `BEGIN`/`COMMIT` round trip plus SIREAD predicate-lock bookkeeping for what is a single `SELECT`. See "Out of scope" below.

---

## Decisions already made — do not re-litigate

| Decision | Rationale |
| --- | --- |
| Retry inside `ResultTransactional`, not in repositories or controllers. | It is the only component that owns a transaction's lifetime. A retry anywhere below it cannot restart the transaction; anywhere above it cannot see that one is in play. |
| Retry **only** when this decorator actually _starts_ the transaction — guard on `txHost.isTransactionActive()`. | `@nestjs-cls/transactional` defaults to `Propagation.Required`, so a decorated repository method called from a decorated service method _joins_ the open transaction. Retrying there is worse than useless: after a `40001` the whole transaction is already aborted, so the inner retry's first statement fails with `25P02 in_failed_sql_transaction`. Exactly one retry loop, at the outermost boundary. |
| 3 attempts total (2 retries), exponential backoff with full jitter from a 20 ms base. | Serialization conflicts resolve almost immediately; the point of jitter is to stop two conflicting callers from re-colliding in lockstep. Worst-case added latency is well under 100 ms, and an exhausted retry still surfaces the original error rather than swallowing it. |
| An `Err` result is **never** retried. | An `Err` is an expected domain outcome (not-found, duplicate, stale token). Retrying it would repeat a deterministic failure and, worse, blur the two error channels ADR 002 exists to keep apart. |
| Keep `SERIALIZABLE` as the default isolation level in this change. | Dropping to `READ COMMITTED` is a defensible but _separate_ decision with its own analysis (the write paths are already guarded by the optimistic-concurrency predicate, but the read-modify-write flows in the services are not). Record the reasoning in ADR 006; change nothing. |
| The retryable-error predicate lives in `src/util/`, duplicating two SQLSTATE literals. | `src/util` may not import `src/infrastructure` (`lint:architecture`), so it cannot reach `ERROR_CODES`. Two string literals plus a comment cross-referencing `error-codes.ts` is the smallest honest answer. Do **not** move `error-codes.ts` into `util` to dodge this — that makes `util` more of a dumping ground, which is review finding 3. The duplication disappears when finding 3's `ITransactionRunner` port lands. |
| Reserve ADR number **006** for this work. | `004` is taken by [ADR 004 – DTO Construction](004-dto-construction.md); `005` is reserved by [`task-monotonic-concurrency-tokens.md`](task-monotonic-concurrency-tokens.md). Use `006` even if this plan lands first — do not renumber. |

### The invariant this introduces

Retrying means **re-executing the decorated method body**. Anything it does is done again. Today that is safe: every `@ResultTransactional()` method does database work and nothing else (a re-generated UUID from `I<Entity>UuidProvider` differs between attempts, which is harmless because the first attempt rolled back).

From now on that safety is a _requirement_, not an accident: a `@ResultTransactional()` method must not perform side effects outside the database — no outbound HTTP call, no message publish, no file write. Task 3 documents this in `AGENTS.md`.

---

## Global constraints

- No new npm dependency. `pg-protocol` (which exports `DatabaseError`) is already a direct dependency and is already used by the three `is*Violation` helpers.
- `npm run lint:architecture` must stay green. `src/util` may import external packages but no other layer.
- `npm run lint:tsc` must pass after every TypeScript edit.
- Every existing test must keep passing unchanged. This change adds behaviour on a path that currently has no coverage; it must not alter commit/rollback semantics for success, `Err`, or non-retryable throws.
- Conventional Commits; commit at the end of each task.
- Integration tests need Docker running (Testcontainers).
- `npm run test` must pass before the final commit.

---

### Task 1: The retryable-error predicate

**Files:**

- Create: `src/util/is-retryable-transaction-error.ts`
- Create: `src/util/is-retryable-transaction-error.test.ts`

**Interfaces produced:** `isRetryableTransactionError(error: unknown): boolean`. Task 2 depends on it.

This is a pure function with no database access and no `@ResultTransactional()`, so it is exactly what `.claude/skills/writing-tests/unit-tests.md` says to unit-test, colocated in `src/`.

- [ ] **Step 1: Write the failing unit test**

Create `src/util/is-retryable-transaction-error.test.ts`:

<!-- prettier-ignore -->
```ts
import { DatabaseError } from 'pg-protocol'
import { describe, expect, it } from 'vitest'

import { isRetryableTransactionError } from './is-retryable-transaction-error.js'

function databaseError(code: string | undefined): DatabaseError {
  const error = new DatabaseError('simulated', 0, 'error')
  error.code = code
  return error
}

describe('isRetryableTransactionError', () => {
  it.each<[string, string]>([
    ['40001', 'serialization_failure'],
    ['40P01', 'deadlock_detected'],
  ])('should return true for %s (%s)', code => {
    expect(isRetryableTransactionError(databaseError(code))).toBe(true)
  })

  it.each<[string, string]>([
    ['23505', 'unique_violation'],
    ['23503', 'foreign_key_violation'],
    ['23001', 'restrict_violation'],
    ['25P02', 'in_failed_sql_transaction'],
    ['40002', 'transaction_integrity_constraint_violation'],
  ])('should return false for %s (%s)', code => {
    expect(isRetryableTransactionError(databaseError(code))).toBe(false)
  })

  it('should return false for a DatabaseError without a code', () => {
    expect(isRetryableTransactionError(databaseError(undefined))).toBe(false)
  })

  it.each<[string, unknown]>([
    ['a plain Error', new Error('40001')],
    ['a string', '40001'],
    ['null', null],
    ['undefined', undefined],
  ])('should return false for %s', (_label, value) => {
    expect(isRetryableTransactionError(value)).toBe(false)
  })
})
```

```bash
npx vitest run src/util/is-retryable-transaction-error.test.ts
```

Expected: FAIL — the module does not exist.

- [ ] **Step 2: Implement it**

Create `src/util/is-retryable-transaction-error.ts`:

<!-- prettier-ignore -->
```ts
import { DatabaseError } from 'pg-protocol'

// These two SQLSTATEs are duplicated from ERROR_CODES.TRANSACTION_ROLLBACK
// (src/infrastructure/persistence/error/error-codes.ts) because src/util must not import from
// src/infrastructure (enforced by npm run lint:architecture). Keep them in sync by hand until the
// transaction boundary moves behind an application-layer port.
const SERIALIZATION_FAILURE = '40001'
const DEADLOCK_DETECTED = '40P01'

/**
 * True for the two PostgreSQL errors that mean "this transaction did not commit, but running it again may
 * well succeed". Under SERIALIZABLE isolation these are expected outcomes of contention, not failures.
 *
 * Deliberately narrow: 40002 (transaction_integrity_constraint_violation) and 25P02
 * (in_failed_sql_transaction) are also in class 40/25 but are deterministic — retrying them just fails again.
 */
export function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof DatabaseError &&
    (error.code === SERIALIZATION_FAILURE || error.code === DEADLOCK_DETECTED)
  )
}
```

- [ ] **Step 3: Verify and commit**

```bash
npx vitest run src/util/is-retryable-transaction-error.test.ts
npm run lint:tsc && npm run lint:architecture && npm run lint:biome
git add src/util/is-retryable-transaction-error.ts src/util/is-retryable-transaction-error.test.ts
git commit -m "feat: add a predicate for retryable PostgreSQL transaction errors"
```

`lint:architecture` passing here is the check that matters — it confirms the `util` boundary is intact.

---

### Task 2: Retry loop in `ResultTransactional`

**Files:**

- Modify: `src/util/result-transactional.decorator.ts`
- Modify: `test/integration/util/result-transactional.decorator.test.ts`

**Interfaces consumed:** `isRetryableTransactionError` from Task 1, `TransactionHost.isTransactionActive()` from `@nestjs-cls/transactional`.

The current implementation wraps a single `txHost.withTransaction(...)` call in `ResultAsync.fromPromise`, using an internal `RollbackSignal` to force a rollback on `Err`. Keep that mechanism exactly as it is; the change is that the `withTransaction` call moves into a loop.

- [ ] **Step 1: Write the failing tests first**

In `test/integration/util/result-transactional.decorator.test.ts`, extend the existing `ResultTransactionalTestService` with an attempt counter and these methods (keep the four existing test cases untouched — they are the regression guard that commit/rollback semantics did not change):

- `public attempts = 0` — incremented at the top of every method below.
- `failsThenSucceeds(failures: number)`: throws a synthetic `DatabaseError` with `code = '40001'` while `attempts <= failures`, otherwise inserts a row and resolves `Ok`.
- `alwaysFailsRetryably()`: always throws a synthetic `40001`.
- `failsWithNonRetryableDatabaseError()`: always throws a synthetic `DatabaseError` with `code = '23505'`.
- `countedErr()`: inserts a row, then resolves `errAsync(new TestError(...))`.
- `outerCallingInner(inner)`: a second injectable service whose `@ResultTransactional()` method throws a synthetic `40001` on its first invocation, called from an outer `@ResultTransactional()` method — used for the nesting case below.
- `incrementViaReadThenWrite(hook: () => Promise<void>)`: `SELECT value FROM test_counters WHERE id = 1`, then `await hook()`, then `UPDATE test_counters SET value = $(value) WHERE id = 1` with `value + 1`. The injected hook is what lets a test control the interleaving.

Add `test_counters` alongside the existing `test_rows` in `beforeEach`:

<!-- prettier-ignore -->
```ts
await db.none('CREATE TABLE test_counters (id INT PRIMARY KEY, value INT NOT NULL)')
await db.none('INSERT INTO test_counters (id, value) VALUES (1, 0)')
```

Then the cases:

| Test | Assertion |
| --- | --- |
| retries a `40001` and succeeds | `failsThenSucceeds(1)` resolves `Ok`, `attempts === 2`, and the row from the _successful_ attempt is committed (exactly one row in `test_rows`). |
| gives up after 3 attempts | `alwaysFailsRetryably()` rejects with the original `DatabaseError` (not a wrapped one), `attempts === 3`, `test_rows` empty. |
| does not retry a non-retryable `DatabaseError` | `failsWithNonRetryableDatabaseError()` rejects, `attempts === 1`. |
| does not retry an `Err` result | `countedErr()` resolves `err(new TestError(...))`, `attempts === 1`, `test_rows` empty (still rolled back). |
| retries only at the outermost boundary | `outerCallingInner(...)` resolves `Ok`; the inner method was invoked exactly **twice**, not four times. Two invocations means the outer loop re-ran the whole thing once and the inner never opened a loop of its own. Four would mean nested retry loops — and the inner's own retry would in fact fail with `25P02`, since a `40001` aborts the entire transaction. |
| recovers from real contention | See Step 2. |

Use `it.each` for the table-driven variants where it reads naturally, and note that these tests assert on a rejected promise (`.rejects.toThrow(...)`), which is correct here: a genuinely thrown, non-`Result` failure is exactly the case `writing-tests` reserves `.rejects` for.

- [ ] **Step 2: Write the real-contention test**

This is the end-to-end proof that the synthetic tests cannot give you. Deterministic sequence:

1. Start call **A** to `incrementViaReadThenWrite` with a hook that resolves a `aHasRead` promise and then awaits a `releaseA` promise. Do not await A yet.
2. `await aHasRead` — A has now taken its serializable snapshot.
3. Run call **B** to `incrementViaReadThenWrite` with a no-op hook, to completion. B reads `0`, writes `1`, commits.
4. Resolve `releaseA`, then await A. A's `UPDATE` now targets a row that a concurrent transaction has committed over, so PostgreSQL raises `40001` — either at the `UPDATE` or at `COMMIT`; the decorator catches both.
5. Assert A resolved `Ok`, and that `SELECT value FROM test_counters WHERE id = 1` is **2**.

The final value is the assertion that matters: `2` is only reachable if A re-read after B committed. Without the retry, A rejects and the value stays `1`.

```bash
npx vitest run test/integration/util/result-transactional.decorator.test.ts
```

Expected: the four pre-existing cases PASS; every new case FAILS.

- [ ] **Step 3: Implement the retry loop**

Rewrite `src/util/result-transactional.decorator.ts`. Keep `RollbackSignal`, `copyMethodMetadata`, and the outer `ResultAsync.fromPromise(..., error => error instanceof RollbackSignal ? error.cause : throw error)` shape. The new structure:

<!-- prettier-ignore -->
```ts
const MAX_ATTEMPTS = 3
const BASE_DELAY_MS = 20

const logger = new Logger('ResultTransactional')

function backoffDelay(attempt: number): number {
  // Full jitter: two callers that just collided must not retry in lockstep.
  return Math.random() * BASE_DELAY_MS * 2 ** (attempt - 1)
}
```

Inside `wrapped`:

<!-- prettier-ignore -->
```ts
const txHost = TransactionHost.getInstance<TransactionalAdapterPgPromise>(connectionName)

const runOnce = async (): Promise<unknown> =>
  txHost.withTransaction(async () => {
    const result = (await original.apply(this, args)) as Result<unknown, Error>

    if (result.isErr()) {
      throw new RollbackSignal(result.error)
    }

    return result.value
  })

// A transaction that is already open belongs to an outer @ResultTransactional(): Propagation.Required
// means this call joins it rather than starting its own. Retrying here cannot help — a serialization
// failure has already aborted the outer transaction — so the outermost boundary owns the only retry loop.
const run = async (): Promise<unknown> => {
  if (txHost.isTransactionActive()) {
    return runOnce()
  }

  for (let attempt = 1; ; attempt++) {
    try {
      return await runOnce()
    } catch (error) {
      if (
        error instanceof RollbackSignal ||
        attempt >= MAX_ATTEMPTS ||
        !isRetryableTransactionError(error)
      ) {
        throw error
      }

      const delay = backoffDelay(attempt)
      logger.warn(
        { attempt, maxAttempts: MAX_ATTEMPTS, delay, code: (error as DatabaseError).code },
        'Retrying transaction after a transient serialization failure',
      )
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

return ResultAsync.fromPromise(run(), error => {
  if (error instanceof RollbackSignal) {
    return error.cause
  }

  throw error
})
```

Points to get right:

- `RollbackSignal` is checked **before** the retry predicate. An `Err` must never be retried, and a `RollbackSignal` is not a `DatabaseError` anyway — the explicit check documents the intent.
- The loop rethrows the **original** error on exhaustion. Do not wrap it; the repositories' error mappers and `UnexpectedPersistenceError` still see what they saw before.
- `logger.warn` uses the `(object, message)` overload, matching `ConnectionProvider`'s existing style. A module-level `Logger` is used because the decorator is a free function, not an injectable.

- [ ] **Step 4: Verify**

```bash
npx vitest run test/integration/util/result-transactional.decorator.test.ts
npm run lint:tsc && npm run lint:architecture && npm run lint:biome
npm run vitest
```

Expected: all new and pre-existing cases PASS, the whole suite PASS, lint clean. If `lint:biome` objects to `Math.random()` or the `setTimeout` promise, follow its guidance rather than adding a blanket ignore.

- [ ] **Step 5: Commit**

```bash
git add src/util/result-transactional.decorator.ts test/integration/util/result-transactional.decorator.test.ts
git commit -m "fix: retry transient serialization failures at the transaction boundary"
```

---

### Task 3: Documentation

**Files:**

- Create: `docs/006-transaction-isolation-and-retry-policy.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/architecture-review.md`

- [ ] **Step 1: Write ADR 006**

Follow the structure of the existing ADRs (front-matter with `status` and `date`, Context and Problem Statement, Decision Drivers, Considered Options, Decision Outcome, Consequences, Pros and Cons of the Options, More Information). Options to record:

1. **Status quo** — a `40001` becomes `UnexpectedPersistenceError` → `500`. Rejected: turns an expected outcome into a server error and an alert.
2. **Retry at the transaction boundary** (chosen) — bounded, jittered, outermost-only.
3. **Drop to `READ COMMITTED`** — reduces conflicts but does not eliminate deadlocks, and silently weakens the read-modify-write flows in the application services. Record as a live follow-up question, explicitly not decided here.
4. **Surface it to the client** as `409`/`503` with `Retry-After` — pushes the retry to every caller for something the server can handle itself in tens of milliseconds; still the right escalation if retries are ever observed to exhaust regularly.

State the consequences honestly, including the new invariant (decorated methods must be free of non-DB side effects), the duplicated SQLSTATE literals and why, and that read paths still pay for serializable isolation. Cross-reference ADR 002 (this extends the error-handling strategy: a third category — _transient_ — that is neither an expected domain `Err` nor an unexpected failure) and ADR 001.

- [ ] **Step 2: Update `AGENTS.md` § Error handling**

Add to the `@ResultTransactional()` description that it now retries `40001`/`40P01` up to three times with jittered backoff, that it does so only at the outermost boundary (a joined transaction is never retried), and therefore that **a `@ResultTransactional()` method must not perform side effects outside the database, because the whole method body re-runs on a retry**. This is the rule a future contributor most needs to know, and nothing else in the repo states it.

- [ ] **Step 3: Update the README**

Add `- [006 – Transaction Isolation and Retry Policy](docs/006-transaction-isolation-and-retry-policy.md)` to the decision-record list. If [`task-monotonic-concurrency-tokens.md`](task-monotonic-concurrency-tokens.md) has already landed, keep its 005 entry and simply append 006; if it has not, leave the 005 slot alone rather than renumbering.

Also add a sentence to the README's "Error handling" paragraph noting that transient serialization failures are retried automatically, since that paragraph is where a reader learns the two-channel model.

- [ ] **Step 4: Close out the finding**

In `docs/architecture-review.md`, mark critical finding 2 as resolved with a pointer to ADR 006, and note explicitly that the _second half_ of that finding — read paths paying for serializable isolation — is deliberately still open, so it does not get lost when the finding is struck through.

- [ ] **Step 5: Format, verify, commit**

```bash
npm run format:markdown
npm run test
git add docs AGENTS.md README.md
git commit -m "docs: record the transaction retry policy in ADR 006"
```

`npm run format:markdown` is not optional — Prettier formats every `.md` in the repo and `npm run lint:markdown` is part of `npm run lint`.

---

## Definition of done

- [ ] `isRetryableTransactionError` exists, is unit-tested, and matches `40001`/`40P01` only.
- [ ] `ResultTransactional` retries up to 3 attempts with jittered exponential backoff.
- [ ] A joined (nested) transaction is never retried — proven by a test asserting the inner method ran exactly twice under an outer retry.
- [ ] `Err` results and non-retryable errors are not retried — proven by attempt-count assertions.
- [ ] A real two-transaction contention test recovers and leaves the counter at 2.
- [ ] The four pre-existing `ResultTransactional` tests pass unmodified.
- [ ] Retries are logged at `warn` with attempt number and SQLSTATE.
- [ ] ADR 006 written; `AGENTS.md` documents the no-side-effects invariant; README and review updated.
- [ ] `npm run test` passes.

## Out of scope (do not expand into these)

- **Changing the default isolation level**, or adding `READ ONLY` / `DEFERRABLE` for read paths. Recorded as option 3 in ADR 006 and left undecided on purpose — it needs its own analysis of the read-modify-write flows in the application services.
- Making the retry budget configurable via `config/` (module constants are enough until there is evidence they need tuning).
- Statement and idle-transaction timeouts (`statement_timeout`, `idle_in_transaction_session_timeout`) — review finding 15.
- Moving the transaction boundary behind an application-layer port — review finding 3. This plan deliberately deepens `util`'s coupling by one file rather than pre-empting that refactor; the SQLSTATE duplication is the marker to clean up when it happens.
- The concurrency-token work in [`task-monotonic-concurrency-tokens.md`](task-monotonic-concurrency-tokens.md).
