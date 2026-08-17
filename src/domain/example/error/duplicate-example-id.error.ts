import { DuplicateEntityError } from '../../error/duplicate-entity.error.js'
import { Example } from '../example.js'
import type { ExampleID } from '../example-id.js'

export class DuplicateExampleIdError extends DuplicateEntityError<ExampleID> {
  public constructor(id: ExampleID) {
    super(Example.name, id)
  }
}
