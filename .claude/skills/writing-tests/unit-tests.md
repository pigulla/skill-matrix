# Unit Tests

Colocated with the code they test: `src/<path>/<name>.test.ts`. Runner: `npm run vitest:unit` (`vitest run src`). No database, no HTTP — collaborators are mocked.

## What to unit-test

- Application services, presentation logic, `util/` functions, and infrastructure logic that is **not** direct database access (DB access is covered by integration tests).
- **Not** domain value objects (no logic) and **not** `*.mock.ts` files.

## How

1. Import the unit under test and construct it directly, injecting mocked collaborators.
2. Get every collaborator mock from `#/mocks.js` and create it fresh in `beforeEach`.
3. Drive one behavior per `it`; assert both the return value and the collaborator interactions.

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { UserService } from "#/application/user.service.js";
import { UserNotFoundError } from "#/domain/user/user-not-found.error.js";
import { mockUserRepository, mockUuidProvider, type UserRepositoryMock } from "#/mocks.js";
import { UserBuilder } from "../../test/builder/user.builder.js";

describe("UserService", () => {
    let userRepository: UserRepositoryMock;
    let service: UserService;

    beforeEach(() => {
        userRepository = mockUserRepository(); // fresh per test — never shared
        service = new UserService(userRepository, mockUuidProvider());
    });

    it("returns the user from the repository", async () => {
        const user = UserBuilder.create();
        userRepository.get.mockResolvedValue(user);

        await expect(service.get(user.id)).resolves.toEqual(user);
        expect(userRepository.get).toHaveBeenCalledExactlyOnceWith(user.id);
    });

    it("propagates a not-found error", async () => {
        const user = UserBuilder.create();
        userRepository.get.mockRejectedValue(new UserNotFoundError(user.id));

        await expect(service.get(user.id)).rejects.toThrow(UserNotFoundError);
    });
});
```

## Notes

- Configure mock behavior per test with `mockResolvedValue` / `mockRejectedValue` / `mockReturnValue`; assert calls with `toHaveBeenCalledExactlyOnceWith` / `not.toHaveBeenCalled`.
- Use `it.each` for table-driven variations rather than copy-pasting cases.
- `*.mock.ts` and `*.test.ts` are excluded from coverage; coverage targets `src/**/*.ts`.
