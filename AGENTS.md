# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands

```bash
# Development
npm start                     # Run with jiti (TypeScript, development conditions)
npm run build                 # Compile TypeScript + copy configs + copy SQL files

# Testing
npm run test                  # Run all tests and linting tasks.
npm run vitest:unit           # Unit tests only (src/**/*.test.ts)
npm run vitest:integration    # Integration tests (test/integration/**/*.test.ts)
npm run vitest:with-coverage  # Full coverage report
npm run vitest                # All test categories

# Running a single test file
npx vitest run path/to/file.test.ts

# Lint & Format
npm run lint                  # Full lint suite (tsc + architecture + biome + knip + sql + lockfile + package.json)
npm run lint:architecture     # Clean Architecture import-boundary check (dependency-cruiser)
npm run format                # Format everything (biome + package.json + sql)

# OpenAPI docs
npm run openapi               # Build, generate HTML, and validate spec
```

## Architecture

This is a NestJS application following **Clean Architecture**, enforced by [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) (`.dependency-cruiser.cjs`, run via `npm run lint:architecture`). The layers and their purpose and import rules:

| Layer | Location | Purpose | May import |
| --- | --- | --- | --- |
| **Domain** | `src/domain/` | Core business logic and immutable domain objects | Nothing from other layers except for Util |
| **Application** | `src/application/` | Services that span multiple business domains | Domain only |
| **Infrastructure** | `src/infrastructure/` | Output boundaries (e.g., database and external services) | Domain + Application interfaces/errors |
| **Presentation** | `src/presentation/` | Use-case input boundaries (e.g. controllers, CLI) | Domain + Application interfaces/errors |
| **Module** | `src/module/` | Nest.js modules for organizing functionality into reusable modules | Anything (orchestration layer) |
| **Util** | `src/util/` | Standalone utility functions not related to any business domain. | Nothing from other layers |

