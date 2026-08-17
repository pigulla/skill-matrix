import type { ZodError } from 'zod'

import { InvalidEntityError } from '../../error/invalid-entity.error.js'
import { Example } from '../example.js'

export class InvalidExampleError extends InvalidEntityError {
  public constructor(cause: ZodError) {
    super(Example.name, cause)
  }
}
