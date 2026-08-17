import { EntityConcurrencyError } from '../../error/entity-concurrency.error.js'
import { Example } from '../example.js'
import type { ExampleID } from '../example-id.js'

export class ExampleConcurrencyError extends EntityConcurrencyError<ExampleID> {
  public constructor(id: ExampleID) {
    super(Example.name, id)
  }
}
