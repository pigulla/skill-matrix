# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands

```bash
# Development
npm start                   # Run with jiti (TypeScript, development conditions)
npm run build               # Compile TypeScript + copy configs + copy SQL files

# Testing
npm run test                # Run all tests and linting tasks.
npm run vitest:unit         # Unit tests only (src/**/*.test.ts)
npm run vitest:integration  # Integration tests (test/integration/**/*.test.ts)
npm run vitest:architecture # Architecture enforcement tests
npm run vitest:coverage     # Full coverage report (excludes architecture tests)
npm run vitest              # All test categories

# Running a single test file
npx vitest run path/to/file.test.ts

# Lint & Format
npm run lint                # Full lint suite (tsc + biome + knip + sql + lockfile + package.json)
npm run format              # Format everything (biome + package.json + sql)

# OpenAPI docs
npm run openapi             # Build, generate HTML, and validate spec
```

## Architecture

This is a NestJS application following **Clean Architecture**, enforced by TSArch tests. The layers and their purpose and import rules:

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
- **Integration tests** use Testcontainers (real PostgreSQL). They require Docker. See the `writing-tests` skill for test conventions (and the `database-changes` skill for repository/persistence specifics).
- **Build** is ESM-first (`"type": "module"` in package.json). Use `.js` extensions in imports even for `.ts` source files.
- The `development` import condition is active during `npm start`; the `dist` condition is active in production.
