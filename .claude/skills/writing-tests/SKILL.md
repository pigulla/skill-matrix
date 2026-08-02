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

Tests run on **Vitest**. There are three categories, each with its own location and command:

| Category | Location | Command | What it covers |
| --- | --- | --- | --- |
| Unit | `src/**/*.test.ts` (colocated with source) | `npm run vitest:unit` | Logic in isolation, collaborators mocked |
| Integration | `test/integration/**/*.test.ts` | `npm run vitest:integration` | Real wiring: HTTP (supertest) or real PostgreSQL (Testcontainers) |
| Architecture | `test/architecture/` | `npm run vitest:architecture` | Clean-architecture import rules (TSArch, driven by `rules.json`) |

Run everything with `npm run vitest`; a single file with `npx vitest run path/to/file.test.ts`.

## General rules (apply to all tests)

- **Don't test what has no logic.** Domain objects are immutable Zod-validated value objects with no behavior — do not write tests for them. Do not write tests for mocks either. Controllers are integration-tested only (no unit tests).
- **Import test globals explicitly** from `vitest` (`describe`, `it`, `expect`, `beforeEach`, …). Globals are not enabled.
- **Never reuse a mock across test cases.** Create a fresh instance for every test — typically in a `beforeEach` (see the controller test) — so state never leaks between cases.
- **Build domain objects with builders,** not by hand. Fluent builders live in `test/builder/` (e.g. `UserBuilder.create({...})`, `UserBuilder.from(user).withEmail(...).build()`).
- **Assert with promise matchers:** `await expect(fn()).resolves.toEqual(...)` / `.rejects.toThrow(SomeError)`. Use `it.each` for table-driven cases and `toHaveBeenCalledExactlyOnceWith(...)` to assert collaborator calls.

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
- Architecture tests (Clean Architecture import rules via `rules.json`) → [architecture-tests.md](architecture-tests.md)

## Common mistakes

- Writing tests for domain value objects or for mocks.
- Sharing one mock instance across test cases instead of recreating it per test.
- Constructing domain objects inline instead of using a builder from `test/builder/`.
- Putting a unit test under `test/` or an integration test in `src/` (wrong runner picks it up).
- Relying on Vitest globals instead of importing from `vitest`.
