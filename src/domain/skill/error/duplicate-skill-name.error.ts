import { DuplicateEntityNameError } from '../../error/duplicate-entity-name.error.js'
import { Skill } from '../skill.js'

export class DuplicateSkillNameError extends DuplicateEntityNameError {
  public constructor(name: string) {
    super(Skill.name, name)
  }
}
