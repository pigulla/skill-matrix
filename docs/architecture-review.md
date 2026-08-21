# Architecture Review

Reviewed 2026-08-19 against `AGENTS.md`, the three decision records, all four `.claude/skills/*/SKILL.md` (plus their deeper guides), and the code as it stands on `main` (`05e2137`). `npm run lint` passes, so nothing here is something a linter, `tsc`, `knip` or `depcruise` would have caught on its own.

This is a punch list only — findings ranked by criticality, with no notes on what already works. `KNOWN_ISSUES.md` is currently empty, so nothing was suppressed.

---

## Critical

### 1. The concurrency token can compare equal across a real change

`toConcurrencyToken()` (`src/infrastructure/persistence/concurrency-token.codec.ts`) and the SQL `concurrency_token()` function (`migrations/20260728160000000_skills_and_examples.sql`) both hash `last_updated` truncated to milliseconds, and `last_updated` is supplied by the **application** clock (`this.timeProvider.now().toDate()` in every repository `create`/`update`).

Token equality is therefore not equivalent to "the row has not changed":

- Two updates landing in the same millisecond produce the same token. A client holding the pre-change ETag still satisfies `concurrency_token(last_updated) = $(expectedToken)` and silently clobbers the intervening write — the exact lost update the mechanism exists to prevent.
- Nothing enforces that `last_updated` moves forward. With several app instances (or an NTP step), a token value that a client already holds can recur, so a stale `If-Match` becomes valid again.
- It is also what forces the two-implementation parity problem that ADR 003 accepts as its main downside.

**Suggestion:** derive the token from a monotonic per-row counter instead of a timestamp — a `version BIGINT NOT NULL DEFAULT 1` column, `SET version = version + 1` in the same statement, predicate `concurrency_token(version) = $(expectedToken)`. This keeps the single-statement atomic check, keeps the token opaque, removes the clock dependency, and removes the TS/SQL parity requirement (the token becomes `md5(version::text)`, computed on one side only if you return `version` via `RETURNING`). `xmin` is the zero-schema-change alternative but changes spuriously after `VACUUM FREEZE`, causing false `412`s. ADR 003 should be superseded rather than amended — its decision drivers stay valid, its chosen pre-image does not.

**Extracted as an executable plan:** [`task-monotonic-concurrency-tokens.md`](task-monotonic-concurrency-tokens.md) — self-contained, ready for a dedicated session.

**Resolved.** The token is now derived from a monotonic per-row `version BIGINT NOT NULL DEFAULT 1` column rather than `last_updated`: every `update`/`delete` increments it in the same statement its `WHERE` clause guards (`concurrency_token(version) = $(expectedToken)`), so token equality is exactly row-change equality with no clock dependency and no cross-instance coordination needed. `concurrency_token()` now takes a `BIGINT`, hashing is computed entirely in PostgreSQL, and the TypeScript-side codec and its parity test are gone. See [ADR 003](003-concurrency-token-hashing.md), rewritten in place to describe the version-based design.

### 2. `SERIALIZABLE` everywhere, no serialization-failure retry

`DEFAULT_TX_OPTIONS` (`src/infrastructure/persistence/default-transaction-options.ts`) sets serializable isolation, and every public method of every application service carries `@ResultTransactional()`. There is no handling for `40001 serialization_failure` or `40P01 deadlock_detected` anywhere — `grep` finds neither outside the unused `error-codes.ts` table — so both fall into the `throw new UnexpectedPersistenceError(...)` fallback and surface as `500`.

Under serializable isolation those errors are not bugs; they are the documented, expected way the server tells a client "retry this". The current design converts a normal outcome into a server error. Separately, every read path (`getAll`, `get`) pays a `BEGIN`/`COMMIT` round trip plus SIREAD predicate-lock bookkeeping for a single `SELECT`.

