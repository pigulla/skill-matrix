import { DuplicateEntityIdError } from '../../error/duplicate-entity-id.error.js'
import type { ExampleKind } from '../example-kind.js'

export class DuplicateExampleKindError extends DuplicateEntityIdError<ExampleKind> {
  public constructor(kind: ExampleKind) {
    super('ExampleKind', kind)
  }
}
