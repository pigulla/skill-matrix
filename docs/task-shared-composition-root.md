# Task: Share One Composition Root Between the App and the Test Harness

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to work through this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also load the project's `writing-tests` skill — this plan changes the shared integration-test harness that every integration test depends on.

**Goal:** stop maintaining the application's global wiring twice. Extract it into two modules that both `MainModule` and the integration-test harness compose.

**Origin:** critical finding 5 of [`architecture-review.md`](architecture-review.md).

Independent of the other three extracted findings ([`task-monotonic-concurrency-tokens.md`](task-monotonic-concurrency-tokens.md), [`task-serialization-failure-retries.md`](task-serialization-failure-retries.md), [`task-foreign-key-indexes.md`](task-foreign-key-indexes.md)) — no shared files. Worth doing **before** the retry plan if you are sequencing them, since that plan's ADR 006 leaves the isolation level as an open question and this one makes `DEFAULT_TX_OPTIONS` the single place it is written down.

---

## Context: why this is broken today

`test/integration/fixture/setup-integration-test.ts`'s `createModule()` re-declares, by hand, what `src/module/main.module.ts` wires:

| Wiring | `MainModule` | `createModule()` |
| --- | --- | --- |
| `APP_PIPE` → `ZodValidationPipe` | ✅ | ✅ duplicated |
| `APP_INTERCEPTOR` → `ZodSerializerInterceptor` | ✅ | ✅ duplicated |
| `APP_FILTER` → `DomainErrorsExceptionFilter` | ✅ | ✅ duplicated |
| `ClsModule.forRoot` + `ClsPluginTransactional` + `TransactionalAdapterPgPromise` | ✅ | ✅ duplicated |
| Transaction isolation level | `DEFAULT_TX_OPTIONS` | **a second literal copy** of `new txMode.TransactionMode({ tiLevel: serializable })` |
| Logging | `LoggingModule` | `LoggerModule.forRoot({ pinoHttp: { enabled: false } })` — deliberately different, see below |

Integration tests are the **only** coverage for controllers and repositories — the `writing-tests` skill rules out unit-testing either — so they have to exercise the production wiring to be worth anything. As it stands they exercise a hand-maintained replica of it.

Nothing boots `MainModule` at all: every controller test imports a single feature module (`imports: [UserModule]`) into the harness's own root. `MainModule` is therefore completely untested, which is exactly why the divergence is invisible.

### The two drift directions are not symmetric

This matters for how much machinery the fix needs.

- **Harness loses wiring → loud.** Remove `HttpCoreModule` from the harness and controller tests fail immediately: without `ZodValidationPipe` a bad payload stops returning `400`; without `DomainErrorsExceptionFilter` a `SkillNotFoundError` becomes `500` instead of `404`. Existing tests already guard this direction.
- **Production gains wiring the harness lacks → silent.** Add `{ provide: APP_GUARD, ... }` to `MainModule` and every integration test keeps passing against an app that no longer resembles production.

So the extraction fixes today's duplication. The silent direction — production gaining wiring the harness lacks — stays uncovered; this plan does not add a test for it.

---

## Decisions already made — do not re-litigate

