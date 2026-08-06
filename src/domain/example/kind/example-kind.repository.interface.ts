import type { ResultAsync } from 'neverthrow'

import type { DuplicateExampleKindIdError } from './error/duplicate-example-kind-id.error.js'
import type { DuplicateExampleKindNameError } from './error/duplicate-example-kind-name.error.js'
import type { ExampleKindInUseError } from './error/example-kind-in-use.error.js'
import type { ExampleKindNotFoundError } from './error/example-kind-not-found.error.js'
import type { ExampleKind } from './example-kind.js'
import type { ExampleKindID } from './example-kind-id.js'

export abstract class IExampleKindRepository {
  public abstract create(
    exampleKind: ExampleKind,
  ): ResultAsync<ExampleKind, DuplicateExampleKindIdError | DuplicateExampleKindNameError>
  public abstract delete(
    id: ExampleKindID,
  ): ResultAsync<void, ExampleKindNotFoundError | ExampleKindInUseError>
  public abstract get(id: ExampleKindID): ResultAsync<ExampleKind, ExampleKindNotFoundError>
  public abstract getAll(): ResultAsync<ExampleKind[], never>
  public abstract update(
    exampleKind: ExampleKind,
  ): ResultAsync<ExampleKind, ExampleKindNotFoundError | DuplicateExampleKindNameError>
}