**Suggestion:** add a bounded, jittered retry for `40001`/`40P01` inside `ResultTransactional` (the one place that owns the transaction boundary), and reconsider the blanket isolation level — the write paths are already guarded by the optimistic-concurrency predicate, so `READ COMMITTED` plus that predicate is the more conventional pairing. If serializable stays, `READ ONLY DEFERRABLE` for pure-read methods is worth having.

**Extracted as an executable plan:** [`task-serialization-failure-conflict.md`](task-serialization-failure-conflict.md) — self-contained, ready for a dedicated session.

**Resolved**, for the first half of this finding. `40001`/`40P01` are now recognized by `isTransientTransactionError` (`src/infrastructure/persistence/error/is-transient-transaction-error.ts`) and translated, at the transaction boundary inside `ResultTransactional`, into a thrown `TransactionConflictError`, which `DomainErrorsExceptionFilter` maps to `409 Conflict` instead of falling through to `UnexpectedPersistenceError` → `500` — the same treatment this API already gives its two other conflict types. No retry was added; a `409` gets the caller the same honest signal without forcing a new invariant onto every `@ResultTransactional()` method. See [ADR 005](005-transaction-conflict-response.md). **The second half of this finding is still open**: every read path still pays for `SERIALIZABLE` isolation's round trip and SIREAD predicate-lock bookkeeping, and whether the blanket isolation level itself should change is deliberately undecided — ADR 005 records dropping to `READ COMMITTED` as a live follow-up option, not a rejected one.

### 3. `util` is where the layer boundary gets circumvented — and it costs the whole application layer its unit tests

`AGENTS.md` § Architecture states Util may import "Nothing from other layers", and the dependency-cruiser rule `util-must-not-import-*` enforces exactly that for internal paths. But `src/util/result-transactional.decorator.ts` imports `TransactionHost` from `@nestjs-cls/transactional` and the pg-promise adapter type, and every application service imports it. So the application layer does depend on the persistence transaction machinery — just via a layer that is declared dependency-free and through an external package the rules do not inspect.

The concrete cost is already written down as a "Known gap" in `.claude/skills/writing-tests/unit-tests.md`: the decorator calls the **static** `TransactionHost.getInstance()`, a global service locator, so constructing a service with mocked collaborators throws `TransactionHost not initialized`. There are zero unit tests for any application service as a result, and `vitest.config.ts` demands 100 % branch coverage for `src/application/**` — satisfied only indirectly through controller integration tests. The skill records the symptom; the cause is that a persistence concern was placed in `util` and reaches its dependency through a global rather than through DI.

**Suggestion:** make the transaction boundary an injected collaborator. Either define an application-layer port (`ITransactionRunner` with `run<T, E>(fn): ResultAsync<T, E>`) implemented in infrastructure, or keep the decorator but resolve `TransactionHost` through DI (a Nest interceptor or an explicitly injected host) so tests can supply `@nestjs-cls/transactional`'s `NoOpTransactionalAdapter`. Independently, move `unwrap-result.decorator.ts` to `src/presentation/http/` — it is purely an HTTP adapter and nothing else uses it — and add a dependency-cruiser rule pinning which **external** packages each layer may import, so the next instance of this is caught mechanically.

### 4. No index on any foreign-key column

The three migrations create eleven constraints and zero indexes. PostgreSQL indexes the _referenced_ side automatically but never the _referencing_ side:

| Column                                      | Consequence                                                    |
| ------------------------------------------- | -------------------------------------------------------------- |
| `users.team_id`                             | `view_teams_with_members` join, and every `DELETE` of a team   |
| `examples_to_skills.example_id`             | not the leading PK column → `ON DELETE RESTRICT` on `examples` |
| `skills_to_teams_with_proficiency.skill_id` | not the leading PK column → `ON DELETE RESTRICT` on `skills`   |
| `examples.example_kind_id`                  | `ON DELETE RESTRICT` on `example_kinds`                        |

Each of those is a sequential scan today. The `RESTRICT` checks are what raise `SkillInUseError` / `ExampleInUseError` / `TeamInUseError`, so this is on the hot path of every delete.

