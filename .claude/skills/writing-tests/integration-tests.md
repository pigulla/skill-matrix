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

Use the shared harness `test/integration/persistence/setup-database-integration-test.ts`. It starts one `postgres:17` Testcontainer (`beforeAll`/`afterAll`) and runs all migrations up before each test and down after (`beforeEach`/`afterEach`) via the node-pg-migrate `runner`, so every test gets a clean schema. `createModule` wires `DatabaseModule` + the transactional CLS plugin and points the DB config at the container.

```ts
const integrationTest = setupDatabaseIntegrationTest();
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
    await db.multi(fixture); // seed from a fixture.sql read at the top of the file
});
afterEach(async () => {
    await app?.close();
    await integrationTest.afterEach();
});
```

- Seed state from a `fixture.sql` next to the test; assert **both** the returned domain object and the raw DB row (`db.one('SELECT ...')` — inline SQL is allowed only in tests).
- Assert error cases throw the domain error (`*NotFoundError`, `Duplicate*Error`).
- For the repository conventions being tested (SQL files, row mapping, error translation), see the `database-changes` skill.
