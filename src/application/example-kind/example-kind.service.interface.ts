import type { ResultAsync } from 'neverthrow'

import type { DuplicateExampleKindError } from '#/domain/example-kind/error/duplicate-example-kind.error.js'
import type { ExampleKindInUseError } from '#/domain/example-kind/error/example-kind-in-use.error.js'
import type { ExampleKindNotFoundError } from '#/domain/example-kind/error/example-kind-not-found.error.js'
import type { ExampleKind } from '#/domain/example-kind/example-kind.js'

export abstract class IExampleKindService {
  public abstract create(kind: ExampleKind): ResultAsync<ExampleKind, DuplicateExampleKindError>
  public abstract delete(
    kind: ExampleKind,
  ): ResultAsync<void, ExampleKindNotFoundError | ExampleKindInUseError>
  public abstract get(kind: ExampleKind): ResultAsync<ExampleKind, ExampleKindNotFoundError>
  public abstract getAll(): ResultAsync<ExampleKind[], never>
}
