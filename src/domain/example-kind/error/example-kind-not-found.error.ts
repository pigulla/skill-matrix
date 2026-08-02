import { EntityNotFoundError } from '../../error/entity-not-found.error.js'
import type { ExampleKind } from '../example-kind.js'

export class ExampleKindNotFoundError extends EntityNotFoundError<ExampleKind> {
  public constructor(kind: ExampleKind) {
    super('ExampleKind', kind)
  }
}
