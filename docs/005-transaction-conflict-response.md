---
status: "accepted"
date: 2026-08-21
---

# Transaction Conflict Response

## Context and Problem Statement

Every application service method runs inside a `SERIALIZABLE` transaction (`DEFAULT_TX_OPTIONS`, `src/infrastructure/persistence/default-transaction-options.ts`), opened by [`@ResultTransactional()`](../src/util/result-transactional.decorator.ts). Under serializable isolation, PostgreSQL sometimes aborts a transaction at `COMMIT` — or mid-transaction, ahead of it — purely because it detected a conflict with another transaction that ran concurrently, reported as `40001 serialization_failure`; `40P01 deadlock_detected` is the same kind of event under any isolation level, raised when two transactions' lock orders form a cycle. Both are, by design, the database telling the client "retry this later, it will probably succeed" rather than reporting anything wrong with the statement, the data, or the caller's request. Before this decision, neither code was recognized anywhere in the codebase — both fell through the repository error mappers' catch-all into `throw new UnexpectedPersistenceError(...)`, which every client sees as `500 Internal Server Error`, indistinguishable from an actual bug and typically wired to the same alerting. How should the application recognize `40001`/`40P01` and communicate them to an HTTP client in a way that reflects what actually happened — an expected, transient loss of a race, not a server fault — without weakening the guarantee that a domain object was written consistently?

## Decision Drivers

- A transient conflict is a normal, expected outcome of running under `SERIALIZABLE` isolation, not a bug, and must not be reported or alerted on the way `UnexpectedPersistenceError` is.
- The distinction between "retry this, nothing is broken" and "something is actually wrong" must reach the caller, not just whoever is reading server logs — consistent with [002](002-error-handling-strategy.md)'s decision that expected and unexpected failures must stay distinguishable.
- Detection must not misclassify an unrelated persistence error (e.g. a unique-constraint violation surfaced during the same transaction) as a transient conflict.
- Reuse the existing thrown-exception → [`DomainErrorsExceptionFilter`](../src/presentation/http/domain-errors-exception-filter.ts) → HTTP-status pipeline rather than inventing a second one.
- Whatever the fix is, it must not impose a new invariant on every method already carrying `@ResultTransactional()` — that decorator is applied uniformly, without per-method judgment calls, and this decision should not change that.
- Low cognitive overhead for contributors who touch the project infrequently.

## Considered Options

- Status quo — a `40001`/`40P01` becomes `UnexpectedPersistenceError` → `500`
- Retry at the transaction boundary
- Surface it to the client as `409 Conflict`
- Drop to `READ COMMITTED`

## Decision Outcome

