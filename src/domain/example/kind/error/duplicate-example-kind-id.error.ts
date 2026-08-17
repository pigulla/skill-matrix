import { DuplicateEntityError } from '../../../error/duplicate-entity.error.js'
import { ExampleKind } from '../example-kind.js'
import type { ExampleKindID } from '../example-kind-id.js'

export class DuplicateExampleKindIdError extends DuplicateEntityError<ExampleKindID> {
  public constructor(id: ExampleKindID) {
    super(ExampleKind.name, id)
  }
}
