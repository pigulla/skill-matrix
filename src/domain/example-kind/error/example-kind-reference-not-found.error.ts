import { EntityReferenceNotFoundError } from '../../error/entity-reference-not-found.error.js'
import type { ExampleKind } from '../example-kind.js'

export class ExampleKindReferenceNotFoundError extends EntityReferenceNotFoundError<ExampleKind> {
  public constructor(exampleKind: ExampleKind) {
    super('ExampleKind', exampleKind)
  }
}
