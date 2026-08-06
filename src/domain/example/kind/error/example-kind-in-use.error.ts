import { EntityInUseError } from '../../../error/entity-in-use.error.js'
import { ExampleKind } from '../example-kind.js'
import type { ExampleKindID } from '../example-kind-id.js'

export class ExampleKindInUseError extends EntityInUseError<ExampleKindID> {
  public constructor(id: ExampleKindID) {
    super(ExampleKind.name, id)
  }
}
