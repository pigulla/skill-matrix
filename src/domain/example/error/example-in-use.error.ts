import { EntityInUseError } from '../../error/entity-in-use.error.js'
import type { ExampleID } from '../example-id.js'

export class ExampleInUseError extends EntityInUseError<ExampleID> {
  public constructor(id: ExampleID) {
    super('Example', id)
  }
}