| Decision | Rationale |
| --- | --- |
| Two modules: `TransactionalModule` (CLS plugin + `DEFAULT_TX_OPTIONS`) and `HttpCoreModule` (the three `APP_*` enhancers). | They have different lifetimes and different reasons to change. A non-HTTP entry point (the `database-changes` skill anticipates a CLI) needs the transaction wiring and not the HTTP enhancers. |
| The review calls the second one `CoreHttpModule`; this plan names it `HttpCoreModule`. | Same thing. Do not create both. |
| Wrapping `ClsModule.forRoot(...)` inside `TransactionalModule` is safe. | **Verified, do not re-derive:** `ClsModule.forRoot()` passes `global: options?.global` (undefined here) but the module it imports, `ClsRootModule`, is itself decorated `@Global()` (`nestjs-cls/dist/src/lib/cls-module/cls-root.module.js`), and `ClsPluginTransactional` pushes the `TransactionHost` token into that module's exports. `TransactionHost` therefore stays injectable everywhere — which `SkillRepository` (inside `SkillModule`) depends on today. |
| Declaring the `APP_*` providers in a non-root module works. | **Verified, do not re-derive:** `@nestjs/core`'s scanner collects `APP_*` providers from every module into `applicationProvidersApplyMap` and applies them to `ApplicationConfig`. Registering them in the root is a convention, not a requirement. |
| Do **not** move the CLS plugin into `DatabaseModule`. | It would shrink both call sites further, but `forRoot()` means "register once, at the root", and `DatabaseModule` is imported by five feature modules. |
| Keep the harness's logging wiring hand-rolled and different. | `LoggingModule` builds a pino transport (`pino-pretty` / `pino/file`), and a transport spawns a worker thread per application instance. Integration tests construct one app **per test case**. The transport-free `LoggerModule.forRoot({ pinoHttp: { enabled: false } })` is correct — it just needs a comment saying so. |
| Do **not** switch the harness to `Test.createTestingModule({ imports: [MainModule] })` with `overrideModule`. | Higher fidelity and zero duplication by construction, but every test file would boot all five feature modules, and repository tests deliberately compose a bare module with a single provider (`providers: [UserRepository]`). Revisit only if the extracted modules drift again. |
| No ADR. | This reverses no decision and adds no architectural concept — it removes a duplicate. The rule that keeps it from recurring belongs in `AGENTS.md` and the `writing-tests` skill. ADR 004 is taken and 005/006 are reserved by the other plans; do not consume a number. |

---

## Global constraints

- No behaviour change. Every existing test must pass unmodified — a failing test is a signal, not something to adjust.
- `npm run lint:tsc`, `npm run lint:architecture` and `npm run lint:knip` must stay green.
- Conventional Commits; commit at the end of each task.
- `npm run test` must pass before the final commit.
- Integration tests need Docker running (Testcontainers).

---

### Task 1: Extract the two modules and rewire `MainModule`

**Files:**

- Create: `src/module/transactional.module.ts`
- Create: `src/module/http-core.module.ts`
- Modify: `src/module/main.module.ts`

**Interfaces produced:** `TransactionalModule` and `HttpCoreModule`. Task 2 imports both.

- [ ] **Step 1: Create `TransactionalModule`**

<!-- prettier-ignore -->
```ts
import { Module } from '@nestjs/common'
import { ClsPluginTransactional } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { ClsModule } from 'nestjs-cls'

import { DB_CONNECTION } from '#/infrastructure/persistence/connection-provider.interface.js'
import { DEFAULT_TX_OPTIONS } from '#/infrastructure/persistence/default-transaction-options.js'

import { DatabaseModule } from './database.module.js'

/**
 * Owns the CLS transaction plugin and, with it, the isolation level every transaction runs at.
 *
 * Kept separate from DatabaseModule because `ClsModule.forRoot()` is a register-once-at-the-root
 * concern while DatabaseModule is imported by every feature module. `ClsRootModule` is `@Global()`,
 * so importing this module once makes `TransactionHost` injectable everywhere.
 */
@Module({
  imports: [
    ClsModule.forRoot({
      plugins: [
        new ClsPluginTransactional({
          imports: [DatabaseModule],
          adapter: new TransactionalAdapterPgPromise({
            dbInstanceToken: DB_CONNECTION,
            defaultTxOptions: DEFAULT_TX_OPTIONS,
          }),
        }),
      ],
    }),
  ],
})
export class TransactionalModule {}
```

- [ ] **Step 2: Create `HttpCoreModule`**

<!-- prettier-ignore -->
```ts
import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod'

import { DomainErrorsExceptionFilter } from '#/presentation/http/domain-errors-exception-filter.js'

/**
 * The global HTTP enhancers, defined once for both the application and the integration-test harness.
 *
 * Nest applies APP_* providers globally regardless of which module declares them, so this does not
 * have to be the root module. Any new global pipe/filter/interceptor/guard belongs here — putting one
 * in MainModule would apply it in production but not under test.
 */
@Module({
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: DomainErrorsExceptionFilter },
  ],
})
export class HttpCoreModule {}
```

- [ ] **Step 3: Reduce `MainModule` to a list of modules**

Delete its `providers` array entirely and replace the inline `ClsModule.forRoot({ ... })` with the two new modules:

