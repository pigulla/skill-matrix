import { DuplicateEntityError } from '../../error/duplicate-entity.error.js'
import { Skill } from '../skill.js'

export class DuplicateSkillNameError extends DuplicateEntityError<{ name: string }> {
  public constructor(name: string) {
    super(Skill.name, { name })
  }
}
