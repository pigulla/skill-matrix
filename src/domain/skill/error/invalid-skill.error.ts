import type { ZodError } from 'zod'

import { InvalidEntityError } from '../../error/invalid-entity.error.js'
import { Skill } from '../skill.js'

export class InvalidSkillError extends InvalidEntityError {
  public constructor(cause: ZodError) {
    super(`An entity of type ${Skill.name} has failed validation`, cause)
  }
}
