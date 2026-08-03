import { EntityReferenceNotFoundError } from '../../error/entity-reference-not-found.error.js'
import { Example } from '../example.js'
import type { ExampleID } from '../example-id.js'

export class ExampleReferenceNotFoundError extends EntityReferenceNotFoundError<ExampleID> {
  public constructor(id: ExampleID) {
    super(Example.name, id)
  }
}