**Suggestion:** one migration adding four explicitly-named indexes. The `database-changes` skill already mandates explicit names for keys and constraints; extend that rule to cover "every FK referencing column gets an index" so new slices don't repeat it.

**Extracted as an executable plan:** [`task-foreign-key-indexes.md`](task-foreign-key-indexes.md) — self-contained, ready for a dedicated session.

**Resolved.** Four indexes were added across the three existing migrations: `users_team_id_idx` in `migrations/20260728150000000_users_and_teams.sql`; `examples_example_kind_id_idx` and `examples_to_skills_example_id_idx` in `migrations/20260728160000000_skills_and_examples.sql`; and `skills_to_teams_with_proficiency_skill_id_idx` in `migrations/20260729000000000_skills_to_team_proficiencies.sql`. Each index was proven usable by its `ON DELETE RESTRICT` predicate under `SET enable_seqscan = off`. The `database-changes` skill, `adding-a-repository.md`, and `migrations.md` now state the rule — every FK referencing column gets an index, named `<table>_<column>_idx`, except one that is already the leading column of a composite primary key — so new slices don't repeat the gap.

### 5. The composition root exists twice

`test/integration/fixture/setup-integration-test.ts` re-declares, by hand, what `src/module/main.module.ts` wires: `APP_PIPE`/`APP_FILTER`/`APP_INTERCEPTOR` and the `ClsPluginTransactional` registration — including a second, literal copy of the serializable transaction mode instead of importing `DEFAULT_TX_OPTIONS`.

Integration tests are the _only_ coverage for controllers and repositories (by design, per the `writing-tests` skill), which means they must exercise the production wiring. As it stands, adding a global interceptor, changing the isolation level, or swapping the validation pipe changes production behaviour while the tests keep validating the old arrangement, and nothing fails.

**Suggestion:** extract the shared wiring into modules imported by both — e.g. a `CoreHttpModule` providing the three globals and a `TransactionalModule` owning the CLS plugin and `DEFAULT_TX_OPTIONS`. The harness then composes production modules plus test overrides rather than reimplementing them.

**Extracted as an executable plan:** [`task-shared-composition-root.md`](task-shared-composition-root.md) — self-contained, ready for a dedicated session.

**Resolved.** The plan above has been executed: the shared wiring now lives in two modules imported by both `MainModule` and the integration-test harness: `TransactionalModule` (`src/module/transactional.module.ts`) owns the CLS plugin and `DEFAULT_TX_OPTIONS`, and `HttpCoreModule` (`src/module/http-core.module.ts`) provides `APP_PIPE`/`APP_FILTER`/`APP_INTERCEPTOR`. The harness's only remaining bespoke wiring is a silent logger swapped in for `LoggingModule`, with a comment explaining why.

---

## Significant

### 6. Service inputs and response DTOs are both projections of the domain model

Every DTO schema is derived from its domain schema (`<entity>Schema.pick({...})` in `user.dto.ts`, `skill.dto.ts`, `example.dto.ts`, `team-skill-proficiencies.dto.ts`), and the response schema _is_ the request schema (`skillDTOSchema = updateSkillDTOSchema.brand('skill-dto')`).

Deriving the _validation_ is defensible and probably right: `.pick()` is an explicit allowlist, so a new domain field is never silently exposed, and restating `z.email()` / `.min(1)` in the DTO layer would let the two drift — at which point the boundary accepts input that `new User(...)` rejects, and `InvalidUserError` is not one of the errors `DomainErrorsExceptionFilter` handles, so a bad request becomes a `500` instead of a `400`. What is worth changing is narrower:

