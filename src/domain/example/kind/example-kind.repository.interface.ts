import type { ResultAsync } from 'neverthrow'

import type { ConcurrencyToken } from '../../concurrency-token.js'
import type { WithConcurrencyToken } from '../../with-concurrency-token.js'

import type { DuplicateExampleKindIdError } from './error/duplicate-example-kind-id.error.js'
import type { DuplicateExampleKindNameError } from './error/duplicate-example-kind-name.error.js'
import type { ExampleKindConcurrencyError } from './error/example-kind-concurrency.error.js'
import type { ExampleKindInUseError } from './error/example-kind-in-use.error.js'
import type { ExampleKindNotFoundError } from './error/example-kind-not-found.error.js'
import type { ExampleKind } from './example-kind.js'
import type { ExampleKindID } from './example-kind-id.js'

export abstract class IExampleKindRepository {
  public abstract create(
    exampleKind: ExampleKind,
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
    exampleKind: ExampleKind,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<ExampleKind>,
    ExampleKindNotFoundError | DuplicateExampleKindNameError | ExampleKindConcurrencyError
  >
}
