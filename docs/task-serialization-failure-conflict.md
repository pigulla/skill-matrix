# Task: Surface Transient Serialization Failures as `409 Conflict`

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to work through this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also load the project's `writing-tests` and `database-changes` skills before touching tests or persistence code, the `openapi` skill before touching any `@Api*` decorator, and read `AGENTS.md` § Error handling — this plan adds a third error channel alongside the two it documents.

**Goal:** stop turning PostgreSQL's expected "retry this transaction" signals into HTTP `500`s, by translating `40001 serialization_failure` and `40P01 deadlock_detected` into a `409 Conflict` with a helpful message, at the one place that owns the transaction boundary.

**Origin:** critical finding 2 of [`architecture-review.md`](architecture-review.md). The finding's own suggestion was an internal retry; that approach was reconsidered before implementation (see the first row of the decision table below) in favor of surfacing the conflict to the caller instead.

---

## Context: why this is broken today

Two facts combine badly.

**1. Every request runs in a `SERIALIZABLE` transaction.** `src/infrastructure/persistence/default-transaction-options.ts` sets serializable isolation as the default for the `@nestjs-cls/transactional` adapter, and _every_ public method of _every_ application service carries `@ResultTransactional()` (`src/util/result-transactional.decorator.ts`) — reads included, per the uniformity rule in `AGENTS.md`.

**2. Nothing anywhere handles a serialization failure.** `grep -rn "40001\|SERIALIZATION_FAILURE" src/` finds nothing outside the unused constant table in `src/infrastructure/persistence/error/error-codes.ts`. The three error-translation helpers (`isUniqueConstraintViolation`, `isForeignKeyViolation`, `isRestrictViolation`) cover integrity violations only, so a `40001` falls into every repository's catch-all:

<!-- prettier-ignore -->
```ts
throw new UnexpectedPersistenceError(error as Error)
```

…which `DomainErrorsExceptionFilter` does not recognise, so it surfaces as `500 Internal Server Error`.

Under serializable isolation a `40001` is **not** a bug and **not** an infrastructure failure. It is the documented, expected way PostgreSQL says "your transaction would have violated serializability; run it again". The current design converts a normal, expected outcome into a server error — one that also gets logged as an unexpected failure, so it will read as an incident rather than as contention.

Concretely: two clients updating two _different_ skills can conflict through predicate locks on a shared index range, and one of them gets a `500` for doing nothing wrong. There is no test covering this path, because there is no code covering it.

**A `40001`/`40P01` can surface two different ways**, and both matter for where the fix lives:

- **Mid-transaction**, while a repository method's own statement is running. The repository's own error mapper catches it, doesn't recognize it as a unique/FK/restrict violation, and wraps it: `throw new UnexpectedPersistenceError(error)` — where `error` becomes `UnexpectedPersistenceError`'s `.cause`.
- **At `COMMIT`**, after every statement in the transaction has already succeeded. PostgreSQL's SSI implementation sometimes only detects the conflict when validating the whole transaction's read/write set at commit time. Nothing in a repository ever sees this — it comes directly out of `@nestjs-cls/transactional`'s own commit call, raw and unwrapped.

No single repository call site sees both shapes. `ResultTransactional` — the thing that wraps `txHost.withTransaction(...)` — is the only place both a wrapped, mid-transaction failure and a raw, commit-time failure are guaranteed to pass through on their way out.

**Secondary cost, recorded but out of scope:** every read path (`getAll`, `get`) pays a `BEGIN`/`COMMIT` round trip plus SIREAD predicate-lock bookkeeping for what is a single `SELECT`. See "Out of scope" below.

---

## Decisions already made — do not re-litigate