- **`AGENTS.md` promises a converter that cannot exist.** § Architecture says "Explicit `toDomain()` / `fromDomain()` converters live in the DTO file", but there is no `toDomain()` in `src/presentation` and there is nowhere to put one — the application layer constructs entities because it owns ID generation (`uuidProvider.generate()` inside every `create`).
- **The converter does exist, scattered.** `users`, `teams`, `examples` and `example-kinds` pass the DTO straight to the service; `skills` builds `{ name, description, exampleIds: new Set(dto.exampleIds) }` inline in the controller, and `team-skill-proficiencies` spreads `{ ...dto, teamId, skillId }`. The two slices whose wire shape genuinely differs from the domain shape map by hand, in the controller rather than in the DTO file that is supposed to own it.
- **Domain `Properties` is the cross-layer currency.** Services take `Except<Properties, 'id'>` and `SetRequired<Partial<Properties>, 'id'>`, so a domain rename propagates through the application boundary too, and the partial-shaped update signature advertises PATCH support the API does not offer (finding 8).
- **Request and response share one schema**, so no response-only field (`version`, `lastUpdated`, a computed count) can be added without splitting them first.

**Suggestion:** move the two inline mappings out of `skills.controller.ts` and `team-skill-proficiencies.controller.ts` into their DTO files, which `AGENTS.md` already designates as the home for mappers, and split the response schema from the request schema if and when a response-only field is needed. Deriving DTO validation from the domain schema, and keeping `.meta()` on the domain schemas, are now recorded as deliberate decisions in [ADR 004 – DTO Construction](004-dto-construction.md). Finding 8 covers the partial-shaped update signature separately.

Not a finding: `.meta({ description, example })` on domain schemas is entity documentation that OpenAPI happens to consume — structured JSDoc, which would still belong there if the HTTP layer were removed. The one genuinely OpenAPI-specific keyword, `uniqueItems`, already sits in `skill.dto.ts`. The only residue is that the same DTO restates the domain's `exampleIds` description verbatim, forced by the array-vs-`Set` difference.

### 7. Branded IDs are asserted at the HTTP boundary, not validated

Every controller binds `@Param('id', new ParseUUIDPipe({ version: '4' })) id: SkillID`. `ParseUUIDPipe` returns a `string` and checks only UUID-ness; the declared parameter type asserts the brand. So `skillIdSchema`'s entity-marker refinement and `idSchema`'s lowercase normalization never run on inbound path parameters, and a `SkillID`-typed value reaches the service and the SQL layer without the validation its brand claims. The brand is load-bearing everywhere else in the codebase; here it is a lie.

**Resolved in part:** the entity-marker refinement itself was removed from every `*IdSchema` — there is no more marker check anywhere in the codebase, so this finding's marker-mismatch angle no longer applies. The rest of the finding still stands: `idSchema`'s lowercase normalization still never runs on inbound path parameters, and the `@Param(..., id: SkillID)` annotation still asserts the brand rather than validating through the schema. The original suggestion remains open:

**Suggestion:** a single `ZodPipe(schema)` (or `createParamDecorator`) used for every ID binding, so the same schema validates inbound IDs, DB rows, and domain construction.

### 8. `update` reads before writing for no benefit

All five read-modify-write `*.service.update()` methods (`user`, `team`, `skill`, `example`, `example-kind` — `team-skill-proficiencies` is already complete-input) do `repository.get(id)` → `existing.update(properties)` → `repository.update(...)`. But the update DTOs are complete (`.pick({ id, name, ... }).strict()`, all fields required — PUT, not PATCH), and the `WITH current_row ... LEFT JOIN updated_row` CTE already distinguishes "no such row" from "stale token" on its own. The extra `SELECT` adds a round trip and buys nothing.

The signature `SetRequired<Partial<Properties>, 'id'>` is what invites it — it advertises partial-update support that no endpoint offers.

**Suggestion:** have services accept the complete `Properties` and drop the read. If PATCH is wanted later, add it as its own method with its own semantics rather than leaving every PUT paying for it.

### 9. `team-skill-proficiencies` diverges from every sibling slice

Four divergences in one slice, none explained by the domain:

