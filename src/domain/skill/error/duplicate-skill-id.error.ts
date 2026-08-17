import { DuplicateEntityError } from '../../error/duplicate-entity.error.js'
import { Skill } from '../skill.js'
import type { SkillID } from '../skill-id.js'

export class DuplicateSkillIdError extends DuplicateEntityError<SkillID> {
  public constructor(id: SkillID) {
    super(Skill.name, id)
  }
}
