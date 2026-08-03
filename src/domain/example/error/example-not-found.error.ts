import { EntityNotFoundError } from '../../error/entity-not-found.error.js'
import { Example } from '../example.js'
import type { ExampleID } from '../example-id.js'

export class ExampleNotFoundError extends EntityNotFoundError<ExampleID> {
  public constructor(id: ExampleID) {
    super(Example.name, id)
  }
}
