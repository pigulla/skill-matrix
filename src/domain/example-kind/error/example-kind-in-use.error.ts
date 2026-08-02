import { EntityInUseError } from '../../error/entity-in-use.error.js'
import type { ExampleKind } from '../example-kind.js'

export class ExampleKindInUseError extends EntityInUseError<ExampleKind> {
  public constructor(kind: ExampleKind) {
    super('ExampleKind', kind)
  }
}
