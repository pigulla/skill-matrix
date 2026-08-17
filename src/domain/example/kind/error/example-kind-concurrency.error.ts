import { EntityConcurrencyError } from '../../../error/entity-concurrency.error.js'
import { ExampleKind } from '../example-kind.js'
import type { ExampleKindID } from '../example-kind-id.js'

export class ExampleKindConcurrencyError extends EntityConcurrencyError<ExampleKindID> {
  public constructor(id: ExampleKindID) {
    super(ExampleKind.name, id)
  }
}
