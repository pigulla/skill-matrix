# Known Issues

Implementation issues that have been identified during a review (see the [`review-implementation`](./.claude/skills/review-implementation) skill) but are explicitly not worth fixing right now. Entries here are treated as a suppression list — matching issues are not re-flagged on future reviews.

Add a bullet whenever a finding is intentionally deferred rather than fixed. Keep each one self-contained: what the issue is, where it lives, and why it's being left alone.

<!--
- `SkillRepository.bulkUpdate()` doesn't wrap its two writes in `@ResultTransactional()` — low-traffic admin path, not worth the atomicity guarantee yet.
-->

- **Every read path pays for `SERIALIZABLE` isolation.** `DEFAULT_TX_OPTIONS` (`src/infrastructure/persistence/default-transaction-options.ts`) sets serializable isolation for every transaction, and every public application-service method carries `@ResultTransactional()`, so pure reads (`getAll`, `get`) each pay a `BEGIN`/`COMMIT` round trip plus SIREAD predicate-lock bookkeeping for what is usually a single `SELECT`, and can lose a serialization race despite writing nothing. [ADR 005](docs/005-transaction-conflict-response.md) records dropping to `READ COMMITTED` as a live, explicitly undecided follow-up (not an option rejected on the merits) and names its prerequisite: an audit of every read-modify-write flow confirming the optimistic-concurrency token predicate alone is sufficient at that isolation level. Deferred — expected traffic and load are very low, so the round trip and lock bookkeeping cost nothing that matters yet, and the audit isn't worth the effort at this point. Revisit if load grows or if `409`s from transient conflicts start showing up in practice. `READ ONLY DEFERRABLE` for pure-read methods is the smaller half of the same idea and is deferred with it (it would also need `@ResultTransactional()` to accept per-method transaction options, which it currently does not).
