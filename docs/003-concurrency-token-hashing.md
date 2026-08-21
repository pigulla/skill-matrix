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
- `users` and `skills_to_teams_with_proficiency` are also mutable entities but are currently exempt from this mechanism, deliberately left out of scope for this plan — see [architecture-review.md](architecture-review.md) findings 9 and 10.

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
