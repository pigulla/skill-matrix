import { DuplicateEntityNameError } from '../../error/duplicate-entity-name.error.js'
import { Example } from '../example.js'

export class DuplicateExampleNameError extends DuplicateEntityNameError {
  public constructor(name: string) {
    super(Example.name, name)
  }
}
