import type { ZodError } from 'zod'

import { InvalidEntityError } from '../../error/invalid-entity.error.js'
import { User } from '../user.js'

export class InvalidUserError extends InvalidEntityError {
  public constructor(cause: ZodError) {
    super(`An entity of type ${User.name} has failed validation`, cause)
  }
}