- **No concurrency control.** No `last_updated`, no ETag, no `If-Match` — it is the one mutable resource with no lost-update protection, while `team`, `skill`, `example` and `example-kind` all have it.
- **`POST /teams/:teamId/skill-proficiencies/:skillId`.** POSTing to a fully-specified resource identity is non-idempotent for an operation that is naturally "set this team's proficiency for this skill". `PUT` would collapse `add` and `update` and make `DuplicateTeamSkillProficienciesError` unnecessary.
- **`DELETE` returns `200` plus the whole collection** where every other delete returns `204`.
- **The controller rewrites domain errors.** `add()` maps `SkillReferenceNotFoundError` → `SkillNotFoundError` and `TeamReferenceNotFoundError` → `TeamNotFoundError` purely to steer the status code. `AGENTS.md` says controllers "serve exclusively as an adapter from HTTP to the application layer"; synthesizing domain errors is the presentation layer reaching back into the domain vocabulary to work around a mapping table it doesn't own.

**Suggestion:** `PUT`/`DELETE` on the sub-resource with a concurrency token, and move the status decision into `DomainErrorsExceptionFilter` — e.g. let a route opt into "reference-not-found means 404 here" instead of constructing a different domain error.

### 10. `users` has no optimistic concurrency

No `last_updated` column, no ETag on `GET /users/:id`, no `If-Match` on `PUT`/`DELETE` — the only slice besides the one above without it, and `UserModule` is correspondingly the only feature module that doesn't import `UtilityModule`. Either extend it (the mechanism is cross-cutting by ADR 003's own framing) or record why users are exempt.

### 11. The ETag mechanism is half-wired

- The contract between `@ETagResponse()` and the handler's return type is unenforced. `getOne` declares `ResultAsync<WithConcurrencyToken<SkillDTO>, …>`, which is _not_ the response body — `ETagInterceptor` unwraps it. Forget the decorator and the `{ value, token }` wrapper is serialized to the client; the `@ApiResponse({ type: SkillDTO })` annotation that documents the real body is maintained by hand.
- No `If-None-Match` handling and no `Cache-Control` anywhere, so ETags serve only the write path. Conditional GET is the cheaper half of what the infrastructure already makes possible.
- Collection endpoints emit no ETag at all.

**Suggestion:** have the interceptor derive its OpenAPI response type, or replace the wrapper with a typed `ETagged<T>` response class that cannot be returned without the interceptor; then add `If-None-Match` → `304`.

### 12. dependency-cruiser is missing its highest-value rules

`.dependency-cruiser.cjs` has seven well-targeted layer rules and none of the standard structural ones — no `no-circular`, no `no-orphans`, no `not-to-dev-dep`, and no allowlist of permitted external packages per layer. Import cycles are currently undetected, and nothing prevents `@nestjs/common` or `pg-promise` from being imported into `src/domain` (which is the gap finding 3 walks through).

**Resolved.** The config now adds `no-circular`, `no-orphans`, `not-to-dev-dep` and per-layer external allowlists for the two layers `AGENTS.md` declares free of other layers (`domain-may-only-import-approved-externals`, `util-may-only-import-approved-externals`), plus `doNotFollow: node_modules` so cycles inside third-party type declarations are not reported as ours. Each new rule was verified to fail on an injected violation before being trusted.

`no-circular` immediately surfaced seven real cycles: every `invalid-<entity>.error.ts` imported its entity solely to pass `<Entity>.name` to `super()`, while the entity imported the error. They now pass the name as a literal. Nothing depended on the cycle at runtime — the reference was inside a constructor body, not at module scope — but it would have broken the first time someone hoisted it.

Two residuals worth knowing. dependency-cruiser 18 supports `typescript >=2 <7` and this project is on `typescript@7`, so `dependencyTypesNot: ['type-only']` (which needs `tsPreCompilationDeps`, which needs that compiler) is unavailable; the type-only devDependency imports are allowlisted by hand instead and the rule can be tightened when the version gap closes. And `express` is one of those allowlisted entries because `etag.interceptor.ts` and `if-match-header.decorator.ts` import `Request`/`Response` from it while it is not a declared dependency — it arrives transitively through `@nestjs/platform-express`, with only `@types/express` declared. Type-only, so harmless at runtime, but it is a package the project uses without saying so.

