# Integration Tests

Live under `test/integration/**/*.test.ts`. Runner: `npm run vitest:integration` (`vitest run test/integration`). Two flavors: **HTTP/controller** (real Nest app, mocked service) and **persistence/repository** (real PostgreSQL via Testcontainers — Docker required).

## HTTP / controller tests

Boot a real NestJS app with `Test.createTestingModule`, mock the application service (from `#/mocks.js`), wire the global pipe/filter/interceptor, and drive it with **supertest**. Assert status code + response body, and assert how the service was called.

```ts
beforeEach(async () => {
    userServiceMock = mockUserService(); // fresh per test
    const module = await Test.createTestingModule({
        controllers: [UsersController],
        providers: [
            { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
            { provide: APP_FILTER, useClass: DomainErrorsExceptionFilter },
            { provide: APP_PIPE, useClass: ZodValidationPipe },
            { provide: IUserService, useValue: userServiceMock },
        ],
    }).compile();
    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init();
});
afterEach(() => app.close());

it("returns 404 when the service throws", async () => {
    userServiceMock.get.mockRejectedValue(new UserNotFoundError(user.id));
    await request(app.getHttpServer()).get(`/users/${user.id}`).expect(HttpStatus.NOT_FOUND);
});
```

- Test the HTTP contract: success bodies, validation failures (`it.each` over bad payloads → `400`), domain errors mapped to status codes, and `500` for unexpected errors.
- The controller has no business logic, so the service is always a mock here — the real service is exercised by its own unit test.

## Persistence / repository tests

Use the shared harness `../../../test/integration/fixture/setup-integration-test.ts`. It starts one `postgres:18-alpine` Testcontainer per test file (`beforeAll`/`afterAll`). In `beforeAll` it also runs all migrations and seeds `fixture.sql` **once**, then marks that database as a Postgres template (`IS_TEMPLATE = true`). Each test's `beforeEach`/`afterEach` then just clones (`CREATE DATABASE ... TEMPLATE ...`) and drops a fresh per-test database — no migrations run per test. `createModule` wires `DatabaseModule` + the transactional CLS plugin and points the DB config at that test's database.

```ts
const integrationTest = setupIntegrationTest();
beforeAll(integrationTest.beforeAll);
afterAll(integrationTest.afterAll);

beforeEach(async () => {
    await integrationTest.beforeEach();
    const module = await integrationTest
        .createModule({
            testName: UserRepository.name,
            providers: [UserRepository],
        })
        .compile();
    app = await module.createNestApplication().enableShutdownHooks().init();
    userRepository = app.get(UserRepository);
    db = app.get(IConnectionProvider).database;
});
afterEach(async () => {
    await app?.close();
    await integrationTest.afterEach();
});
```

- Fixture data (teams, users, skills, examples, ...) is already present in every test's database via the template — no per-test seeding call is needed.
- Assert **both** the returned domain object and the raw DB row (`db.one('SELECT ...')` — inline SQL is allowed only in tests).
- Assert error cases throw the domain error (`*NotFoundError`, `Duplicate*Error`).
- For the repository conventions being tested (SQL files, row mapping, error translation), see the `database-changes` skill.
- Down-migrations are not exercised by these tests anymore; they're covered once by `test/integration/fixture/migration-round-trip.test.ts`.
