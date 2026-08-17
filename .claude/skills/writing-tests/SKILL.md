---
name: writing-tests
description: Use when writing, modifying, or reviewing tests in this repo — adding a *.test.ts file, creating or using mocks (*.mock.ts, #/mocks.js) or builders, and deciding what to test. Covers Vitest unit tests (src/**/*.test.ts) and integration tests (test/integration/**), NestJS TestingModule, supertest, and Testcontainers.
model: sonnet
effort: medium
paths:
    - src/**/*.test.ts
    - test/**/*
---

# Writing Tests

## Overview

Tests run on **Vitest**. There are two categories, each with its own location and command:

| Category | Location | Command | What it covers |
| --- | --- | --- | --- |
| Unit | `src/**/*.test.ts` (colocated with source) | `npm run vitest:unit` | Logic in isolation, collaborators mocked |
| Integration | `test/integration/**/*.test.ts` | `npm run vitest:integration` | Real wiring against a real PostgreSQL (Testcontainers): HTTP via supertest (real service + real repository) or a repository in isolation |

Run everything with `npm run vitest`; a single file with `npx vitest run path/to/file.test.ts`.

Clean-architecture import rules are enforced separately, as a lint check rather than a Vitest test — see `npm run lint:architecture` (`.dependency-cruiser.cjs`, documented in [AGENTS.md](../../../AGENTS.md#architecture)).

## General rules (apply to all tests)

- **Don't test what has no logic.** Domain objects are immutable Zod-validated value objects with no behavior — do not write tests for them. Do not write tests for mocks either. Controllers and repositories are integration-tested only (no unit tests), against a real database — never with a mocked service or a mocked repository.
- **Import test globals explicitly** from `vitest` (`describe`, `it`, `expect`, `beforeEach`, …). Globals are not enabled.
- **Never reuse a mock across test cases.** Create a fresh instance for every test — typically in a `beforeEach` (see the controller test) — so state never leaks between cases.
- **Build domain objects with builders,** not by hand. Fluent builders live in `test/builder/` (e.g. `UserBuilder.create({...})`, `UserBuilder.from(user).withEmail(...).build()`).
- **Assert `Result`-returning calls by checking the whole `Result`, not by `.resolves`/`.rejects`.** Most repository/service methods return `ResultAsync<T, E>` (see `AGENTS.md` § Error handling) — `await` it to get a `Result`. Default to asserting it in one go: `expect(result).toEqual(ok(value))` (success) or `expect(result).toEqual(err(new XError(...)))` (expected domain error), both from `neverthrow`. Unwrap instead — `expect(result.isOk()).toBe(true)` then `expect((result as Ok<unknown, unknown>).value).to...` (or `result.isErr()` / `Err<unknown, unknown>` for the error case) — only when that lets the assertion use something `toEqual` can't express as concisely, e.g. `.to.have.deep.members(...)` for an array with no guaranteed order (such as a `getAll()` result). Configure a mocked collaborator's return value with `okAsync(...)`/`errAsync(...)`, not `mockResolvedValue`/`mockRejectedValue`. Reserve `await expect(fn()).resolves.toEqual(...)` / `.rejects.toThrow(SomeError)` for code that genuinely still throws — unexpected errors (e.g. `UnexpectedPersistenceError`) and any non-`Result` API. Use `it.each` for table-driven cases and `toHaveBeenCalledExactlyOnceWith(...)` to assert collaborator calls.

## The mock pattern

Each mockable interface has a sibling `*.mock.ts` exposing a typed factory. Re-export every factory from `src/mocks.ts` so tests can reach it via `#/mocks.js` — if the mock you need isn't in the barrel yet, add its export there. `*.mock.ts` files are test fakes excluded from the production build and coverage.

```ts
import { type Mocked, vi } from "vitest";
import type { IUserRepository } from "./user.repository.interface.js";

export type UserRepositoryMock = Mocked<IUserRepository>;

export function mockUserRepository(): UserRepositoryMock {
    return {
        create: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
        update: vi.fn(),
    };
}
```

## Deeper guides (load only when needed)

- Unit tests (isolation, mocking collaborators) → [unit-tests.md](unit-tests.md)
- Integration tests (HTTP via supertest, DB via Testcontainers) → [integration-tests.md](integration-tests.md)

## Common mistakes

- Writing tests for domain value objects or for mocks.
- Mocking the application service (or repository) in a controller integration test instead of booting the real feature module against the real Testcontainers database.
- Sharing one mock instance across test cases instead of recreating it per test.
- Constructing domain objects inline instead of using a builder from `test/builder/`.
- Putting a unit test under `test/` or an integration test in `src/` (wrong runner picks it up).
- Relying on Vitest globals instead of importing from `vitest`.
