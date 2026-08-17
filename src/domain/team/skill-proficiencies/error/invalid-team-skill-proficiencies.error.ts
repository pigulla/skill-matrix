import type { ZodError } from 'zod'

import { InvalidEntityError } from '../../../error/invalid-entity.error.js'
import { TeamSkillProficiencies } from '../team-skill-proficiencies.js'

export class InvalidTeamSkillProficienciesError extends InvalidEntityError {
  public constructor(cause: ZodError) {
    super(TeamSkillProficiencies.name, cause)
  }
}
