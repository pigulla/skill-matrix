import { DuplicateEntityNameError } from '../../error/duplicate-entity-name.error.js'

export class DuplicateSkillNameError extends DuplicateEntityNameError {
  public constructor(name: string) {
    super('Skill', name)
  }
}
