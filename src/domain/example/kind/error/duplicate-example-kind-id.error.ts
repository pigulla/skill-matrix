import { DuplicateEntityIdError } from '../../../error/duplicate-entity-id.error.js'
import { ExampleKind } from '../example-kind.js'
import type { ExampleKindID } from '../example-kind-id.js'

export class DuplicateExampleKindIdError extends DuplicateEntityIdError<ExampleKindID> {
  public constructor(id: ExampleKindID) {
    super(ExampleKind.name, id)
  }
}
