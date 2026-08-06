import { EntityReferenceNotFoundError } from '../../../error/entity-reference-not-found.error.js'
import { ExampleKind } from '../example-kind.js'
import type { ExampleKindID } from '../example-kind-id.js'

export class ExampleKindReferenceNotFoundError extends EntityReferenceNotFoundError<ExampleKindID> {
  public constructor(id: ExampleKindID) {
    super(ExampleKind.name, id)
  }
}