```diff
 import { Module } from '@nestjs/common'
-import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
-import { ClsPluginTransactional } from '@nestjs-cls/transactional'
-import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
-import { ClsModule } from 'nestjs-cls'
-import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod'
-
-import { DB_CONNECTION } from '#/infrastructure/persistence/connection-provider.interface.js'
-import { DEFAULT_TX_OPTIONS } from '#/infrastructure/persistence/default-transaction-options.js'
-import { DomainErrorsExceptionFilter } from '#/presentation/http/domain-errors-exception-filter.js'

 @Module({
   imports: [
     LoggingModule,
     ConfigModule,
     DatabaseModule,
-    ClsModule.forRoot({ /* ... */ }),
+    TransactionalModule,
+    HttpCoreModule,
     UserModule,
     TeamModule,
     ExampleModule,
     SkillModule,
     HealthModule,
   ],
-  providers: [
-    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
-    { provide: APP_PIPE, useClass: ZodValidationPipe },
-    { provide: APP_FILTER, useClass: DomainErrorsExceptionFilter },
-  ],
 })
 export class MainModule {}
```

Add the two new relative imports alongside the existing `./*.module.js` ones. Biome's import sorting will place them; run `npm run format:biome` rather than hand-placing them.

- [ ] **Step 4: Smoke-test the running application**

**Do not skip this.** No test boots `MainModule`, so the test suite cannot tell you whether the app still wires up — that is the whole point of the finding. The `@Global()` reasoning behind Step 1 is the one risky assumption in this plan, and only a real boot exercises it.

```bash
npm run docker:compose-up
npm start
```

In a second shell:

```bash
curl -fsS localhost:3000/health
curl -fsS localhost:3000/users
```

Expected: the app starts without a DI resolution error, `/health` returns `200`, and `/users` returns `200` with the seeded users. `/users` is the meaningful one — it goes through `UserService.getAll()`, which is decorated `@ResultTransactional()`, so a `TransactionHost not initialized` error there would mean the plugin is no longer reachable. A DI failure would instead abort startup with `Nest can't resolve dependencies of the SkillRepository`.

- [ ] **Step 5: Lint and commit**

```bash
npm run format:biome && npm run lint:tsc && npm run lint:architecture && npm run lint:knip && npm run lint:biome
git add src/module
git commit -m "refactor: extract shared global wiring into TransactionalModule and HttpCoreModule"
```

---

### Task 2: Compose the same modules in the test harness

**Files:** modify `test/integration/fixture/setup-integration-test.ts`

- [ ] **Step 1: Rewrite `createModule`'s metadata**

```diff
 function createModule(options?: ModuleMetadata & { testName?: string }): TestingModuleBuilder {
   return Test.createTestingModule({
     imports: [
       ConfigModule,
       DatabaseModule,
+      TransactionalModule,
+      HttpCoreModule,
+      // Deliberately not LoggingModule: it builds a pino transport, and a transport spawns a worker
+      // thread per application instance. These tests construct one app per test case, so they use a
+      // transport-free silent logger instead. This is the one piece of wiring that is meant to differ.
       LoggerModule.forRoot({
         pinoHttp: {
           enabled: false,
         },
       }),
-      ClsModule.forRoot({
-        plugins: [
-          new ClsPluginTransactional({
-            imports: [DatabaseModule],
-            adapter: new TransactionalAdapterPgPromise({
-              dbInstanceToken: DB_CONNECTION,
-              defaultTxOptions: {
-                mode: new txMode.TransactionMode({ tiLevel: txMode.isolationLevel.serializable }),
-              },
-            }),
-          }),
-        ],
-      }),
       ...(options?.imports ?? []),
     ],
-    providers: [
-      { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
-      { provide: APP_FILTER, useClass: DomainErrorsExceptionFilter },
-      { provide: APP_PIPE, useClass: ZodValidationPipe },
-      ...(options?.providers ?? []),
-    ],
+    providers: options?.providers ?? [],
     exports: options?.exports ?? [],
   })
     .overrideProvider(DATABASE_CONFIG)
     .useValue(createDatabaseConfig({ /* unchanged */ }))
 }
```

Then clean up the imports that are now unused — `APP_FILTER`, `APP_INTERCEPTOR`, `APP_PIPE`, `ClsModule`, `ClsPluginTransactional`, `TransactionalAdapterPgPromise`, `ZodSerializerInterceptor`, `ZodValidationPipe`, `DB_CONNECTION`, `DomainErrorsExceptionFilter` — and narrow `import pgPromise, { txMode } from 'pg-promise'` to `import pgPromise from 'pg-promise'`. Add imports for `TransactionalModule` and `HttpCoreModule` from `#/module/...`. `npm run lint:tsc` and `npm run lint:biome` will catch anything missed.

