import { DuplicateEntityIdError } from '../../error/duplicate-entity-id.error.js'
import type { SkillID } from '../skill-id.js'

export class DuplicateSkillIdError extends DuplicateEntityIdError<SkillID> {
  public constructor(id: SkillID) {
    super('Skill', id)
  }
}
