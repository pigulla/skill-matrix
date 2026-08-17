import type { ZodError } from 'zod'

import { InvalidEntityError } from '../../../error/invalid-entity.error.js'
import { SkillProficiency } from '../skill-proficiency.js'

export class InvalidSkillProficiencyError extends InvalidEntityError {
  public constructor(cause: ZodError) {
    super(SkillProficiency.name, cause)
  }
}