See [Imports](#imports) for how imports between and within layers are handled.

### Request flow

```
HTTP → Controller (presentation) → Domain interface → Repository impl (infrastructure) → PostgreSQL
```

DTOs are validated at the boundary with Zod (`nestjs-zod`). Domain objects are immutable Zod-validated value objects. Explicit `toDomain()` / `fromDomain()` converters live in the DTO file.

### Key patterns

- **Repositories:** Abstract class in `src/domain/*/` defines the interface; concrete implementation in `src/infrastructure/persistence/*/`.
- **Persistence:** For any database change — repositories, SQL query files, row mapping, transactions, PostgreSQL error handling, or migrations — use the `database-changes` skill (`.claude/skills/database-changes/`). It carries the full rules and conventions.
- **Config:** Node-Config (`config/`) with Zod-validated schemas in `src/infrastructure/config/`
- **Logging:** Pino via `nestjs-pino`; no `console.*` allowed (Biome enforces this)
- **Controllers:** Controllers never contain business logic. They serve exclusively as an adapter from HTTP to the application layer (or in trivial cases the domain layer). All business logic must be in application services.

### Error handling

Errors split into two channels, chosen by whether the caller is expected to handle the failure:

- **Expected domain errors** — not-found, duplicate, still-in-use, missing-reference, and similar — are returned as values using [`neverthrow`](https://github.com/supermacro/neverthrow)'s `Result`/`ResultAsync`, never thrown. This applies across the entire call chain: repository → service → controller.
- **Unexpected errors** — bugs, infrastructure failures — are still thrown as `Error` subclasses and propagate as rejections/exceptions, exactly as before this pattern existed.

Never throw a concrete domain error (`EntityNotFoundError`, `DuplicateEntityError`, `EntityInUseError`, `EntityReferenceNotFoundError`, or any subclass) from a repository or service method — return it as an `Err` instead. This pattern is applied uniformly across every domain (`user`, `skill`, `example`, `kind`, `team`, `team-skill-proficiencies`).

Concrete shape, layer by layer:

- **Repository interfaces** (`src/domain/*/*.repository.interface.ts`, abstract classes): every method returns `ResultAsync<T, E>`. Methods with no failure case still return `ResultAsync<T, never>` rather than `Promise<T>` — this keeps every method eligible for the same decorator below, so there is nothing to remember per-method.
- **Repository implementations** (`src/infrastructure/persistence/*/`): decorated with `@ResultTransactional()` only when a single repository method issues more than one DB statement that must succeed or fail together (e.g. an insert followed by writing associated rows) — this guarantees the method is safe on its own, even if it's ever called from something other than a service. A method that issues a single DB statement needs no decorator. Each method wraps its DB call(s) as `ResultAsync.fromPromise(promise, errorMapper)`. The `errorMapper` inspects the underlying `pg-promise` error — via `isUniqueConstraintViolation`/`isForeignKeyViolation`/`isRestrictViolation` — and `return`s a domain error instance to produce an `Err`; anything unrecognized is `throw`n as `UnexpectedPersistenceError`, which stays a genuine rejection, not an `Err`. Row-not-found (`oneOrNone` returning `null`) becomes `.andThen(row => row === null ? errAsync(new XNotFoundError(id)) : okAsync(...))`.
- **Application services** (`src/application/*/`): compose repository calls with `.andThen(...)`/`.map(...)` combinators — no manual `await`/`try`/`catch`. Every public method is decorated with `@ResultTransactional()` (`src/util/result-transactional.decorator.ts`) instead of `@Transactional()`, including methods that make only a single repository call, for the same uniformity reason as above. The service-level transaction guarantees atomicity across multiple repository calls (or calls spanning multiple repositories) within one method — it composes correctly with any repository-level `@ResultTransactional()` from the point above, since a transaction already open in scope is reused rather than nested. `@ResultTransactional()` still runs the method inside a real DB transaction, but — unlike plain `@Transactional()` — it forces a genuine `ROLLBACK` when the wrapped method resolves `Err`, even if an earlier write in the same call already succeeded (a resolved `Err` is not a rejection, so plain `@Transactional()` would otherwise happily commit it). Never use plain `@Transactional()` on a method returning a `ResultAsync`, at either layer.
- **Controllers** (`src/presentation/http/*/`): handler methods return `ResultAsync<Dto, E>` directly (instead of `Promise<Dto>`) and are additionally decorated with `@UnwrapResult()` (`src/util/unwrap-result.decorator.ts`), which awaits the result and either returns the `Ok` value or `throw`s the `Err` value — so the existing `DomainErrorsExceptionFilter` maps it to an HTTP status exactly as it would a direct throw, with no filter changes needed. Ideally, handler bodies should be one-liners, e.g. `return this.service.get(id).map(fromDomain)`.
- **Tests**: integration tests assert on the resolved `Result` with `._unsafeUnwrap()` / `._unsafeUnwrapErr()` instead of `.resolves.toEqual(...)` / `.rejects.toThrow(SomeExpectedError)`. Genuinely unexpected errors (`UnexpectedPersistenceError`) still assert with `.rejects.toThrow(...)`, since those remain real rejections rather than `Err` values. Controller integration tests need no changes — HTTP status/body behavior is identical whether an error was thrown directly or unwrapped from a `Result`.

### Code Conventions

- Prefer functional style over imperative style, e.g. using `.map()`, `.reduce()`, and `.filter()` over `for` loops.
- Always prefer nullable types (`foo: number | null`) over optional types (`foo: number?`) except for optional parameters.
- Always prefer Dayjs instances to native Date objects. Architecturally, don't consider Dayjs an external dependency but a pure domain object.
- Only `throw` instances of `Error` (or one of its subclasses).
- Do not use TypeScript's `enum` keyword. Instead, use `export const ENUM = { KEY: 'key' } as const` and export the type like so: `export type Enum = (typeof ENUM)[keyof typeof ENUM]`. The name of the keys are always in SCREAMING_SNAKE_CASE, the value are lower-kebab-cased.
- All services and repositories must have an explicit interface definition as an abstract class. This abstract class doubles as the injection token for dependency injection. For example, a service named PaymentService must implement an IPaymentService interface defined as an abstract IPaymentService class. Implementations implement their corresponding interfaces, they do not extend them.

### Testing

For anything test-related — what to test, unit tests, integration tests, mocks, and builders — use the `writing-tests` skill (`.claude/skills/writing-tests/`). It carries the full conventions.

### Version control

This repository uses Conventional Commits.

### File naming conventions

All files use `kebab-case`. Suffix determines role:

- `*.controller.ts` — HTTP handlers
- `*.dto.ts` — request/response shapes + mappers
- `*.error.ts` — custom error classes
- `*.interface.ts` — abstract classes used as injection tokens
- `*.mock.ts` — test fakes (excluded from production build)
- `*.module.ts` — NestJS DI modules
- `*.test.ts` — test files

### No barrel files

Biome enforces `noBarrelFile: error` — do not create `index.ts` re-export files.

## Imports

Whether an import uses an absolute or relative path depends on whether it crosses a layer boundary:

- **Across layers — use absolute paths** via the `#/*` subpath alias (maps to `./src/*`). For example, code in `src/presentation` importing from `src/domain` uses `#/domain/...`. Never use relative paths (`../../domain/...`) to reach into another layer.
- **Within the same layer — use relative paths.** For example, a file importing a sibling in the same layer uses `../something.js`.
- **Use `type` where possible.** If an import is only used as a type, use the `type` keyword. If it is a singular import, prefer `import type { Foo }` over `import { type Foo }`.

Because the build is ESM-first, always use `.js` extensions in import specifiers, even for `.ts` source files. Always check compliance with these rules as part of validation runs.

- **Mocks are only ever imported from the `#/mocks.js` barrel** — never import a `*.mock.ts` file directly. (`src/mocks.ts` is the one sanctioned barrel; regular barrel files are forbidden.)

## Toolchain notes

- **Biome** replaces ESLint + Prettier. Run `npm run format:biome` to auto-fix formatting, `npm run lint:biome` to lint.
- **Knip** detects unused exports/dependencies — `npm run lint:knip`.
- **dependency-cruiser** enforces the Clean Architecture import boundaries — `npm run lint:architecture`. Rules live in `.dependency-cruiser.cjs`.
- **Integration tests** use Testcontainers (real PostgreSQL). They require Docker. See the `writing-tests` skill for test conventions (and the `database-changes` skill for repository/persistence specifics).
- **Build** is ESM-first (`"type": "module"` in package.json). Use `.js` extensions in imports even for `.ts` source files.
- The `development` import condition is active during `npm start`; the `dist` condition is active in production.
