import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import type { DuplicateExampleKindIdError } from '#/domain/example/kind/error/duplicate-example-kind-id.error.js'
import type { DuplicateExampleKindNameError } from '#/domain/example/kind/error/duplicate-example-kind-name.error.js'
import type { ExampleKindConcurrencyError } from '#/domain/example/kind/error/example-kind-concurrency.error.js'
import type { ExampleKindInUseError } from '#/domain/example/kind/error/example-kind-in-use.error.js'
import type { ExampleKindNotFoundError } from '#/domain/example/kind/error/example-kind-not-found.error.js'
import type { ExampleKind, Properties } from '#/domain/example/kind/example-kind.js'
import type { ExampleKindID } from '#/domain/example/kind/example-kind-id.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'

export abstract class IExampleKindService {
  public abstract create(
    properties: Except<Properties, 'id'>,
  ): ResultAsync<
    WithConcurrencyToken<ExampleKind>,
    DuplicateExampleKindIdError | DuplicateExampleKindNameError
  >
  public abstract delete(
    id: ExampleKindID,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    void,
    ExampleKindNotFoundError | ExampleKindInUseError | ExampleKindConcurrencyError
  >
  public abstract get(
    id: ExampleKindID,
  ): ResultAsync<WithConcurrencyToken<ExampleKind>, ExampleKindNotFoundError>
  public abstract getAll(): ResultAsync<ExampleKind[], never>
  public abstract update(
    properties: SetRequired<Partial<Properties>, 'id'>,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<ExampleKind>,
    ExampleKindNotFoundError | DuplicateExampleKindNameError | ExampleKindConcurrencyError
  >
}
