import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { DuplicateExampleIdError } from '#/domain/example/error/duplicate-example-id.error.js'
import type { DuplicateExampleNameError } from '#/domain/example/error/duplicate-example-name.error.js'
import type { ExampleInUseError } from '#/domain/example/error/example-in-use.error.js'
import type { ExampleNotFoundError } from '#/domain/example/error/example-not-found.error.js'
import type { Example, Properties } from '#/domain/example/example.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import type { ExampleKindReferenceNotFoundError } from '#/domain/example-kind/error/example-kind-reference-not-found.error.js'

export abstract class IExampleService {
  public abstract create(
    properties: Except<Properties, 'id'>,
  ): ResultAsync<
    Example,
    DuplicateExampleIdError | DuplicateExampleNameError | ExampleKindReferenceNotFoundError
  >
  public abstract delete(id: ExampleID): ResultAsync<void, ExampleNotFoundError | ExampleInUseError>
  public abstract get(id: ExampleID): ResultAsync<Example, ExampleNotFoundError>
  public abstract getAll(): ResultAsync<Example[], never>
  public abstract update(
    properties: SetRequired<Partial<Properties>, 'id'>,
  ): ResultAsync<
    Example,
    ExampleNotFoundError | DuplicateExampleNameError | ExampleKindReferenceNotFoundError
  >
}
