# Integration Tests

Live under `test/integration/**/*.test.ts`. Runner: `npm run vitest:integration` (`vitest run test/integration`). Two flavors, both run against a real `postgres:18-alpine` Testcontainer — Docker required: **HTTP/controller** (real Nest app, real service, real repository) and **persistence/repository** (repository under test in isolation).

## HTTP / controller tests

Boot the real feature module — not a hand-picked list of providers — via the shared harness `../../../test/integration/fixture/setup-integration-test.ts` (see "Persistence / repository tests" below for what it sets up), wire the global pipe/filter/interceptor, and drive it with **supertest**. Nothing is mocked: the application service and repository are real, backed by the real database. Assert status code + response body against actual database state.

```ts
const integrationTest = setupIntegrationTest();
let app: INestApplication;

beforeAll(integrationTest.beforeAll);
afterAll(integrationTest.afterAll);

beforeEach(async () => {
    await integrationTest.beforeEach();

    const module = await integrationTest
        .createModule({ testName: UsersController.name, imports: [UserModule] })
        .compile();

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init();
});
afterEach(async () => {
    await app?.close();
    await integrationTest.afterEach();
});

it("returns 404 when the user doesn't exist", () =>
    request(app.getHttpServer()).get(`/users/${unknownUserId}`).expect(HttpStatus.NOT_FOUND));
```

- Test the HTTP contract: success bodies, a single bad-payload case → `400` (no need to enumerate every invalid variant), and domain errors mapped to status codes (`404`/`409`/`422`/...).
- **Don't test the 500/unexpected-error path.** There's no reliable way to force a real collaborator into an unexpected failure without mocking it, and controllers are never given a mocked service — so this path is left uncovered by default.
- Controllers have no business logic and are never unit-tested — this is their only test coverage, so it must exercise the real service and real repository against the real database rather than a mocked service. There is no `mockUserService`/`useValue` override here, and no `*.mock.ts` factory for application services is used in these tests.
- Use the existing fixture rows (`../fixture/fixture.js`) for read/update/delete cases and craft new payloads for creation cases — same template database described below.

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