Chosen option: "Surface it to the client as `409 Conflict`", because it tells the caller the true, actionable fact — retry the request — without requiring any change to how `@ResultTransactional()`-decorated methods are written, and without silently re-executing a method body that may already have observed its own partial effects. `isTransientTransactionError` (`src/infrastructure/persistence/error/is-transient-transaction-error.ts`) recognizes exactly `40001` and `40P01`, checking the error itself and, if that doesn't match, exactly one level of `.cause` — a repository's own error mapper already wraps an unrecognized `pg` error in `UnexpectedPersistenceError(cause)` before it reaches `ResultTransactional`, while a failure raised by `COMMIT` itself never passes through a repository and arrives unwrapped, so one level covers both shapes without over-matching. `ResultTransactional` translates a match, once, at the transaction boundary, into a thrown `TransactionConflictError` (`src/application/error/transaction-conflict.error.ts`), logs it at `warn` (not `error`, since it isn't one), and `DomainErrorsExceptionFilter` maps it to `409 Conflict` — a new branch matching the shape of the two other conflict types the filter already maps to `409` (`DuplicateEntityError`, `EntityInUseError`). Every controller endpoint documents the new `409` case in its OpenAPI decorators, either by extending an existing `409` response or adding one.

Because the predicate and the error class are genuinely small and pure — a constant table plus `DatabaseError` checks, and a thrown-not-`Err` error class with no DI or framework types — but live in `src/infrastructure/persistence/error/` and `src/application/error/` respectively, `ResultTransactional` (in `src/util/`) needs to reach into both directly. `.dependency-cruiser.cjs`'s blanket `util-must-not-import-application-domain-presentation-infrastructure-or-module` rule gained two narrow `pathNot` exceptions for exactly those two paths, not for `src/infrastructure/` or `src/application/` at large — importing anything else from either layer out of `util` still fails `npm run lint:architecture`. This is the same shape of concession `util`'s existing coupling to persistence machinery already required (see [architecture-review.md](architecture-review.md) finding 3); it does not deepen that coupling, since both files it now reaches are pure and were already logically infrastructure/application concerns rather than duplicated constants.

### Consequences

- Good, because a transient conflict now reaches the client as an accurate, actionable `409` instead of a `500` that looks like a bug and pages on-call for an outcome the database produced on purpose.
- Good, because detection and translation happen in exactly one place — inside `ResultTransactional` — so no application service or repository method needs to know `40001`/`40P01` exist.
- Good, because no new invariant is imposed on `@ResultTransactional()`-decorated methods: the decorated method body is never re-executed, so nothing changes about what is safe to put inside one.
- Good, because the two `lint:architecture` exceptions are scoped to exactly the two files this decision needs, not to the layers they live in, so the architectural boundary stays enforced everywhere else.
- Bad, because `409` is now used in this codebase for two conceptually different situations — a deterministic conflict that requires the caller to change the request (`DuplicateEntityError`, `EntityInUseError`) and a transient one where resubmitting the identical request is the correct response (`TransactionConflictError`) — distinguished only by the response body's message, not the status code. This is consistent with the HTTP spec, under which `409` means "conflict with the current state of the resource, resolve and resubmit" without specifying permanence either way, but it is a real distinction a caller must read the message to act on correctly, and nothing here adds a machine-readable field to make that cheaper.
- Bad, because read paths (`getAll`, `get`) still pay for `SERIALIZABLE` isolation — a `BEGIN`/`COMMIT` round trip and SIREAD predicate-lock bookkeeping for what is often a single `SELECT` — and are still exposed to being the losing side of a serialization failure despite writing nothing. This decision makes that outcome visible and correct rather than a `500`; it does not make it cheaper. See option 4 below.
- Bad, because a client that does not distinguish `409` sub-cases and retries unconditionally will now retry `DuplicateEntityError`/`EntityInUseError` too, which cannot succeed by retrying alone; this was already possible before this decision (both existing `409`s predate it) and is not made worse, but it is not fixed either.

## Pros and Cons of the Options

### Status quo — `40001`/`40P01` become `UnexpectedPersistenceError` → `500`

- Neutral, because it requires no new code at all.
- Bad, because it turns an expected, self-correcting outcome into a server error, indistinguishable from a genuine bug in every log line, dashboard, and alert that keys off `5xx`.
- Bad, because a caller has no way to know retrying would likely succeed — the response looks identical to a real failure.

### Retry at the transaction boundary

- Good, because a client-visible error disappears entirely for the (likely common) case where a bounded number of retries succeeds.
- Bad, because retrying means re-executing the decorated method body, and the only place that can safely happen is the outermost `@ResultTransactional()` call in a chain — a nested one retrying its own inner transaction independently would not fix a conflict detected at commit of the outer one. Enforcing "outermost only" means the retry must be bounded, jittered, and, critically, safe to run twice — which forces a permanent invariant onto the entire codebase: no `@ResultTransactional()`-decorated method may ever have a side effect outside the database (an email, a call to another service) that a caller cannot tell was already sent once, since retrying replays the whole method body, not just its SQL.
- Bad, because that invariant is a significant, easy-to-violate constraint to impose on every future contributor, for a benefit an honest `409` gets the caller without it: a client that legitimately wants a retry can just issue one.

### Surface it to the client as `409 Conflict` (chosen)

- Good, because it requires no new invariant on `@ResultTransactional()`-decorated methods — the method body runs exactly once, succeeds or fails, and the caller decides what "retry this" means for its own request.
- Good, because it reuses the thrown-exception → `DomainErrorsExceptionFilter` → HTTP-status pipeline this codebase already has for every other conflict-shaped domain error, rather than adding a second error-handling path.
- Bad, because it pushes the retry decision (whether, how many times, with what backoff) onto every API consumer instead of solving it once, centrally.

### Drop to `READ COMMITTED`

- Good, because it would eliminate `40001` entirely (deadlocks remain possible under any isolation level) and would remove the round-trip and predicate-lock cost `SERIALIZABLE` imposes on every pure-read method.
- Bad, because it does not eliminate `40P01` deadlocks, so this decision's mechanism would still be needed regardless.
- Bad, because the write paths' safety currently rests on `SERIALIZABLE` catching read-modify-write races that the optimistic-concurrency token predicate does not itself prevent at the isolation level; downgrading requires auditing every application service's read-modify-write flow to confirm the token predicate alone is sufficient, which this plan does not do.
- Recorded as a live, explicitly undecided follow-up in [`KNOWN_ISSUES.md`](../KNOWN_ISSUES.md), deferred while expected traffic and load stay very low. Not chosen here because it needs its own analysis — the read-modify-write audit named in the bullet above — not because it was rejected on the merits.

## More Information

This decision adds a third error category to [002](002-error-handling-strategy.md)'s two-channel model. A `40001`/`40P01` is neither an expected domain `Err` — no application service or repository interface declares it as part of its return type, because it is not a condition specific to any one operation — nor a bug in the `UnexpectedPersistenceError` sense, since nothing about the request, the data, or the code is wrong. It leaves through the thrown channel, like an unexpected error, because it can only be detected after the decorated method body has already resolved (`Ok` or `Err`) and the surrounding `@nestjs-cls/transactional` transaction attempts to commit — by then there is no `Result` left to fold it into. `ResultTransactional` is the one place positioned to catch it, since it is the one place that owns the transaction boundary; see [001](001-persistence-strategy.md) for why that boundary is owned by `@nestjs-cls/transactional` and the application layer rather than by individual repositories.

See [`src/infrastructure/persistence/error/is-transient-transaction-error.ts`](../src/infrastructure/persistence/error/is-transient-transaction-error.ts) for the predicate, [`src/application/error/transaction-conflict.error.ts`](../src/application/error/transaction-conflict.error.ts) for the error class, [`src/util/result-transactional.decorator.ts`](../src/util/result-transactional.decorator.ts) for where they meet, and [`src/presentation/http/domain-errors-exception-filter.ts`](../src/presentation/http/domain-errors-exception-filter.ts) for the `409` mapping.
