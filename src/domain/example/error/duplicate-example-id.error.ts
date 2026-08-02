import { DuplicateEntityIdError } from '../../error/duplicate-entity-id.error.js'
import type { ExampleID } from '../example-id.js'

export class DuplicateExampleIdError extends DuplicateEntityIdError<ExampleID> {
  public constructor(id: ExampleID) {
    super('Example', id)
  }
}