The literal copy of the serializable transaction mode disappearing is the point of the whole task: `DEFAULT_TX_OPTIONS` becomes the only place the isolation level is written down.

- [ ] **Step 2: Run the full integration suite**

```bash
npm run vitest:integration
```

Expected: every test passes unmodified. This is the real verification — controller tests exercise the validation pipe (`400` on a bad payload) and the exception filter (`404`/`409`/`412` on domain errors), and repository tests exercise the transaction plugin, so a mis-wired harness fails loudly here.

- [ ] **Step 3: Confirm the harness's wiring is genuinely exercised**

Temporarily remove `HttpCoreModule` from the harness's imports and re-run one controller test file:

```bash
npx vitest run test/integration/presentation/controller/users.controller.test.ts
```

Expected: failures — the domain-error cases return `500` instead of `404`/`409`, and the bad-payload case stops returning `400`. Restore the import. This confirms the harness's composed wiring is genuinely exercised, not merely present in the import list.

- [ ] **Step 4: Commit**

```bash
git add test/integration/fixture/setup-integration-test.ts
git commit -m "test: compose the application's shared modules in the integration harness"
```

---

### Task 3: Documentation

**Files:**

- Modify: `AGENTS.md`
- Modify: `.claude/skills/writing-tests/integration-tests.md`
- Modify: `docs/architecture-review.md`

- [ ] **Step 1: Record the rule in `AGENTS.md`**

Under § Architecture → Key patterns, add a **Modules** entry stating that global HTTP enhancers (`APP_PIPE`/`APP_FILTER`/`APP_INTERCEPTOR`/`APP_GUARD`) belong in `HttpCoreModule` and the CLS transaction plugin in `TransactionalModule`, because the integration-test harness composes those two modules rather than `MainModule` — so wiring declared anywhere else exists in production only.

- [ ] **Step 2: Correct the `writing-tests` skill**

`integration-tests.md` currently says:

> `createModule` wires `DatabaseModule` + the transactional CLS plugin and points the DB config at that test's database.

That description is now wrong in a way that matters — it reads as though the harness owns the wiring. Replace it with: the harness composes the same `TransactionalModule` and `HttpCoreModule` the application does, adds a silent logger in place of `LoggingModule`, and overrides `DATABASE_CONFIG` to point at the test's database. Add that a new global enhancer goes in `HttpCoreModule`, never in the harness.

- [ ] **Step 3: Close out the finding**

In `docs/architecture-review.md`, mark critical finding 5 as resolved, pointing at the two modules. Leave the finding text intact.

- [ ] **Step 4: Format, verify, commit**

```bash
npm run format:markdown
npm run test
git add AGENTS.md docs .claude/skills/writing-tests
git commit -m "docs: document the shared composition root"
```

`npm run format:markdown` is not optional — Prettier formats every `.md` in the repo and `npm run lint:markdown` is part of `npm run lint`.

---

## Definition of done

- [ ] `TransactionalModule` and `HttpCoreModule` exist; the transaction isolation level appears exactly once, in `DEFAULT_TX_OPTIONS`.
- [ ] `MainModule` has no `providers` array and no framework imports beyond `@nestjs/common`'s `Module`.
- [ ] The harness composes both modules; its only remaining bespoke wiring is the silent logger, with a comment explaining why.
- [ ] The application boots and serves `/health` and `/users` (verified by hand — no test covers this).
- [ ] `npm run vitest:integration` passes unmodified, and removing `HttpCoreModule` from the harness was observed to break controller tests.
- [ ] `AGENTS.md` and `integration-tests.md` state where global wiring belongs.
- [ ] `npm run test` passes.

## Out of scope (do not expand into these)

- Switching the harness to `imports: [MainModule]` with `overrideModule` — see the decisions table.
- `config/test.json` sets `logging.enabled: true`, which is inert because nothing under test imports `LoggingModule`. Misleading, but a separate cleanup.
- Moving the CLS plugin into `DatabaseModule`.
- Anything in the other three plans.
