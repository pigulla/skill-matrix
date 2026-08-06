import { DuplicateEntityNameError } from '../../../error/duplicate-entity-name.error.js'
import { ExampleKind } from '../example-kind.js'

export class DuplicateExampleKindNameError extends DuplicateEntityNameError {
  public constructor(name: string) {
    super(ExampleKind.name, name)
  }
}
