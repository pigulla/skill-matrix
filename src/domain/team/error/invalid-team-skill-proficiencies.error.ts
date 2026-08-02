import type { ZodError } from 'zod'

import { InvalidEntityError } from '../../error/invalid-entity.error.js'
import { TeamSkillProficiencies } from '../team-skill-proficiencies.js'

export class InvalidTeamSkillProficienciesError extends InvalidEntityError {
  public constructor(cause: ZodError) {
    super(`An entity of type ${TeamSkillProficiencies.name} has failed validation`, cause)
  }
}
