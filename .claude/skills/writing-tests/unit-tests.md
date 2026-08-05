# Unit Tests

Colocated with the code they test: `src/<path>/<name>.test.ts`. Runner: `npm run vitest:unit` (`vitest run src`). No database, no HTTP — collaborators are mocked.

## What to unit-test

- `util/` functions and infrastructure logic that is **not** direct database access and does **not** carry `@ResultTransactional()` (DB access is covered by integration tests).
- **Not** domain value objects (no logic) and **not** `*.mock.ts` files.

> **Known gap — application services are not currently unit-testable this way.** Every public method on every application service (`src/application/*/`) is decorated with `@ResultTransactional()`. That decorator calls `TransactionHost.getInstance()` internally, which throws `TransactionHost not initialized` unless a NestJS app/module has already bootstrapped `ClsPluginTransactional` — constructing a service directly with mocked collaborators (the pattern below) and calling a method on it fails immediately, regardless of what's mocked. As a result there are currently **zero** unit tests for any application service; their logic is only exercised indirectly through the controller integration tests (see `integration-tests.md`). Fixing this needs a deliberate decision (e.g. bootstrapping a minimal `Test.createTestingModule` with `@nestjs-cls/transactional`'s `NoOpTransactionalAdapter`, which the library ships "for testing purposes") — don't invent a workaround ad hoc; raise it for a follow-up.

## How

1. Import the unit under test and construct it directly, injecting mocked collaborators.
2. Get every collaborator mock from `#/mocks.js` and create it fresh in `beforeEach`.
3. Drive one behavior per `it`; assert both the return value and the collaborator interactions.

This pattern works for plain throw-based classes (no `@ResultTransactional()`), such as `PendingMigrationsChecker` — the one unit test that exists in the repo today:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import {
    type DefinedMigrationsProviderMock,
    type MigrationRepositoryMock,
    mockDefinedMigrationsProvider,
    mockMigrationRepository,
} from "#/mocks.js";

import { MigrationsPendingError } from "./error/migrations-pending.error.js";
import { asMigration } from "./migration.js";
import { PendingMigrationsChecker } from "./pending-migrations-checker.js";

describe("PendingMigrationsChecker", () => {
    const MIGRATION_A = asMigration("a");
    const MIGRATION_B = asMigration("b");

    let migrationRepository: MigrationRepositoryMock;
    let definedMigrationsProvider: DefinedMigrationsProviderMock;
    let checker: PendingMigrationsChecker;

    beforeEach(() => {
        migrationRepository = mockMigrationRepository(); // fresh per test — never shared
        definedMigrationsProvider = mockDefinedMigrationsProvider();
        checker = new PendingMigrationsChecker(migrationRepository, definedMigrationsProvider);
    });

    it("should throw MigrationsPendingError if fewer migrations are applied than defined", async () => {
        definedMigrationsProvider.getAll.mockResolvedValue([MIGRATION_A, MIGRATION_B]);
        migrationRepository.getAll.mockResolvedValue([MIGRATION_A]);

        await expect(checker.assertNoPendingMigrations()).rejects.toThrow(MigrationsPendingError);
    });
});
```

If the unit under test returns `ResultAsync<T, E>` instead of throwing (and isn't blocked by the gap above), configure mocked collaborators with `okAsync(...)`/`errAsync(...)` and assert with `result._unsafeUnwrap()`/`result._unsafeUnwrapErr()` on the awaited result — see `AGENTS.md` § Error handling and the repository integration tests for the pattern.

## Notes

- Configure throw-based mock behavior per test with `mockResolvedValue` / `mockRejectedValue` / `mockReturnValue`; configure `Result`-based mocks with `mockReturnValue(okAsync(...))` / `mockReturnValue(errAsync(...))`. Assert calls with `toHaveBeenCalledExactlyOnceWith` / `not.toHaveBeenCalled`.
- Use `it.each` for table-driven variations rather than copy-pasting cases.
- `*.mock.ts` and `*.test.ts` are excluded from coverage; coverage targets `src/**/*.ts`.
