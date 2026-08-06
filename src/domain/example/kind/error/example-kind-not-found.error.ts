import { EntityNotFoundError } from '../../../error/entity-not-found.error.js'
import { ExampleKind } from '../example-kind.js'
import type { ExampleKindID } from '../example-kind-id.js'

export class ExampleKindNotFoundError extends EntityNotFoundError<ExampleKindID> {
  public constructor(id: ExampleKindID) {
    super(ExampleKind.name, id)
  }
}
