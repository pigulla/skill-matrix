import { EntityReferenceNotFoundError } from '../../error/entity-reference-not-found.error.js'
import { Skill } from '../skill.js'
import type { SkillID } from '../skill-id.js'

export class SkillReferenceNotFoundError extends EntityReferenceNotFoundError<SkillID> {
  public constructor(id: SkillID) {
    super(Skill.name, id)
  }
}
