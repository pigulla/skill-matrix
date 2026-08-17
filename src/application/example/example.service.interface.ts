import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import type { DuplicateExampleIdError } from '#/domain/example/error/duplicate-example-id.error.js'
import type { DuplicateExampleNameError } from '#/domain/example/error/duplicate-example-name.error.js'
import type { ExampleConcurrencyError } from '#/domain/example/error/example-concurrency.error.js'
import type { ExampleInUseError } from '#/domain/example/error/example-in-use.error.js'
import type { ExampleNotFoundError } from '#/domain/example/error/example-not-found.error.js'
import type { Example, Properties } from '#/domain/example/example.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import type { ExampleKindReferenceNotFoundError } from '#/domain/example/kind/error/example-kind-reference-not-found.error.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'

export abstract class IExampleService {
  public abstract create(
    properties: Except<Properties, 'id'>,
  ): ResultAsync<
    WithConcurrencyToken<Example>,
    DuplicateExampleIdError | DuplicateExampleNameError | ExampleKindReferenceNotFoundError
  >
  public abstract delete(
    id: ExampleID,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<void, ExampleNotFoundError | ExampleInUseError | ExampleConcurrencyError>
  public abstract get(
    id: ExampleID,
  ): ResultAsync<WithConcurrencyToken<Example>, ExampleNotFoundError>
  public abstract getAll(): ResultAsync<Example[], never>
  public abstract update(
    properties: SetRequired<Partial<Properties>, 'id'>,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<Example>,
    | ExampleNotFoundError
    | DuplicateExampleNameError
    | ExampleKindReferenceNotFoundError
    | ExampleConcurrencyError
  >
}