### 13. ~150 lines of duplicated OpenAPI decorators per controller

The `@ApiResponse` blocks for `400`/`404`/`409`/`412`/`422`/`428`/`500`, the `@ApiHeader({ name: 'If-Match' })` block, and the ETag response-header block are copy-pasted across all six controllers — the give-away being the identical double-space typo `'... is missing,  malformed ...'` in every one of them. This is the single largest block of duplication in the codebase.

**Suggestion:** composed decorators via `applyDecorators` — `@ApiStandardErrors()`, `@ApiETagResponse(Dto)`, `@ApiIfMatch()`, `@ApiConcurrencyErrors()`. Controllers then read as their routes rather than their annotations.

### 14. No pagination, and one collection has no defined order

Every `getAll` returns an unbounded array with no `limit`/`offset`/cursor — no SQL file in the repo contains `LIMIT`. Additionally `skill/sql/get-all.sql` has no `ORDER BY` (it selects from `view_skills_with_examples`, whose `GROUP BY` order is an implementation detail), while `user`, `team` and `example` all sort by `id`. List order for skills is unspecified, which is why `test/util/sort-by-id.ts` has to exist.

### 15. Operational configuration gaps

No connection-pool sizing, and no `statement_timeout`, `idle_in_transaction_session_timeout`, or `connect_timeout` — notable given every request opens a serializable transaction (finding 2), where one stuck transaction holds predicate locks. Also: no request body size limit, no API versioning or global path prefix (so there is no forward path for a breaking change), and `custom-environment-variables.json` maps only the database connection and server host/port — `openApi.server`, `logging.level`, and `swagger.enabled` cannot be set per environment despite being exactly the values that differ per environment.

### 16. The OpenAPI document advertises authentication that doesn't exist

`openapi.create-document.ts` calls `.addBearerAuth().addSecurityRequirements('bearer')`, so the published spec declares every operation as requiring a bearer token. No guard, strategy, or middleware exists. The generated `docs/openapi.json` — the artifact CI publishes to Pages — therefore documents a contract the server does not implement. Remove it, or make it real.

---

## Minor

