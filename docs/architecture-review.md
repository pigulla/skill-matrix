# Architecture Review

Re-verified 2026-08-21 against `AGENTS.md`, all five decision records, all four `.claude/skills/*/SKILL.md` (plus their deeper guides), `KNOWN_ISSUES.md`, and the code as it stands on `refactor` (`bbcc349`). `npm run lint` passes, so nothing here is something `tsc`, biome, knip, `depcruise` or the SQL/markdown linters would have caught on its own.

This is a punch list only — findings ranked by criticality, with no notes on what already works. Findings that have since been addressed have been removed outright. **Finding numbers are stable identifiers, not a sequence**: ADRs [003](003-concurrency-token-hashing.md), [004](004-dto-construction.md) and [005](005-transaction-conflict-response.md) cite them by number, so gaps in the numbering are removed findings, not omissions.

One finding was suppressed against `KNOWN_ISSUES.md`: the cost `SERIALIZABLE` isolation imposes on every read path (the second half of the original finding 2), deferred because expected traffic and load are very low.

---

## Critical

### 3. `util` is where the layer boundary gets circumvented — and it costs the whole application layer its unit tests

`AGENTS.md` § Architecture still states Util may import "Nothing from other layers". That is now false in two distinct ways:

- `src/util/result-transactional.decorator.ts` imports `TransactionHost` from `@nestjs-cls/transactional` and the pg-promise adapter type, and every application service imports it. So the application layer does depend on the persistence transaction machinery — via a layer declared dependency-free, through an external package the rules do not inspect.
- It also imports `#/application/error/transaction-conflict.error.js` and `#/infrastructure/persistence/error/is-transient-transaction-error.js`. Those two are deliberate, narrowly-scoped exceptions granted by [ADR 005](005-transaction-conflict-response.md) and encoded as `pathNot` entries in `.dependency-cruiser.cjs`, so they are not the problem — but the layer table in `AGENTS.md` was never updated to admit them (see [Documentation drift](#documentation-drift)).

The concrete cost is still written down as a "Known gap" in `.claude/skills/writing-tests/unit-tests.md`: the decorator calls the **static** `TransactionHost.getInstance()`, a global service locator, so constructing a service with mocked collaborators throws `TransactionHost not initialized`. There is still exactly one unit test in the whole repo (`pending-migrations-checker.test.ts`) and zero for any application service, while `vitest.config.ts` still demands 100 % branch coverage for `src/application/**` — satisfied only indirectly through controller integration tests. The skill records the symptom; the cause is that a persistence concern was placed in `util` and reaches its dependency through a global rather than through DI.

**Suggestion:** make the transaction boundary an injected collaborator. Either define an application-layer port (`ITransactionRunner` with `run<T, E>(fn): ResultAsync<T, E>`) implemented in infrastructure, or keep the decorator but resolve `TransactionHost` through DI (a Nest interceptor or an explicitly injected host) so tests can supply `@nestjs-cls/transactional`'s `NoOpTransactionalAdapter`. Independently, move `unwrap-result.decorator.ts` to `src/presentation/http/` — it is purely an HTTP adapter and all six of its importers are controllers — and add a dependency-cruiser rule pinning which **external** packages each layer may import (see finding 12), so the next instance of this is caught mechanically.

### 12. dependency-cruiser is missing its highest-value rules, and seven real import cycles exist today

`.dependency-cruiser.cjs` has seven well-targeted layer rules and none of the standard structural ones — no `no-circular`, no `no-orphans`, no `not-to-dev-dep`, no `doNotFollow` for `node_modules`, and no allowlist of permitted external packages per layer. Nothing prevents `@nestjs/common` or `pg-promise` from being imported into `src/domain` — which is finding 3's gap, mechanically unenforced.

Adding `no-circular` and `not-to-dev-dep` ad hoc and re-running `depcruise` confirms both gaps are live, not hypothetical:

- **Seven import cycles**, one per entity: every `invalid-<entity>.error.ts` imports its entity solely to pass `<Entity>.name` to `super()`, while the entity imports the error. Nothing depends on the cycle at runtime — the reference sits inside a constructor body, not at module scope — but it breaks the first time someone hoists it. Passing the name as a string literal removes all seven.
- **~38 `src/` → devDependency edges** (`type-fest` from `src/application/**`, `vitest` from every `*.mock.ts`). All type-only, so harmless at runtime, but nothing distinguishes them from a real one.

Two constraints on the fix, both still current. dependency-cruiser 18 supports `typescript >=2 <7` and this project is on `typescript@7`, so `dependencyTypesNot: ['type-only']` (which needs `tsPreCompilationDeps`, which needs that compiler) is unavailable — the type-only devDependency edges above have to be allowlisted by hand until the version gap closes. And `express` would need allowlisting too: `etag.interceptor.ts` and `if-match-header.decorator.ts` import `Request`/`Response` from it while it is not a declared dependency — it arrives transitively through `@nestjs/platform-express`, with only `@types/express` declared. Type-only, so harmless at runtime, but it is a package the project uses without saying so.

**Suggestion:** add `no-circular`, `no-orphans`, `not-to-dev-dep`, `doNotFollow: node_modules`, and per-layer external allowlists for the two layers `AGENTS.md` declares free of other layers (`domain-may-only-import-approved-externals`, `util-may-only-import-approved-externals`). Verify each new rule fails on an injected violation before trusting it, and fix the seven cycles in the same change.

---

## Significant

### 7. Branded IDs are asserted at the HTTP boundary, not validated

Every controller binds `@Param('id', new ParseUUIDPipe({ version: '4' })) id: SkillID`. `ParseUUIDPipe` returns a `string` and checks only UUID-ness; the declared parameter type asserts the brand. So `idSchema`'s lowercase normalization — which its own comment says exists so "every consumer of a branded ID always sees the canonical form" — never runs on inbound path parameters, and a `SkillID`-typed value reaches the service and the SQL layer without passing through the schema whose brand it carries. The brand is load-bearing everywhere else in the codebase.

(The entity-marker refinement this finding originally also covered has since been removed from every `*IdSchema`, so only the normalization gap remains.)

**Suggestion:** a single `ZodPipe(schema)` (or `createParamDecorator`) used for every ID binding, so the same schema validates inbound IDs, DB rows, and domain construction.

### 8. `update` reads before writing for no benefit

All five read-modify-write `*.service.update()` methods (`user`, `team`, `skill`, `example`, `example-kind` — `team-skill-proficiencies` is already complete-input) do `repository.get(id)` → `existing.update(properties)` → `repository.update(...)`. But the update DTOs are complete (`.pick({ id, name, ... }).strict()`, all fields required — PUT, not PATCH), and the `WITH current_row ... LEFT JOIN updated_row` CTE in each `update.sql` already distinguishes "no such row" from "stale token" on its own. The extra `SELECT` adds a round trip and buys nothing.

The signature `SetRequired<Partial<Properties>, 'id'>` is what invites it — it advertises partial-update support that no endpoint offers.

**Suggestion:** have services accept the complete `Properties` and drop the read. If PATCH is wanted later, add it as its own method with its own semantics rather than leaving every PUT paying for it. This is also a prerequisite worth doing first for the deferred isolation-level question in `KNOWN_ISSUES.md`, since it removes the read half of four of the five read-modify-write flows that question's audit would have to cover.

### 9. `team-skill-proficiencies` diverges from every sibling slice

Four divergences in one slice, none explained by the domain:

- **No concurrency control.** No `version` column, no ETag, no `If-Match` — one of the two mutable resources with no lost-update protection, while `team`, `skill`, `example` and `example-kind` all have it. [ADR 003](003-concurrency-token-hashing.md) records `skills_to_teams_with_proficiency` as deliberately out of scope and points back at this finding, and `database-changes/SKILL.md` makes the mechanism a non-negotiable rule for every mutable entity "or the ADR says why not" — so this is a recorded open decision, not a silent omission, and it stays open until it is either implemented or given a real justification in the ADR.
- **`POST /teams/:teamId/skill-proficiencies/:skillId`.** POSTing to a fully-specified resource identity is non-idempotent for an operation that is naturally "set this team's proficiency for this skill". `PUT` would collapse `add` and `update` and make `DuplicateTeamSkillProficienciesError` unnecessary.
- **`DELETE` returns `200` plus the whole collection** (`@HttpCode(HttpStatus.OK)`, body `TeamSkillProficienciesDTO`) where every other delete returns `204`.
- **The controller rewrites domain errors.** `add()` maps `SkillReferenceNotFoundError` → `SkillNotFoundError` and `TeamReferenceNotFoundError` → `TeamNotFoundError`. The inline comment explains the intent — the filter's default mapping would produce `422`, which is wrong for a bad route parameter — and that reasoning holds, so the _outcome_ is not in question. What is: `AGENTS.md` says controllers "serve exclusively as an adapter from HTTP to the application layer", and synthesizing a different domain error to steer a status code is the presentation layer reaching into the domain vocabulary to work around a mapping table it doesn't own.

**Suggestion:** `PUT`/`DELETE` on the sub-resource with a concurrency token, and move the status decision into `DomainErrorsExceptionFilter` — e.g. let a route opt into "reference-not-found means 404 here" instead of constructing a different domain error.

### 10. `users` has no optimistic concurrency

No `version` column, no ETag on `GET /users/:id`, no `If-Match` on `PUT`/`DELETE` — the other slice besides finding 9's without it. As with that finding, [ADR 003](003-concurrency-token-hashing.md) records `users` as deliberately out of scope and cites this finding as the record of the open question, so it stays open until users are either brought in line (the mechanism is cross-cutting by ADR 003's own framing) or the ADR states why they are permanently exempt.

### 11. The ETag mechanism is half-wired

- The contract between `@ETagResponse()` and the handler's return type is unenforced. `getOne` declares `ResultAsync<WithConcurrencyToken<SkillDTO>, …>`, which is _not_ the response body — `ETagInterceptor` unwraps it. Forget the decorator and the `{ value, token }` wrapper is serialized to the client; the `@ApiResponse({ type: SkillDTO })` annotation that documents the real body is maintained by hand.
- No `If-None-Match` handling and no `Cache-Control` anywhere, so ETags serve only the write path. Conditional GET is the cheaper half of what the infrastructure already makes possible.
- Collection endpoints emit no ETag at all.

**Suggestion:** have the interceptor derive its OpenAPI response type, or replace the wrapper with a typed `ETagged<T>` response class that cannot be returned without the interceptor; then add `If-None-Match` → `304`.

### 13. OpenAPI decorators are the bulk of every controller file, and they are copy-pasted

The six entity controllers total 1,817 lines (239–336 each) for handler bodies that are almost all one-liners; nearly all the rest is `@Api*` decorators. The `@ApiResponse` blocks for `400`/`404`/`409`/`412`/`422`/`428`/`500`, the `@ApiHeader({ name: 'If-Match' })` block, and the ETag response-header block are copy-pasted across all six — the give-away being the identical double-space typo `'... is missing,  malformed ...'` in every one of them. The `409` work for [ADR 005](005-transaction-conflict-response.md) made this worse: the same seven-line `transactionConflict` example literal, with the same message string, now appears 29 times. This is by a wide margin the largest block of duplication in the codebase.

**Suggestion:** composed decorators via `applyDecorators` — `@ApiStandardErrors()`, `@ApiETagResponse(Dto)`, `@ApiIfMatch()`, `@ApiConflict({ duplicate?, inUse? })`. Controllers then read as their routes rather than their annotations, and the conflict message lives in one place.

### 14. No pagination, and one collection has no defined order

Every `getAll` returns an unbounded array with no `limit`/`offset`/cursor — no SQL file in the repo contains `LIMIT`. Additionally `skill/sql/get-all.sql` is the one `get-all` with no `ORDER BY` (it selects from `view_skills_with_examples`, whose `GROUP BY` order is an implementation detail), while `user`, `team`, `example` and `example-kind` all sort. List order for skills is unspecified, which is why `test/util/sort-by-id.ts` has to exist.

### 15. Operational configuration gaps

No connection-pool sizing (`ConnectionProvider` passes no `max`/`min` to `pgp()`), and no `statement_timeout`, `idle_in_transaction_session_timeout`, or `connect_timeout` — notable given every request opens a serializable transaction, where one stuck transaction holds predicate locks. That makes these timeouts the cheap mitigation for the isolation-level cost deferred in `KNOWN_ISSUES.md`, and worth having independently of it. Also: no request body size limit, no API versioning or global path prefix (so there is no forward path for a breaking change), and `custom-environment-variables.json` maps only the database connection and server host/port — `openApi.server`, `logging.level` and `swagger.enabled` cannot be set per environment despite being exactly the values that differ per environment.

---

## Minor

- **`error-codes.ts` is 441 lines for six constants in use** (`UNIQUE_VIOLATION`, `RESTRICT_VIOLATION`, `FOREIGN_KEY_VIOLATION`, `UNDEFINED_TABLE`, `SERIALIZATION_FAILURE`, `DEADLOCK_DETECTED`). Trim to what's referenced, or generate it from the PostgreSQL source rather than hand-maintaining a copy of ~280 codes.
- **Value-object boilerplate is copy-pasted seven times.** `#brand = Symbol.for(...)`, the `safeParse`-or-throw constructor, field-by-field assignment, `update()`, and `toJSON()` are structurally identical in `User`, `Team`, `Skill`, `Example`, `ExampleKind`, `SkillProficiency` and `TeamSkillProficiencies`. A `defineValueObject(schema, InvalidXError)` factory would collapse it and give a natural home for the `equals()` that no value object currently has.
- **Near-identical row schemas.** `skillUpdateRow` and `skillDeleteRow` are byte-for-byte the same union, and the pattern repeats in `team`, `example` and `example-kind`. One shared `deletedOrStaleRow(idSchema)` helper covers all eight.
- **`createDatabaseConfig` hand-duplicates its own Zod input type** and is the only exported function in the codebase without an explicit return type — `z.input<typeof databaseConfig>` removes both problems.
- **Naming drift for one concept across layers:** table `skills_to_teams_with_proficiency`, view `view_team_skill_proficiencies`, domain `TeamSkillProficiencies`, route `teams/:teamId/skill-proficiencies`. Its `CHECK` constraint is also the one constraint that breaks its own table's naming pattern (`skills_to_teams_proficiency_check`, missing `_with_proficiency`).
- **The 0–4 proficiency range is encoded twice** — `proficiencySchema`'s `.min(0).max(4)` and the SQL `CHECK (proficiency BETWEEN 0 AND 4)` — with nothing tying them together. Worth a test that drives the boundary through the DB, or at least a comment cross-referencing both sites.
- **`ITimeProvider.highResolutionTimestamp()` is unused** (defined, mocked, implemented, never called).
- **`test.ts` at the repo root** is a leftover scratchpad — an unrelated `maxProductDifference` LeetCode solution plus a `console.warn`, kept alive by three `biome-ignore` comments. Neither knip nor biome flags it. Delete it.
- **`config/default.jsonc` ships `username: ""` / `password: ""`, which its own schema rejects** (`min(1)`). Fail-fast is right, but the failure surfaces as a Zod error on a default value rather than "DATABASE_PASSWORD is not set". A `.min(1, 'DATABASE_PASSWORD must be set')` message, or omitting the keys, reads better at 3 a.m.
- **`create()` discards its `RETURNING` row and re-reads.** `SkillRepository.create()` inserts with `RETURNING id, name, description, concurrency_token(version)`, ignores the result, then calls `this.get(id)` — three statements where two suffice. The re-read is genuinely needed for the aggregated `example_ids`, but the `RETURNING` clause is then pointless and should be trimmed to `RETURNING id` (or dropped) so it doesn't read as load-bearing.

---

## Documentation drift

Listed separately because these files are what agents follow, so drift here reproduces itself as code.

- **`database-changes/SKILL.md` and `adding-a-repository.md` still teach the pre-`Result` idiom.** Repository interfaces shown as `Promise<Widget>`; `throw new WidgetNotFoundError(id)`; "**Wrap every query in try/catch**" as a non-negotiable rule; `@Transactional()` rather than `@ResultTransactional()` in both the rules list and step 8; and a "**`get*` throws, `find*` returns `null`**" non-negotiable rule. The codebase has no `find*` method anywhere, no repository throws a domain error, and `AGENTS.md` § Error handling explicitly forbids both ("Never throw a concrete domain error … from a repository or service method"; "Never use plain `@Transactional()` on a method returning a `ResultAsync`"). Followed verbatim, the guide labelled the canonical worked example produces code that violates `AGENTS.md`.
- **`writing-tests/integration-tests.md` contradicts the `Result` assertion pattern**: "Assert error cases throw the domain error (`*NotFoundError`, `Duplicate*Error`)", where `AGENTS.md` and the parent `SKILL.md` require asserting on the resolved `Result`. `adding-a-repository.md` step 9 repeats the same instruction.
- **`writing-tests/unit-tests.md` teaches an assertion idiom nothing uses.** Its closing note prescribes `result._unsafeUnwrap()`/`._unsafeUnwrapErr()`; `_unsafeUnwrap` appears nowhere in `src/` or `test/`, and the parent `SKILL.md` prescribes `expect(result).toEqual(ok(value))` with an explicitly narrower fallback.
- **`AGENTS.md` § Architecture says `util` may import "Nothing from other layers"**, which is now false by design: [ADR 005](005-transaction-conflict-response.md) granted `src/util/` two deliberate exceptions (`src/application/error/`, `src/infrastructure/persistence/error/`) and encoded them in `.dependency-cruiser.cjs`, but the layer table never followed. The table is the first thing an agent reads about the layer, and it contradicts both the lint config and the ADR (see finding 3).
- **`AGENTS.md` omits the concurrency/ETag layer entirely** — the words "ETag", "concurrency", "If-Match" and "version" appear nowhere in it, despite this being the newest cross-cutting mechanism in the codebase. `database-changes/SKILL.md` and `adding-a-repository.md` now carry the full per-entity checklist, so the gap is only in the top-level document, but that is the one file loaded unconditionally.
- **Two ADRs cite documents and findings that no longer exist.** [ADR 005](005-transaction-conflict-response.md) links `docs/task-serialization-failure-conflict.md` and references "the 'Out of scope' section of the plan that implemented this ADR"; all three `docs/task-*.md` plan files were deleted once executed. It also points at "finding 2" twice — once as where the `READ COMMITTED` follow-up is recorded — but that follow-up now lives in `KNOWN_ISSUES.md`, so those two references need repointing rather than restoring. [ADR 004](004-dto-construction.md) says its reasoning was worked out while reviewing "finding 6", which this revision removed as fully addressed. Nothing lints Markdown links, so none of this went noticed.

---

## Suggested order

1. Finding 12 — one config file plus seven one-line error-class edits, and it is what stops findings 3 and 12 from silently recurring.
2. Finding 3 — this unblocks unit-testing the application layer, which is the largest single gap in the test strategy.
3. Finding 8 — worth doing before the isolation-level question deferred in `KNOWN_ISSUES.md` is ever reopened, since it shrinks that question's audit by four of five flows.
4. The documentation drift section — cheap, and it is what stops findings 9 and 10 from recurring in the next slice.
5. Findings 7, 9–11, 13–15 as capacity allows; 13 and 14 are the lowest-risk visible wins.
