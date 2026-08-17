import { EntityConcurrencyError } from '../../error/entity-concurrency.error.js'
import { Skill } from '../skill.js'
import type { SkillID } from '../skill-id.js'

export class SkillConcurrencyError extends EntityConcurrencyError<SkillID> {
  public constructor(id: SkillID) {
    super(Skill.name, id)
  }
}
