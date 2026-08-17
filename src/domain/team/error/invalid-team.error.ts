import type { ZodError } from 'zod'

import { InvalidEntityError } from '../../error/invalid-entity.error.js'
import { Team } from '../team.js'

export class InvalidTeamError extends InvalidEntityError {
  public constructor(cause: ZodError) {
    super(Team.name, cause)
  }
}
