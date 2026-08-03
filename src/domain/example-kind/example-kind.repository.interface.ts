import type { ResultAsync } from 'neverthrow'

import type { DuplicateExampleKindError } from './error/duplicate-example-kind.error.js'
import type { ExampleKindInUseError } from './error/example-kind-in-use.error.js'
import type { ExampleKindNotFoundError } from './error/example-kind-not-found.error.js'
import type { ExampleKind } from './example-kind.js'

export abstract class IExampleKindRepository {
  public abstract create(kind: ExampleKind): ResultAsync<ExampleKind, DuplicateExampleKindError>
  public abstract delete(
    kind: ExampleKind,
  ): ResultAsync<void, ExampleKindNotFoundError | ExampleKindInUseError>
  public abstract get(kind: ExampleKind): ResultAsync<ExampleKind, ExampleKindNotFoundError>
  public abstract getAll(): ResultAsync<ExampleKind[], never>
}
