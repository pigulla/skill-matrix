import type { ZodError } from 'zod'

import { InvalidEntityError } from '../../../error/invalid-entity.error.js'
import { ExampleKind } from '../example-kind.js'

export class InvalidExampleKindError extends InvalidEntityError {
  public constructor(cause: ZodError) {
    super(`An entity of type ${ExampleKind.name} has failed validation`, cause)
  }
}
