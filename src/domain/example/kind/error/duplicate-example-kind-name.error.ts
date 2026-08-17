import { DuplicateEntityError } from '../../../error/duplicate-entity.error.js'
import { ExampleKind } from '../example-kind.js'

export class DuplicateExampleKindNameError extends DuplicateEntityError<{ name: string }> {
  public constructor(name: string) {
    super(ExampleKind.name, { name })
  }
}