| Decision | Rationale |
| --- | --- |
| Surface the conflict as `409 Conflict`, do not retry internally. | An internal retry re-executes the whole decorated method body, which forces a permanent, codebase-wide invariant — no `@ResultTransactional()` method may ever perform a side effect outside the database — for a benefit (avoiding one client-visible round trip) that a clear `409` gets for free. `409` is already used in this codebase for other conflicts a caller can resolve and resubmit (`DuplicateEntityError`, `EntityInUseError`); a transient serialization conflict is resolved by resubmitting the _unchanged_ request instead of changing input, but nothing in the HTTP spec ties `409` to one or the other — the response body's message is what tells the caller which kind of conflict it got. |
| Detect and translate the error inside `ResultTransactional`, not in any repository. | It is the only place a mid-transaction failure (already wrapped as `UnexpectedPersistenceError` by whichever repository's error mapper first saw it) and a commit-time failure (raw, never touched by any repository) both pass through on the way out — see "Context" above. Doing this per-repository would need the same check duplicated across every repository file and would still miss the commit-time case entirely, since no repository code runs during `COMMIT`. |
| The new error is **thrown**, not returned as an `Err`. | A commit-time failure happens _after_ the decorated method's own body has already resolved `Ok` — there is no `Result` left to turn into an `Err` at that point. This is the same reasoning that already puts `UnexpectedPersistenceError` on the thrown side of ADR 002's channel split. Cross-reference ADR 002 in the new ADR: this is a third category, neither an expected domain `Err` nor a bug, but it still has to leave through the thrown channel because of _when_ it can occur. |
| The predicate (`isTransientTransactionError`) checks the error itself, then exactly one level of `Error.cause`. | Covers both shapes from "Context" without needing to know about `UnexpectedPersistenceError` by name (which would itself be a layer violation): a raw commit-time `DatabaseError` matches on the first check; a mid-transaction failure wrapped once in `UnexpectedPersistenceError` matches on `error.cause`. One level, not a walked chain — that's the one wrapping depth that exists today, and there is no evidence a deeper one will appear. |
| The predicate lives in `src/infrastructure/persistence/error/`, alongside `isUniqueConstraintViolation`/`isForeignKeyViolation`/`isRestrictViolation`, not in `src/util/`. | It inspects a `DatabaseError`'s SQLSTATE exactly like its three siblings, and belongs with them rather than being the one predicate of the four exiled to `util` for a dependency-direction technicality. It can now import `ERROR_CODES` directly instead of duplicating two string literals. This needs a narrow `lint:architecture` exception — see the last row — because `ResultTransactional`, the caller, lives in `src/util/`. |
| The new error class (`TransactionConflictError`) lives in `src/application/error/`, alongside `UnexpectedPersistenceError`, not `src/util/` or `src/domain/error/`. | It's a cross-cutting, non-entity-specific error that's thrown directly rather than returned as an `Err` — exactly what already puts `UnexpectedPersistenceError` in `src/application/error/` instead of `src/domain/error/`. Every class actually under `src/domain/error/` (`DuplicateEntityError`, `EntityInUseError`, `EntityNotFoundError`, ...) is entity-scoped and, per `AGENTS.md`, is _never_ thrown directly except by `@UnwrapResult()` unwrapping an `Err` — `TransactionConflictError` breaks that convention by design (a commit-time failure has no `Result` left to turn into an `Err`, so it must leave through the thrown channel), so filing it next to classes that don't break it would misrepresent it. `ResultTransactional` constructs and throws it from `src/util/`, needing the same kind of narrow `lint:architecture` exception as the predicate above — see the last row. `src/presentation/http/domain-errors-exception-filter.ts` importing it back out needs no new exception: `presentation-must-not-import-application-implementation` already exempts `*.error.ts` files. |
| The `util-must-not-import-*` dependency-cruiser rule gets two narrow carve-outs: `src/util/` may import `src/infrastructure/persistence/error/` and `src/application/error/`, nothing else outside `src/util/`. | Two files need to cross the boundary the other way: the predicate needs to live next to `ERROR_CODES` (two rows up), and `TransactionConflictError` needs to live next to `UnexpectedPersistenceError` (previous row) — in both cases `ResultTransactional`, the caller, is what's stuck in `src/util/`. Both target directories are small and pure — SQLSTATE predicates and constants in one, thrown-not-`Err` error classes in the other, no DI, no framework types, no side effects in either — so this is a much smaller, more honest hole than the general "`util` secretly depends on persistence machinery" problem review finding 3 describes: that finding is about a _hidden_ dependency reached through a global service locator (`TransactionHost.getInstance()`) and an unpinned external package, not about importing a constant or a thrown error type. Scope the exception to exactly these two paths (`pathNot`), not to `src/infrastructure/`/`src/application/` as a whole, so a future contributor adding, say, a repository import or a service call to some other `util` file is still caught. |
| Keep `SERIALIZABLE` as the default isolation level in this change. | Dropping to `READ COMMITTED` is a defensible but _separate_ decision with its own analysis (the write paths are already guarded by the optimistic-concurrency predicate, but the read-modify-write flows in the services are not). Record the reasoning in the new ADR; change nothing. |
| Document `409 Conflict` on every controller endpoint that can raise it — in practice, every endpoint, since every service method carries `@ResultTransactional()` under `SERIALIZABLE` (reads included). | Limiting the OpenAPI docs to mutating endpoints would be quietly wrong: a read-only `SERIALIZABLE` transaction can still be the one PostgreSQL picks to abort. Where a method already documents its own `409` (a duplicate-name or in-use conflict), extend that same `@ApiResponse` in place — adding a second stacked `@ApiResponse({status: 409, ...})` merges via `@nestjs/swagger`'s own `mergeResponseEntry`, concatenating `description` and merging `examples`, but silently drops whichever decorator's `schema`/`type` applied first, and the concatenation order depends on decorator stacking order rather than reading order. Editing the one existing call explicitly avoids relying on that. |
| Reserve ADR number **005**. | `004` is taken by [ADR 004 – DTO Construction](004-dto-construction.md). The original version of this plan believed `005` was reserved by [`task-monotonic-concurrency-tokens.md`](task-monotonic-concurrency-tokens.md) — that plan in fact revises ADR 003 in place and explicitly leaves `005` free, so `005` is the correct number here, not `006`. |

---

## Global constraints

- No new npm dependency. `pg-protocol` (which exports `DatabaseError`) is already a direct dependency and is already used by the three `is*Violation` helpers.
- `npm run lint:architecture` must stay green. `src/util` may import external packages, plus — after Tasks 1 and 2's narrow additions — `src/infrastructure/persistence/error/` and `src/application/error/`; no other layer.
- `npm run lint:tsc` must pass after every TypeScript edit.
- Every existing test must keep passing unchanged. This change adds behaviour on a path that currently has no coverage; it must not alter commit/rollback semantics for success, `Err`, or unrelated thrown errors.
- `npm run openapi` must exit cleanly (build + Redocly lint) after Task 4.
- Conventional Commits; commit at the end of each task.
- Integration tests need Docker running (Testcontainers).
- `npm run test` must pass before the final commit.

---

### Task 1: The transient-transaction-error predicate

**Files:**

- Create: `src/infrastructure/persistence/error/is-transient-transaction-error.ts`
- Modify: `.dependency-cruiser.cjs`

**Interfaces produced:** `isTransientTransactionError(error: unknown): error is Error`. Task 2 depends on it.

No dedicated unit test for this file. `src/infrastructure/**` carries no branch-coverage threshold in `vitest.config.ts` (unlike `src/application/**`/`src/presentation/**`, which require 100%) — same as its three siblings in this directory, none of which have a unit test either — and every branch of the predicate — raw match, wrapped-in-`.cause` match, and the non-transient false case — is already exercised by Task 2's integration tests, which is the only place this function is ever called from.

- [ ] **Step 1: Loosen the dependency-cruiser rule**

Modify `.dependency-cruiser.cjs`. `ResultTransactional` (`src/util/result-transactional.decorator.ts`) needs to call this predicate, so `src/util/` needs a narrow, explicit way to reach it — scoped to this one directory, not to `src/infrastructure/` as a whole:

<!-- prettier-ignore -->
```js
{
  name: 'util-must-not-import-application-domain-presentation-infrastructure-or-module',
  comment:
    'Exception: src/infrastructure/persistence/error/ is a constant table plus pure DatabaseError predicates — no DI, no framework types, no side effects — so util may reach in there directly rather than duplicating its contents.',
  severity: 'error',
  from: { path: '^src/util/' },
  to: {
    path: [
      '^src/application/',
      '^src/domain/',
      '^src/presentation/',
      '^src/infrastructure/',
      '^src/module/',
    ],
    pathNot: '^src/infrastructure/persistence/error/',
  },
},
```

- [ ] **Step 2: Implement the predicate**

Create `src/infrastructure/persistence/error/is-transient-transaction-error.ts`, following the same shape as its siblings (`is-unique-constraint-violation.ts` etc.) in this directory:

<!-- prettier-ignore -->
```ts
import { DatabaseError } from 'pg-protocol'

import { ERROR_CODES } from './error-codes.js'

function isTransientDatabaseError(error: unknown): error is Error {
  return (
    error instanceof DatabaseError &&
    (error.code === ERROR_CODES.TRANSACTION_ROLLBACK.SERIALIZATION_FAILURE ||
      error.code === ERROR_CODES.TRANSACTION_ROLLBACK.DEADLOCK_DETECTED)
  )
}

/**
 * True for the two PostgreSQL errors that mean "this transaction did not commit because it conflicted with
 * another one, not because anything was wrong with it". Checks the error itself and, if that doesn't match,
 * exactly one level of `.cause`: a repository's own error mapper already wraps an unrecognized pg error in
 * `UnexpectedPersistenceError(cause)` before it reaches `ResultTransactional`, while a failure raised by
 * COMMIT itself never passes through a repository and arrives unwrapped. One level covers both; there is no
 * deeper wrapping to unwrap today.
 */
export function isTransientTransactionError(error: unknown): error is Error {
  return (
    isTransientDatabaseError(error) ||
    (error instanceof Error && isTransientDatabaseError(error.cause))
  )
}
```

Both functions return a type predicate, not `boolean`. Once the internal `isTransientDatabaseError` itself asserts `error is Error`, `isTransientTransactionError`'s own predicate follows immediately by composition — either branch only returns `true` via a check that already guarantees `Error` — with no need to reason separately about `DatabaseError` being an `Error` subtype. Callers get `error` narrowed to `Error` for free instead of needing an `as Error` cast.

- [ ] **Step 3: Verify and commit**

```bash
npm run lint:tsc && npm run lint:architecture && npm run lint:biome
git add .dependency-cruiser.cjs src/infrastructure/persistence/error/is-transient-transaction-error.ts
git commit -m "feat: add a predicate for transient PostgreSQL transaction errors"
```

`lint:architecture` passing here is the check that matters — it confirms the new exception is scoped to exactly `src/infrastructure/persistence/error/` and nothing broader in `src/infrastructure/` became reachable from `util` by accident.

---

### Task 2: `TransactionConflictError` and wiring it into `ResultTransactional`

**Files:**

- Modify: `.dependency-cruiser.cjs`
- Create: `src/application/error/transaction-conflict.error.ts`
- Modify: `src/util/result-transactional.decorator.ts`
- Modify: `test/integration/util/result-transactional.decorator.test.ts`

**Interfaces consumed:** `isTransientTransactionError` from Task 1. **Interfaces produced:** `TransactionConflictError`. Task 3 depends on it.

The current implementation wraps a single `txHost.withTransaction(...)` call in `ResultAsync.fromPromise`, using an internal `RollbackSignal` to force a rollback on `Err`. Keep that mechanism exactly as it is; the change is one extra branch in the existing error-mapping callback.

`isTransientTransactionError` lives in `src/infrastructure/persistence/error/` (Task 1) and `TransactionConflictError` lives in `src/application/error/` (this task), so both imports into `src/util/result-transactional.decorator.ts` are cross-layer — use the absolute `#/infrastructure/persistence/error/is-transient-transaction-error.js` and `#/application/error/transaction-conflict.error.js` paths, per `AGENTS.md`'s import convention, not relative ones.

- [ ] **Step 1: Extend the dependency-cruiser exception**

Modify `.dependency-cruiser.cjs`. Task 1 added a `pathNot` exception for `src/infrastructure/persistence/error/`; widen it into an array covering `src/application/error/` too, since `TransactionConflictError` needs the same one-directional hole for the same reason:

<!-- prettier-ignore -->
```js
{
  name: 'util-must-not-import-application-domain-presentation-infrastructure-or-module',
  comment:
    'Exceptions: src/infrastructure/persistence/error/ (a constant table plus pure DatabaseError predicates) and ' +
    'src/application/error/ (thrown-not-Err error classes) are both small, pure — no DI, no framework types, no ' +
    'side effects — so util may reach into either directly rather than duplicating their contents.',
  severity: 'error',
  from: { path: '^src/util/' },
  to: {
    path: [
      '^src/application/',
      '^src/domain/',
      '^src/presentation/',
      '^src/infrastructure/',
      '^src/module/',
    ],
    pathNot: ['^src/infrastructure/persistence/error/', '^src/application/error/'],
  },
},
```

- [ ] **Step 2: Write the failing tests first**

Create `src/application/error/transaction-conflict.error.ts`, alongside `unexpected-persistence.error.ts`:

<!-- prettier-ignore -->
```ts
export class TransactionConflictError extends Error {
  public constructor(cause: Error) {
    super(
      'The transaction was rolled back because it conflicted with another one running at the same time. Retrying the request may succeed.',
      { cause },
    )
  }
}
```

In `test/integration/util/result-transactional.decorator.test.ts`, extend the existing `ResultTransactionalTestService` with these methods (keep the four existing test cases untouched — they are the regression guard that commit/rollback semantics did not change):

- `failsWithRawTransientError()`: `async`, throws a synthetic raw `DatabaseError` with `code = '40001'` — simulates a commit-time failure, which never passes through a repository's error mapper.
- `failsWithWrappedTransientError()`: `async`, throws `new UnexpectedPersistenceError(...)` whose `cause` is a synthetic `DatabaseError` with `code = '40P01'` — simulates a mid-transaction failure a repository has already wrapped.
- `failsWithNonTransientError()`: `async`, throws `new UnexpectedPersistenceError(...)` whose `cause` is a synthetic `DatabaseError` with `code = '23505'` — proves an unrelated persistence error is not reinterpreted.
- `incrementViaReadThenWrite(hook: () => Promise<void>)`: `SELECT value FROM test_counters WHERE id = 1`, then `await hook()`, then `UPDATE test_counters SET value = $(value) WHERE id = 1` with `value + 1`. The injected hook is what lets a test control the interleaving.

This needs three new imports at the top of the file: `DatabaseError` from `'pg-protocol'`, `UnexpectedPersistenceError` from `'#/application/error/unexpected-persistence.error.js'`, and `TransactionConflictError` from `'#/application/error/transaction-conflict.error.js'` (used in the `.rejects.toThrow(TransactionConflictError)` assertions below).

Add a shared helper near the top of the file, alongside `TestError`:

<!-- prettier-ignore -->
```ts
function syntheticDatabaseError(code: string): DatabaseError {
  const error = new DatabaseError('simulated', 0, 'error')
  error.code = code
  return error
}
```

Add `test_counters` alongside the existing `test_rows` in `beforeEach`:

<!-- prettier-ignore -->
```ts
await db.none('CREATE TABLE test_counters (id INT PRIMARY KEY, value INT NOT NULL)')
await db.none('INSERT INTO test_counters (id, value) VALUES (1, 0)')
```

Then the cases:

| Test | Assertion |
| --- | --- |
| translates a raw commit-time-shaped failure | `failsWithRawTransientError()` rejects with `TransactionConflictError` (`.rejects.toThrow(TransactionConflictError)`). |
| translates a wrapped mid-transaction-shaped failure | `failsWithWrappedTransientError()` rejects with `TransactionConflictError`. |
| leaves an unrelated persistence error alone | `failsWithNonTransientError()` rejects with `UnexpectedPersistenceError`, not `TransactionConflictError`. |
| recovers from real contention without retrying | See Step 2. |

These tests assert on a rejected promise (`.rejects.toThrow(...)`), which is correct here: a genuinely thrown, non-`Result` failure is exactly the case `writing-tests` reserves `.rejects` for.

- [ ] **Step 3: Write the real-contention test**

This is the end-to-end proof the synthetic tests above cannot give you — that a genuine two-transaction conflict is translated, not silently retried into success. Deterministic sequence:

1. Start call **A** to `incrementViaReadThenWrite` with a hook that resolves an `aHasRead` promise and then awaits a `releaseA` promise. Do not await A yet.
2. `await aHasRead` — A has now taken its serializable snapshot (`value = 0`).
3. Run call **B** to `incrementViaReadThenWrite` with a no-op hook, to completion. B reads `0`, writes `1`, commits.
4. Resolve `releaseA`, then await A. A's `UPDATE` now targets a row a concurrent transaction has committed over, so PostgreSQL raises `40001` — either at the `UPDATE` or at `COMMIT`.
5. Assert A **rejects** with `TransactionConflictError`, and that `SELECT value FROM test_counters WHERE id = 1` is still **1** — A's write never took effect, only B's did.

```bash
npx vitest run test/integration/util/result-transactional.decorator.test.ts
```

Expected: the four pre-existing cases PASS; every new case FAILS.

- [ ] **Step 4: Implement the translation**

Modify `src/util/result-transactional.decorator.ts`, adding one branch to the existing error-mapping callback:

<!-- prettier-ignore -->
```ts
import { Logger } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import type { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { copyMethodMetadata } from 'nestjs-cls'
import { Result, ResultAsync } from 'neverthrow'

import { TransactionConflictError } from '#/application/error/transaction-conflict.error.js'
import { isTransientTransactionError } from '#/infrastructure/persistence/error/is-transient-transaction-error.js'

const logger = new Logger('ResultTransactional')

class RollbackSignal extends Error {
  public constructor(cause: Error) {
    super(RollbackSignal.name, { cause })
  }
}

export function ResultTransactional(connectionName?: string): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    const original = descriptor.value as (...args: unknown[]) => ResultAsync<unknown, unknown>

    function wrapped(this: unknown, ...args: unknown[]): ResultAsync<unknown, unknown> {
      const txHost = TransactionHost.getInstance<TransactionalAdapterPgPromise>(connectionName)

      return ResultAsync.fromPromise(
        txHost.withTransaction(async () => {
          const result = (await original.apply(this, args)) as Result<unknown, Error>

          if (result.isErr()) {
            throw new RollbackSignal(result.error)
          }

          return result.value
        }),
        error => {
          if (error instanceof RollbackSignal) {
            return error.cause
          }

          if (isTransientTransactionError(error)) {
            logger.warn(
              { error },
              'Rolling back after a transient transaction conflict; throwing TransactionConflictError',
            )

            throw new TransactionConflictError(error)
          }

          throw error
        },
      )
    }

    descriptor.value = wrapped as typeof descriptor.value

    copyMethodMetadata(original, descriptor.value)
  }
}
```

Points to get right:

- `RollbackSignal` is checked **before** the transient-error predicate. An `Err` must never be reinterpreted as a transient conflict, and `RollbackSignal` is not a `DatabaseError` anyway — the explicit check documents the intent.
- No loop, no `isTransactionActive()` guard, no backoff. Unlike a retry, translating the error is safe to do at every nesting level: if an inner, joined `@ResultTransactional()` call translates the error first, the outer call's own `ResultAsync.fromPromise` receives a `TransactionConflictError`, which is not a `DatabaseError` and does not match the predicate — it just rethrows unchanged. There is nothing to coordinate between nesting levels.
- `logger.warn` uses the `(object, message)` overload, matching `ConnectionProvider`'s existing style. A module-level `Logger` is used because the decorator is a free function, not an injectable.

- [ ] **Step 5: Verify**

```bash
npx vitest run test/integration/util/result-transactional.decorator.test.ts
npm run lint:tsc && npm run lint:architecture && npm run lint:biome
npm run vitest
```

Expected: all new and pre-existing cases PASS, the whole suite PASS, lint clean.

- [ ] **Step 6: Commit**

```bash
git add .dependency-cruiser.cjs src/application/error/transaction-conflict.error.ts src/util/result-transactional.decorator.ts test/integration/util/result-transactional.decorator.test.ts
git commit -m "fix: surface transient serialization failures as TransactionConflictError instead of a 500"
```

---

### Task 3: Map `TransactionConflictError` to `409 Conflict`

**Files:**

- Modify: `src/presentation/http/domain-errors-exception-filter.ts`

**Interfaces consumed:** `TransactionConflictError` from Task 2.

No dedicated test for this change. None of the filter's existing five branches have one either — every existing mapping (`EntityNotFoundError` → 404, `EntityInUseError`/`DuplicateEntityError` → 409, ...) is proven only implicitly, through controller integration tests that trigger the real business scenario and assert the resulting HTTP status. This is one more `else if` of the same shape as the five already there, so it's covered by that same implicit net rather than a test of its own.

One honest gap this leaves: unlike the other five, nothing in this plan drives an actual `40001`/`40P01` through a real HTTP request end-to-end — Task 2's real-contention test deliberately calls `ResultTransactional` directly rather than through a controller, because orchestrating a genuine two-transaction race deterministically through two concurrent HTTP requests is significantly harder than through the test service. So this task's confidence rests on Task 2 having already proven `TransactionConflictError` is thrown correctly, plus this mapping being a one-line, visually-verifiable match against five already-correct examples — not on an automated proof of the full path.

- [ ] **Step 1: Wire the filter**

Modify `src/presentation/http/domain-errors-exception-filter.ts`:

<!-- prettier-ignore -->
```ts
import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { serializeError } from 'serialize-error'

import { TransactionConflictError } from '#/application/error/transaction-conflict.error.js'
import { DuplicateEntityError } from '#/domain/error/duplicate-entity.error.js'
import { EntityConcurrencyError } from '#/domain/error/entity-concurrency.error.js'
import { EntityInUseError } from '#/domain/error/entity-in-use.error.js'
import { EntityNotFoundError } from '#/domain/error/entity-not-found.error.js'
import { EntityReferenceNotFoundError } from '#/domain/error/entity-reference-not-found.error.js'

@Catch()
export class DomainErrorsExceptionFilter extends BaseExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const cause = serializeError(exception)

    if (exception instanceof EntityNotFoundError) {
      super.catch(new NotFoundException(exception.message, { cause }), host)
    } else if (exception instanceof EntityInUseError) {
      super.catch(new ConflictException(exception.message, { cause }), host)
    } else if (exception instanceof DuplicateEntityError) {
      super.catch(new ConflictException(exception.message, { cause }), host)
    } else if (exception instanceof TransactionConflictError) {
      super.catch(new ConflictException(exception.message, { cause }), host)
    } else if (exception instanceof EntityReferenceNotFoundError) {
      super.catch(new UnprocessableEntityException(exception.message, { cause }), host)
    } else if (exception instanceof EntityConcurrencyError) {
      super.catch(new PreconditionFailedException(exception.message, { cause }), host)
    } else {
      super.catch(exception, host)
    }
  }
}
```

- [ ] **Step 2: Verify and commit**

```bash
npm run lint:tsc && npm run lint:architecture && npm run lint:biome
npm run vitest
git add src/presentation/http/domain-errors-exception-filter.ts
git commit -m "feat: map TransactionConflictError to 409 Conflict"
```

`npm run vitest` here is the check that matters — it confirms this new branch didn't disturb any of the five existing controller-level `409`/`404`/`412`/`422` assertions that exercise the rest of this filter.

---

### Task 4: Document `409 Conflict` on every controller endpoint

**Files:**

- Modify: `src/presentation/http/example/examples.controller.ts`
- Modify: `src/presentation/http/example/kind/example-kinds.controller.ts`
- Modify: `src/presentation/http/skill/skills.controller.ts`
- Modify: `src/presentation/http/team/skill-proficiencies/team-skill-proficiencies.controller.ts`
- Modify: `src/presentation/http/team/teams.controller.ts`
- Modify: `src/presentation/http/user/users.controller.ts`

`health.controller.ts` is excluded — it does no persistence and carries no `@ResultTransactional()` call.

Every method below sits behind a `@ResultTransactional()`-decorated service call under `SERIALIZABLE` isolation, so every one of them — reads included — can now respond `409`. Apply this rule per method, mechanically:

- **If the method already has `@ApiResponse({ status: HttpStatus.CONFLICT, ... })`**, edit that one call in place: broaden its `description` to also cover the transient case, and add a `transactionConflict` entry to an `examples` map (introducing one if the call doesn't have one yet). Do **not** add a second, stacked `@ApiResponse({status: HttpStatus.CONFLICT, ...})` — `@nestjs/swagger` merges same-status decorators by concatenating `description` and merging `examples`, but a `schema`/`type` set on either one silently overwrites the other, and the concatenation order follows decorator-stacking order (bottom-most applies first), not source order. Editing the one call keeps the result exactly what's written, not an artifact of merge order.
- **If the method has no `409` yet**, add one with just the transient-conflict example.

Worked example, method **with** an existing `409` — `skill.create` in `src/presentation/http/skill/skills.controller.ts`:

<!-- prettier-ignore -->
```ts
@ApiResponse({
  status: HttpStatus.CONFLICT,
  description: `A uniqueness constraint on one of the skill's properties is being violated, or the write conflicted with another one running at the same time.`,
  examples: {
    duplicateName: {
      summary: 'A skill with this name already exists',
      value: { statusCode: HttpStatus.CONFLICT, message: `A skill with this name already exists.` },
    },
    transactionConflict: {
      summary: 'The write conflicted with a concurrent transaction',
      value: {
        statusCode: HttpStatus.CONFLICT,
        message:
          'The transaction was rolled back because it conflicted with another one running at the same time. Retrying the request may succeed.',
      },
    },
  },
})
```

Worked example, method **without** an existing `409` — `skill.getAll` in the same file:

<!-- prettier-ignore -->
```ts
@ApiResponse({
  status: HttpStatus.CONFLICT,
  description: 'The read conflicted with another transaction running at the same time.',
  examples: {
    transactionConflict: {
      summary: 'The read conflicted with a concurrent transaction',
      value: {
        statusCode: HttpStatus.CONFLICT,
        message:
          'The transaction was rolled back because it conflicted with another one running at the same time. Retrying the request may succeed.',
      },
    },
  },
})
```

Apply the same rule to every operation below (grep each file for `operationId:` to find it):

| Controller                               | `operationId`                     | Existing `409`? |
| ---------------------------------------- | --------------------------------- | --------------- |
| `examples.controller.ts`                 | `example.getAll`                  | No              |
| `examples.controller.ts`                 | `example.getOne`                  | No              |
| `examples.controller.ts`                 | `example.delete`                  | Yes             |
| `examples.controller.ts`                 | `example.create`                  | Yes             |
| `examples.controller.ts`                 | `example.update`                  | Yes             |
| `example-kinds.controller.ts`            | `example.kind.getAll`             | No              |
| `example-kinds.controller.ts`            | `example.kind.getOne`             | No              |
| `example-kinds.controller.ts`            | `example.kind.delete`             | Yes             |
| `example-kinds.controller.ts`            | `example.kind.create`             | Yes             |
| `example-kinds.controller.ts`            | `example.kind.update`             | Yes             |
| `skills.controller.ts`                   | `skill.getAll`                    | No              |
| `skills.controller.ts`                   | `skill.getOne`                    | No              |
| `skills.controller.ts`                   | `skill.delete`                    | Yes             |
| `skills.controller.ts`                   | `skill.create`                    | Yes             |
| `skills.controller.ts`                   | `skill.update`                    | Yes             |
| `team-skill-proficiencies.controller.ts` | `team.skill-proficiencies.get`    | No              |
| `team-skill-proficiencies.controller.ts` | `team.skill-proficiencies.add`    | Yes             |
| `team-skill-proficiencies.controller.ts` | `team.skill-proficiencies.update` | No              |
| `team-skill-proficiencies.controller.ts` | `team.skill-proficiencies.remove` | No              |
| `teams.controller.ts`                    | `team.getAll`                     | No              |
| `teams.controller.ts`                    | `team.getOne`                     | No              |
| `teams.controller.ts`                    | `team.delete`                     | Yes             |
| `teams.controller.ts`                    | `team.create`                     | Yes             |
| `teams.controller.ts`                    | `team.update`                     | Yes             |
| `users.controller.ts`                    | `user.getAll`                     | No              |
| `users.controller.ts`                    | `user.getOne`                     | No              |
| `users.controller.ts`                    | `user.delete`                     | No              |
| `users.controller.ts`                    | `user.create`                     | Yes             |
| `users.controller.ts`                    | `user.update`                     | Yes             |

- [ ] **Step 1: Apply the rule to every row in the table above**, using the two worked examples as the exact shape for each case.

- [ ] **Step 2: Verify and commit**

```bash
npm run openapi
npm run lint:tsc && npm run lint:architecture && npm run lint:biome
npm run vitest:integration
git add src/presentation/http
git commit -m "docs: document 409 Conflict on every endpoint that can now return it"
```

`npm run vitest:integration` must still pass unmodified — this task only adds documentation, so no controller's actual response behavior changes.

---

### Task 5: Documentation

**Files:**

- Create: `docs/005-transaction-conflict-response.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/architecture-review.md`

This plan's own file was renamed from `task-serialization-failure-retries.md` to `task-serialization-failure-conflict.md`, and the three other docs that linked to the old name (`docs/architecture-review.md`, `docs/task-foreign-key-indexes.md`, `docs/task-monotonic-concurrency-tokens.md`) already point at the new one — that cleanup happened when this plan was rewritten, not as a task here.

- [ ] **Step 1: Write ADR 005**

Follow the structure of the existing ADRs (front-matter with `status` and `date`, Context and Problem Statement, Decision Drivers, Considered Options, Decision Outcome, Consequences, Pros and Cons of the Options, More Information). Options to record:

1. **Status quo** — a `40001`/`40P01` becomes `UnexpectedPersistenceError` → `500`. Rejected: turns an expected outcome into a server error and an alert.
2. **Retry at the transaction boundary** — bounded, jittered, outermost-only. Considered and rejected: it forces a permanent invariant (no `@ResultTransactional()` method may have a side effect outside the database) onto the whole codebase, for a benefit an honest `409` gets without it.
3. **Surface it to the client as `409 Conflict`** (chosen) — translated once, at the transaction boundary, into a thrown `TransactionConflictError` that the existing `DomainErrorsExceptionFilter` maps to `409`, same as the two other conflict types this API already returns `409` for.
4. **Drop to `READ COMMITTED`** — reduces conflicts but does not eliminate deadlocks, and silently weakens the read-modify-write flows in the application services. Record as a live follow-up question, explicitly not decided here.

State the consequences honestly, including: the narrow `lint:architecture` exceptions letting `src/util/` reach into `src/infrastructure/persistence/error/` and `src/application/error/` and why they're scoped that tightly; that read paths still pay for serializable isolation; and that `409` is now used in this codebase for two conceptually different situations (a deterministic conflict that requires changing the request, and a transient one that doesn't) distinguished only by the response body's message, not the status code — this is consistent with the HTTP spec (`409` means "conflict with current state, resolve and resubmit," not "permanent" or "transient" specifically) but is a real thing a caller must read the message to act on correctly. Cross-reference ADR 002 (this is a third error category — _transient_ — that is neither an expected domain `Err` nor an unexpected failure, but leaves through the thrown channel because it can occur after the method body has already resolved) and ADR 001.

- [ ] **Step 2: Update `AGENTS.md` § Error handling**

Add a short paragraph after the existing error-handling description: `@ResultTransactional()` also translates `40001`/`40P01` (serialization failure, deadlock) into a thrown `TransactionConflictError`, which `DomainErrorsExceptionFilter` maps to `409 Conflict` — a third category, alongside the two-channel model above, for failures that are neither an expected domain `Err` nor a bug. No new invariant is introduced: the decorated method body is never re-executed.

- [ ] **Step 3: Update the README**

Add `- [005 – Transaction Conflict Response](docs/005-transaction-conflict-response.md)` to the decision-record list, after entry 004.

Also add a sentence to the README's "Error handling" paragraph noting that a transient write conflict is surfaced as `409 Conflict`, since that paragraph is where a reader learns the two-channel model and this is a third.

- [ ] **Step 4: Close out the finding**

In `docs/architecture-review.md`, mark critical finding 2 as resolved with a pointer to ADR 005, and note explicitly that the _second half_ of that finding — read paths paying for serializable isolation — is deliberately still open, so it does not get lost when the finding is struck through.

- [ ] **Step 5: Format, verify, commit**

```bash
npm run format:markdown
npm run test
git add docs AGENTS.md README.md
git commit -m "docs: record the transaction conflict response policy in ADR 005"
```

`npm run format:markdown` is not optional — Prettier formats every `.md` in the repo and `npm run lint:markdown` is part of `npm run lint`.

---

## Definition of done

- [ ] `isTransientTransactionError` exists in `src/infrastructure/persistence/error/` and matches `40001`/`40P01` (raw or wrapped one level in `.cause`) only, exercised via Task 2's integration tests.
- [ ] The `lint:architecture` exceptions letting `src/util/` import `src/infrastructure/persistence/error/` and `src/application/error/` are scoped to exactly those two paths — importing anything else under `src/infrastructure/` or `src/application/` from `src/util/` still fails `npm run lint:architecture`.
- [ ] `TransactionConflictError` exists in `src/application/error/` and is thrown by `ResultTransactional` for both the raw (commit-time) and wrapped (mid-transaction) shapes, proven by tests for each.
- [ ] An unrelated persistence error (e.g. a unique violation) is never reinterpreted as a transaction conflict.
- [ ] A real two-transaction contention test proves the losing transaction rejects with `TransactionConflictError` and its write never lands.
- [ ] The four pre-existing `ResultTransactional` tests pass unmodified.
- [ ] `DomainErrorsExceptionFilter` maps `TransactionConflictError` to `409 Conflict` — a new branch matching the shape of the five that already exist, with no dedicated test, consistent with how those five are (not) tested.
- [ ] A transient transaction conflict is logged at `warn`.
- [ ] Every controller endpoint documents `409 Conflict`, either by extending an existing one or adding a new one; `npm run openapi` passes.
- [ ] ADR 005 written; `AGENTS.md` documents the third error category; README and `architecture-review.md` updated.
- [ ] `npm run test` passes.

## Out of scope (do not expand into these)

- **Changing the default isolation level**, or adding `READ ONLY` / `DEFERRABLE` for read paths. Recorded as option 4 in ADR 005 and left undecided on purpose — it needs its own analysis of the read-modify-write flows in the application services.
- Statement and idle-transaction timeouts (`statement_timeout`, `idle_in_transaction_session_timeout`) — review finding 15.
- Moving the transaction boundary behind an application-layer port — review finding 3. This plan does not deepen `util`'s hidden coupling to persistence machinery that finding 3 describes: the two files that genuinely needed to live elsewhere (the predicate in `src/infrastructure/persistence/error/`, `TransactionConflictError` in `src/application/error/`) now live there honestly, each reached from `util` through a narrow, explicit dependency-cruiser exception rather than a duplicated constant or a misplaced class. `ResultTransactional` itself is still the one file in `util` doing the reaching. When finding 3's `ITransactionRunner` port lands, the two exceptions in `.dependency-cruiser.cjs` are the marker to reconsider — `ResultTransactional` moving out of `util` entirely may make both unnecessary.
- The concurrency-token work in [`task-monotonic-concurrency-tokens.md`](task-monotonic-concurrency-tokens.md).
- Any client-side (frontend) handling of the new `409` — out of scope for this backend-only plan.
