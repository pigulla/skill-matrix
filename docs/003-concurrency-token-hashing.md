---
status: "accepted"
date: 2026-08-13
---

# Concurrency Token Hashing

## Context and Problem Statement

Optimistic concurrency control is a cross-cutting concern, not a feature of any one entity: any mutable entity exposed over HTTP needs the same mechanism, designed once and reused rather than re-derived per entity. A client reading an entity gets back an ETag derived from that row's `last_updated` timestamp and must present it as an `If-Match` header on a later update or delete; the server rejects the write if the row has changed since, via a single atomic SQL statement (`UPDATE/DELETE ... WHERE id = $(id) AND <token predicate>`) — no separate read, row lock, or extra round trip.

The token should not double as a readable encoding of `last_updated` — not because it's a security boundary (it isn't a credential, and a modification timestamp isn't confidential), but because trivial one-line decodability is a needless internal-detail leak. How should it be produced so that it's opaque against casual inspection, cheap on every read and write, and computable identically in TypeScript (to mint it) and PostgreSQL (to validate it inline in a single `WHERE` clause) — without pulling in machinery this isn't actually a security boundary for?

## Decision Drivers

- Opacity against casual inspection, not cryptographic security — nothing about auth depends on this token being unforgeable.
- Must be computable identically in TypeScript and PostgreSQL, since validation happens inline in a single SQL `WHERE` clause, not via a decode step.
- Runs on every read and write of every entity, so a deliberately slow, security-hardened hash is the wrong tool.
- Minimal new dependencies, consistent with [001](001-persistence-strategy.md)'s preference for narrowly-scoped, explicit tools.
- The two independent implementations (TypeScript, SQL) must not silently drift apart over time.

## Considered Options

- A reversible encoding of the timestamp (base64)
- A fast, non-cryptographic hash requiring a new dependency (e.g. [FNV-1a](https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function) via [`@sindresorhus/fnv1a`](https://www.npmjs.com/package/@sindresorhus/fnv1a))
- MD5, natively available in both Node.js and PostgreSQL

## Decision Outcome

Chosen option: "MD5, natively available in both Node.js and PostgreSQL", because it's the only option that makes the token non-reversible, needs no new npm dependency or Postgres extension, and — critically — is a single built-in function call on both sides, so the write path's atomic `UPDATE ... WHERE` comparison stays one SQL statement instead of decoding a token back into a raw value (impossible for a one-way hash) or restructuring into a locked read-then-write. MD5 is used purely as a fast, deterministic mixing function here, not for any cryptographic property — the same category of use as a hash-based cache key, not a security control.

- **TypeScript**: `toConcurrencyToken(lastUpdated: Dayjs)` in [`concurrency-token.codec.ts`](../src/infrastructure/persistence/concurrency-token.codec.ts) hashes the epoch-millisecond value with `crypto.createHash('md5')`, minting the ETag on each read.
- **PostgreSQL**: a `concurrency_token(TIMESTAMPTZ)` function (defined in [the migration that introduces it](../migrations/20260728160000000_skills_and_examples.sql)) computes the same hash via the built-in `md5(text)`, used inline in every entity's `update`/`delete` `WHERE` clause.
- Both sides hash the same canonical value — the timestamp's epoch-millisecond decimal string — and an integration test ([`concurrency-token.parity.test.ts`](../test/integration/persistence/concurrency-token.parity.test.ts)) pins that agreement.
- The domain schema (`ConcurrencyToken`) validates only `z.hash('md5')`, with no knowledge of what the token represents or how it's derived.

### Consequences

- Good, because the token isn't a one-line `Buffer.from(etag, 'base64')` away from revealing `last_updated`, unlike a reversible encoding.
- Good, because MD5 is fast and needs zero new dependencies — `node:crypto` and PostgreSQL's built-in `md5()` are both already there.
- Good, because the write path keeps its single-statement, atomic optimistic-concurrency check, with no row lock or extra round trip.
- Bad, because MD5 offers no real cryptographic guarantee, and the pre-image is small — an epoch-millisecond timestamp — so a client with a rough idea of _when_ a row changed could brute-force the exact value (cheaply: ~8.6×10⁷ guesses per day of uncertainty). Accepted deliberately: the goal was closing off trivial decoding, not building a secret.
- Bad, because two independently-maintained implementations (Node's `crypto`, Postgres's `md5()`) must keep agreeing on the same canonical input; mitigated by using one simple, unambiguous format on both sides and by the parity test that would fail immediately if they diverged.

## Pros and Cons of the Options

### A reversible encoding of the timestamp (base64)

- Good, because it's the simplest possible implementation.
- Bad, because trivial decodability is exactly the property this token shouldn't have.
- Bad, because validating "decodes to a plausible timestamp" would couple the domain schema to an infrastructure-layer encoding detail it has no reason to know about.

### A fast, non-cryptographic hash requiring a new dependency ([FNV-1a](https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function))

- Good, because it's faster than a cryptographic hash and purpose-built for this exact shape of problem.
- Bad, because it doesn't exist in PostgreSQL, natively or via a common extension — validating it inline would mean either reimplementing it from scratch in SQL (a second, error-prone implementation of a comparatively obscure, multi-variant algorithm) or giving up single-statement atomicity for a locked read-then-write.
- Bad, because it's a new external dependency where the chosen option needs none.

### MD5, natively available in both Node.js and PostgreSQL

- Good, because it needs zero new dependencies and keeps the write path's atomic check a single statement.
- Neutral, because a stronger cryptographic hash (SHA-256) or a keyed HMAC would close the brute-forceability gap noted above — but neither is warranted: this token secures nothing, so paying for genuine forgery-resistance or a signing secret would solve a problem this system doesn't have.

## More Information

This builds on [001](001-persistence-strategy.md): the same thin-execution-layer approach made it natural to add `concurrency_token()` as a small SQL function rather than reach for a Node-only hash and restructure the write path around it. If genuine forgery-resistance is ever needed (e.g. the token gets used somewhere authentication-adjacent), the right escalation is an HMAC keyed with a server-side secret, not a stronger unkeyed hash — but nothing in the current design needs that.
