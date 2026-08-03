import { EntityNotFoundError } from '../../error/entity-not-found.error.js'
import { Skill } from '../skill.js'
import type { SkillID } from '../skill-id.js'

export class SkillNotFoundError extends EntityNotFoundError<SkillID> {
  public constructor(id: SkillID) {
    super(Skill.name, id)
  }
}
