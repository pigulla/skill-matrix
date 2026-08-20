# Skill Matrix

API for managing skill matrices for individual developers and teams.

## Stack

- [NestJS](https://nestjs.com/) on Node.js 26, TypeScript, ESM
- PostgreSQL via [`pg-promise`](https://github.com/vitaly-t/pg-promise) with hand-written SQL (no ORM/query builder) — see [`docs/001-persistence-strategy.md`](docs/001-persistence-strategy.md)
- Validation with [Zod](https://zod.dev/) ([`nestjs-zod`](https://github.com/BenLorantfy/nestjs-zod))
- Structured logging with [Pino](https://getpino.io/) ([`nestjs-pino`](https://github.com/iamolegga/nestjs-pino))

The codebase follows Clean Architecture, enforced by [dependency-cruiser](https://github.com/sverweij/dependency-cruiser). See [AGENTS.md](AGENTS.md#architecture) for the full layering rules and conventions.

## Error handling

Expected domain errors (not found, duplicate, still-in-use, missing reference, etc.) are returned as values using [`neverthrow`](https://github.com/supermacro/neverthrow) `Result`/`ResultAsync`, propagated from repository → service → controller; unexpected errors (bugs, infrastructure failures) are still thrown. See [AGENTS.md](AGENTS.md#error-handling) for the full pattern.

## Decision records

- [001 – Persistence Strategy](docs/001-persistence-strategy.md)
- [002 – Error Handling Strategy](docs/002-error-handling-strategy.md)
- [003 – Concurrency Token Hashing](docs/003-concurrency-token-hashing.md)
- [004 – DTO Construction](docs/004-dto-construction.md)

## Setup

```bash
npm ci
npm run docker:compose-up   # PostgreSQL + migrations + seed data
npm start                   # dev server (jiti, no build step)
```

Tear the stack down with `npm run docker:compose-down`.

## Common tasks

```bash
npm run build       # compile to dist/
npm run test        # lint + full test suite + openapi (regenerates docs/openapi.json|html)
npm run vitest       # unit + integration tests
npm run lint         # tsc + architecture + biome + knip + markdown (prettier) + sql + lockfile + package.json
npm run format       # auto-fix formatting (biome + markdown + package.json + sql)
npm run openapi      # build + render + lint the OpenAPI spec
```

Integration tests use [Testcontainers](https://node.testcontainers.org/) and require Docker.

## Debugging

`npm start` runs `src/index.ts` directly via [jiti](https://github.com/unjs/jiti) — there's no `tsc` build step in the dev loop. jiti transpiles each TypeScript file to JS on the fly (its own transform, not `tsc`) and caches the output under `node_modules/.cache/jiti`; Node actually executes that cached JS, not your `.ts` file.

IDEs set breakpoints against the `.ts` file on disk and rely on the sourcemap jiti attaches to the transpiled output to translate that back to a runtime location. Because jiti's transform doesn't preserve a 1:1 line mapping (decorator/class-field transforms in particular can shift lines), the sourcemap is sometimes slightly off, so a breakpoint can bind to the wrong line or never hit.

For reliable breakpoints, debug against a real `tsc` build instead of the jiti dev loop:

```bash
npm run build:dev
npm run start:dist
```

`tsc` emits accurate sourcemaps alongside `dist/src/index.js`, so breakpoints set in the `.ts` source line up correctly.

## API docs

OpenAPI spec is generated to `docs/openapi.json`/`docs/openapi.html` via `npm run openapi`.
