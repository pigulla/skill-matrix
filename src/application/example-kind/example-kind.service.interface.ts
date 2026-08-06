import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { DuplicateExampleKindIdError } from '#/domain/example/kind/error/duplicate-example-kind-id.error.js'
import type { DuplicateExampleKindNameError } from '#/domain/example/kind/error/duplicate-example-kind-name.error.js'
import type { ExampleKindInUseError } from '#/domain/example/kind/error/example-kind-in-use.error.js'
import type { ExampleKindNotFoundError } from '#/domain/example/kind/error/example-kind-not-found.error.js'
import type { ExampleKind, Properties } from '#/domain/example/kind/example-kind.js'
import type { ExampleKindID } from '#/domain/example/kind/example-kind-id.js'

export abstract class IExampleKindService {
  public abstract create(
    properties: Except<Properties, 'id'>,
  ): ResultAsync<ExampleKind, DuplicateExampleKindIdError | DuplicateExampleKindNameError>
  public abstract delete(
    id: ExampleKindID,
  ): ResultAsync<void, ExampleKindNotFoundError | ExampleKindInUseError>
  public abstract get(id: ExampleKindID): ResultAsync<ExampleKind, ExampleKindNotFoundError>
  public abstract getAll(): ResultAsync<ExampleKind[], never>
  public abstract update(
    properties: SetRequired<Partial<Properties>, 'id'>,
  ): ResultAsync<ExampleKind, ExampleKindNotFoundError | DuplicateExampleKindNameError>
}
