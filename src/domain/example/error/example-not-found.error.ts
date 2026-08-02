import { EntityNotFoundError } from '../../error/entity-not-found.error.js'
import type { ExampleID } from '../example-id.js'

export class ExampleNotFoundError extends EntityNotFoundError<ExampleID> {
  public constructor(id: ExampleID) {
    super('Example', id)
  }
}
