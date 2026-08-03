import type { ResultAsync } from 'neverthrow'

import type { ExampleKindReferenceNotFoundError } from '../example-kind/error/example-kind-reference-not-found.error.js'

import type { DuplicateExampleIdError } from './error/duplicate-example-id.error.js'
import type { DuplicateExampleNameError } from './error/duplicate-example-name.error.js'
import type { ExampleInUseError } from './error/example-in-use.error.js'
import type { ExampleNotFoundError } from './error/example-not-found.error.js'
import type { Example } from './example.js'
import type { ExampleID } from './example-id.js'

export abstract class IExampleRepository {
  public abstract create(
    example: Example,
  ): ResultAsync<
    Example,
    DuplicateExampleIdError | DuplicateExampleNameError | ExampleKindReferenceNotFoundError
  >
  public abstract delete(id: ExampleID): ResultAsync<void, ExampleNotFoundError | ExampleInUseError>
  public abstract get(id: ExampleID): ResultAsync<Example, ExampleNotFoundError>
  public abstract getAll(): ResultAsync<Example[], never>
  public abstract getMany(ids: ReadonlySet<ExampleID>): ResultAsync<Example[], ExampleNotFoundError>
  public abstract update(
    example: Example,
  ): ResultAsync<
    Example,
    ExampleNotFoundError | DuplicateExampleNameError | ExampleKindReferenceNotFoundError
  >
}
