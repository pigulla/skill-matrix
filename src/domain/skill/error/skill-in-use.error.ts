import { EntityInUseError } from '../../error/entity-in-use.error.js'
import { Skill } from '../skill.js'
import type { SkillID } from '../skill-id.js'

export class SkillInUseError extends EntityInUseError<SkillID> {
  public constructor(id: SkillID) {
    super(Skill.name, id)
  }
}
