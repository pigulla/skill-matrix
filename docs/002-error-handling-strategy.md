---
status: "accepted"
date: 2026-08-05
---

# Error Handling Strategy

## Context and Problem Statement

The application needs a consistent way to signal and propagate errors across the domain, application, and infrastructure layers. Errors fall into two fundamentally different categories: expected, recoverable domain conditions (an entity was not found, a uniqueness constraint was violated, a reference doesn't exist) that calling code is meant to branch on and that are part of an operation's normal contract, and unexpected errors (bugs, infrastructure failures, violated invariants) that indicate something has gone wrong outside of that contract and cannot be meaningfully handled by the immediate caller. How should the application represent and propagate both kinds of errors so that expected failure modes are visible and enforced at the type level, while unexpected failures still surface loudly, without compromising the existing layer separation?

## Decision Drivers

- Expected failure modes should be visible in a function's type signature so a caller cannot forget to handle one, unlike thrown exceptions, which TypeScript does not track in signatures.
- Expected, recoverable domain errors must remain clearly distinguished from unexpected errors — the two should not be caught, logged, or reasoned about the same way.
- Consistent, composable error handling across the domain, application, and infrastructure layers.
- Low cognitive overhead for contributors who touch the project infrequently.
- Clean interoperation with NestJS's exception-based HTTP layer and with [`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional)'s promise/exception-based transaction API at the boundaries, without forcing every call site to unwrap manually.
- Long-term maintainability over short-term development convenience.

## Considered Options

- Throwing exceptions for all error conditions
- A full functional-programming library (e.g. [fp-ts](https://gcanti.github.io/fp-ts/), [Effect](https://effect.website))
- A minimal Result type library (e.g. [neverthrow](https://github.com/supermacro/neverthrow))

## Decision Outcome

Chosen option: "A minimal Result type library ([neverthrow](https://github.com/supermacro/neverthrow))", applying Railway-oriented programming to every expected, recoverable error condition across the domain, application, and infrastructure layers, because it is the only option that makes expected failure modes part of a function's type signature without pulling in a large functional-programming surface the project doesn't otherwise need. Thrown exceptions are still used, deliberately, for unexpected errors — programmer errors, invariant violations, and infrastructure failures that the immediate caller cannot recover from — so the two error categories remain distinguishable both in code and at runtime.

- Domain entities, application service interfaces, and repository interfaces return `Result<T, E>` / `ResultAsync<T, E>`, where `E` is a union of specific, typed error classes (e.g. `SkillNotFoundError | DuplicateSkillNameError | ExampleReferenceNotFoundError`), so every expected failure mode of an operation is explicit in its signature and exhaustively checkable by TypeScript.
- Repositories bridge [`pg-promise`](https://vitaly-t.github.io/pg-promise)'s promise-based API into the Result world via `ResultAsync.fromPromise`. Known, recoverable database conditions (unique constraint violations, foreign key violations, a missing row) are mapped to typed domain errors and returned as `Err`. Anything else — a connection failure, an unrecognized SQL error — is treated as a bug or infrastructure failure: it is deliberately re-thrown as `UnexpectedPersistenceError` rather than folded into the Result channel.
- Domain entities validate their own invariants in the constructor (via [Zod](https://zod.dev)) and throw (e.g. `InvalidSkillError`) rather than returning a `Result`. A domain object should never be constructible in an invalid state, so reaching that code path means a caller passed data that should already have been validated at a system boundary — a programmer error, not a recoverable domain condition.
- At the outer HTTP boundary, the [`@UnwrapResult()`](../src/util/unwrap-result.decorator.ts) method decorator converts a controller method's `ResultAsync<T, E>` back into a plain `Promise<T>` that resolves on `Ok` or throws `E` on `Err`. This lets NestJS's own exception-handling machinery — the [`DomainErrorsExceptionFilter`](../src/presentation/http/domain-errors-exception-filter.ts) — map thrown domain errors to the correct HTTP status, without controllers branching on `Result` themselves.
- The [`@ResultTransactional()`](../src/util/result-transactional.decorator.ts) decorator bridges Result-returning methods into [`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional)'s exception-based transaction API: an `Err` result is translated into an internally thrown `RollbackSignal` so the transaction still rolls back, and is then unwrapped back into a Result once the transaction settles. A genuinely thrown (unexpected) error propagates and rolls back the same way, but is never unwrapped back into a Result — it keeps propagating as an exception.

### Consequences

- Good, because every function signature makes its possible failure modes explicit and machine-checked; a caller cannot silently forget to handle a `SkillNotFoundError` the way they could forget to catch a thrown one.
- Good, because expected domain errors can be handled exhaustively, with TypeScript narrowing the error union to `never` once every member has been handled.
- Good, because unexpected errors (bugs, infrastructure failures) stay cleanly separated from expected ones and always fail loudly by propagating as exceptions, rather than being silently absorbed into a generic Result.
- Good, because `.map`, `.andThen`, and `.mapErr` allow expected-error-handling logic to be chained without nested `try`/`catch` pyramids, especially across domain → application → infrastructure calls.
- Good, because [neverthrow](https://github.com/supermacro/neverthrow) is a small, single-purpose library — a Result/ResultAsync type plus combinators — keeping the concept surface contributors must learn small.
- Good, because the two decorators ([`UnwrapResult`](../src/util/unwrap-result.decorator.ts), [`ResultTransactional`](../src/util/result-transactional.decorator.ts)) contain the impedance mismatch between Result and NestJS/transactional's exception-based APIs at two well-defined integration points, rather than scattering conversions throughout the codebase.
- Bad, because contributors must learn a second error-handling idiom (Railway-oriented programming) in addition to native `try`/`catch`, since both coexist by design.
- Bad, because two parallel failure channels (thrown exceptions and `Err` results) require a deliberate judgment call for every new piece of code about which one applies; misclassifying an error — returning a bug as an `Err`, or throwing what should be a typed `Err` — is a mistake that must be caught in review rather than by the type system.
- Bad, because `ResultAsync.fromPromise`'s error-mapping callback must explicitly re-throw for the "not a recognized domain condition" case in every repository method; forgetting this silently downgrades an unexpected error into whatever the following `andThen` chain does with it.

## Pros and Cons of the Options

### Throwing exceptions for all error conditions

- Neutral, because it is idiomatic to JavaScript/TypeScript and to NestJS itself, requiring no additional library or concept.
- Good, because NestJS's built-in exception filters map thrown exceptions to HTTP responses without any adapter code.
- Bad, because TypeScript does not track thrown types in function signatures, so nothing prevents a caller from forgetting to handle a specific error, or a service from silently starting to throw a new error type that no caller has been updated to handle.
- Bad, because distinguishing several possible error types in a `catch` block quickly turns into deeply nested `instanceof` chains, especially once errors need to be caught, transformed, and re-thrown across layers.
- Bad, because there is no principled way to distinguish "an expected condition the caller must decide how to handle" from "a bug" — both are just thrown `Error`s, forcing every catch site to reason about which one it might be.

### A full functional-programming library (e.g. [fp-ts](https://gcanti.github.io/fp-ts/), [Effect](https://effect.website))

- Neutral, because it provides the same Railway-oriented error handling, plus a much broader set of functional abstractions (structured concurrency, dependency injection via a context/layer system, retries, resource management).
- Good, because those extra abstractions could, in principle, replace other ad hoc solutions in the stack for a fully FP-native architecture.
- Bad, because adopting it well requires learning a large, abstract API surface (pipe-based composition, [fp-ts](https://gcanti.github.io/fp-ts/)'s higher-kinded-type machinery, or [Effect](https://effect.website)'s fiber/layer/context model) that most contributors would not otherwise need.
- Bad, because its extra abstractions overlap with and compete against decisions already made elsewhere in the stack — NestJS's DI container, [`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional)'s transaction propagation (see [001](001-persistence-strategy.md)) — creating two competing ways to do the same job instead of complementing the existing architecture.
- Bad, because the heavier dependency and steeper learning curve are hard to justify when only the core Result/Either type is actually needed.

### A minimal Result type library (e.g. [neverthrow](https://github.com/supermacro/neverthrow))

- Good, because it provides exactly the `Result`/`ResultAsync` type and combinators (`map`, `andThen`, `mapErr`, `fromPromise`) needed for Railway-oriented programming, with no further abstractions to learn.
- Good, because `ResultAsync` wraps a `Promise` directly, so it composes naturally with the rest of the async, promise-based stack ([`pg-promise`](https://vitaly-t.github.io/pg-promise), NestJS, [`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional)) rather than requiring a parallel runtime.
- Good, because it is small, stable, and single-purpose, keeping its API easy to review and audit in full.
- Bad, because it lacks the broader ecosystem (structured concurrency, dependency injection, retry policies) a full FP library would provide — though the project does not need these, since NestJS and [`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional) already cover them.
- Bad, because it still requires two purpose-built decorators to bridge `Result` back into NestJS's and [`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional)'s exception-based APIs at the boundaries.

## More Information

This decision builds on [001](001-persistence-strategy.md): repositories already returned `ResultAsync` for the reasons described there; this record formalizes that pattern as the application-wide error-handling strategy and makes explicit where the boundary between "expected, returned as `Err`" and "unexpected, thrown" lies. See [neverthrow](https://github.com/supermacro/neverthrow) for the library itself, [`src/util/unwrap-result.decorator.ts`](../src/util/unwrap-result.decorator.ts) and [`src/util/result-transactional.decorator.ts`](../src/util/result-transactional.decorator.ts) for the two boundary-adapter decorators, and [`src/domain/error/`](../src/domain/error/) for the base domain error hierarchy (`DomainError` and its subclasses) that the HTTP-layer [`DomainErrorsExceptionFilter`](../src/presentation/http/domain-errors-exception-filter.ts) maps to status codes.