- **Dead schema.** `view_teams_with_members` is created and dropped in `migrations/20260728150000000_users_and_teams.sql` and never queried; `Team` has no `memberIds` field. It also omits `last_updated`, so it couldn't back a token-carrying `get` as written. Drop it or use it.
- **`error-codes.ts` is ~400 lines for four constants in use** (`UNIQUE_VIOLATION`, `RESTRICT_VIOLATION`, `FOREIGN_KEY_VIOLATION`, `UNDEFINED_TABLE`). Trim to what's referenced — plus the two retry codes from finding 2 — or generate it from the PostgreSQL source rather than hand-maintaining a copy.
- **Value-object boilerplate is copy-pasted eight times.** `#brand = Symbol.for(...)`, the `safeParse`-or-throw constructor, field-by-field assignment, `update()`, and `toJSON()` are structurally identical in `User`, `Team`, `Skill`, `Example`, `ExampleKind`, `SkillProficiency`, `TeamSkillProficiencies`. A `defineValueObject(schema, InvalidXError)` factory would collapse it and give a natural home for the `equals()` that no value object currently has.
- **Near-identical row schemas.** `skillUpdateRow` and `skillDeleteRow` are byte-for-byte the same union, and the pattern repeats in `team`, `example` and `example-kind`. One shared `deletedOrStaleRow(idSchema)` helper covers all eight.
- **`createDatabaseConfig` hand-duplicates its own Zod input type** and is the only exported function in the codebase without an explicit return type — `z.input<typeof databaseConfig>` removes both problems.
- **Health check verifies nothing** (`this.health.check([])`), and `docker/Dockerfile`'s `HEALTHCHECK` polls it. A container whose database is unreachable reports healthy, and the app's own `PendingMigrationsChecker`/`ConnectionProvider` guards only run at boot. Splitting `/health/live` from `/health/ready` (with a DB ping on the latter) is the conventional fix; the existing comment justifies the simplicity, not the conflation.
- **Naming drift for one concept across layers:** table `skills_to_teams_with_proficiency`, view `view_team_skill_proficiencies`, domain `TeamSkillProficiencies`, route `teams/:teamId/skill-proficiencies`. Its `CHECK` constraint is also the one constraint that breaks its table's naming pattern (`skills_to_teams_proficiency_check`, missing `_with_proficiency`).
- **The 0–4 proficiency range is encoded twice** — `proficiencySchema`'s `.min(0).max(4)` and the SQL `CHECK (proficiency BETWEEN 0 AND 4)` — with nothing tying them together. Same class of drift risk the concurrency-token parity test was written to cover; worth an equivalent test or a comment cross-referencing both sites.
- **`ITimeProvider.highResolutionTimestamp()` is unused** (defined, mocked, implemented, never called).
- **`test.ts` at the repo root** is a leftover scratchpad containing only three `biome-ignore` comments.
- **`config/default.jsonc` ships `username: ""` / `password: ""`, which its own schema rejects** (`min(1)`). Fail-fast is right, but the failure surfaces as a Zod error on a default value rather than "DATABASE_PASSWORD is not set". A `.min(1, 'DATABASE_PASSWORD must be set')` message, or omitting the keys, reads better at 3 a.m.
- **`create()` discards its `RETURNING` row and re-reads.** `SkillRepository.create()` inserts with `RETURNING id, name, description, last_updated`, ignores the result, then calls `this.get(id)` — three statements where two suffice. The re-read is genuinely needed for the aggregated `example_ids`, but the `RETURNING` clause is then pointless and should be trimmed to `RETURNING id` (or dropped) so it doesn't read as load-bearing.

---

## Documentation drift

Listed separately because these files are what agents follow, so drift here reproduces itself as code.

- **`database-changes/SKILL.md` and `adding-a-repository.md` still teach the pre-`Result` idiom.** Repository interfaces shown as `Promise<Widget>`; `throw new WidgetNotFoundError(id)`; every query wrapped in `try`/`catch`; `@Transactional()` rather than `@ResultTransactional()`; and a "**`get*` throws, `find*` returns `null`**" non-negotiable rule. The codebase has no `find*` method anywhere and no repository throws a domain error. Followed verbatim, this guide produces code that violates `AGENTS.md` § Error handling — and it is labelled the canonical worked example.
- **`writing-tests/integration-tests.md` contradicts the `Result` assertion pattern**: "Assert error cases throw the domain error (`*NotFoundError`, `Duplicate*Error`)", where `AGENTS.md` and the parent `SKILL.md` require asserting on the resolved `Result`.
- **Nothing documents the concurrency-token requirements for a new entity.** Neither `adding-a-repository.md` nor `AGENTS.md` mentions the `last_updated` column, the `concurrency_token()` predicate, the `WithConcurrencyToken` return shape, or `@ETagResponse()`/`@IfMatchHeader()`. A new slice built by following the guide will silently ship without optimistic concurrency — which is plausibly how findings 9 and 10 happened.
- **`AGENTS.md` § Architecture describes `util` as importing "nothing from other layers"**, which is true of internal imports and misleading about what actually lives there (see finding 3). It also omits the concurrency/ETag layer entirely, despite that being the newest cross-cutting mechanism in the codebase.

---

## Suggested order

1. Findings 1 and 2 — both are correctness under concurrency, and both touch the same write path, so they are cheaper to fix together than apart.
2. Finding 4 — one migration, no code change.
3. Finding 3 — this unblocks unit-testing the application layer.
4. The documentation drift section — cheap, and it stops findings 9 and 10 from recurring in the next slice.
5. Findings 6–16 as capacity allows; 13 and 14 are the lowest-risk visible wins.
