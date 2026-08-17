import { DuplicateEntityError } from '../../error/duplicate-entity.error.js'
import { Example } from '../example.js'

export class DuplicateExampleNameError extends DuplicateEntityError<{ name: string }> {
  public constructor(name: string) {
    super(Example.name, { name })
  }
}
