import type { ResultAsync } from 'neverthrow'

import type { ConcurrencyToken } from '../concurrency-token.js'
import type { WithConcurrencyToken } from '../with-concurrency-token.js'

import type { DuplicateExampleIdError } from './error/duplicate-example-id.error.js'
import type { DuplicateExampleNameError } from './error/duplicate-example-name.error.js'
import type { ExampleConcurrencyError } from './error/example-concurrency.error.js'
import type { ExampleInUseError } from './error/example-in-use.error.js'
import type { ExampleNotFoundError } from './error/example-not-found.error.js'
import type { Example } from './example.js'
import type { ExampleID } from './example-id.js'
import type { ExampleKindReferenceNotFoundError } from './kind/error/example-kind-reference-not-found.error.js'

export abstract class IExampleRepository {
  public abstract create(
    example: Example,
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
    example: Example,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<Example>,
    | ExampleNotFoundError
    | DuplicateExampleNameError
    | ExampleKindReferenceNotFoundError
    | ExampleConcurrencyError
  >
}
