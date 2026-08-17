import { DuplicateEntityError } from '../../error/duplicate-entity.error.js'
import { Team } from '../team.js'

export class DuplicateTeamNameError extends DuplicateEntityError<{ name: string }> {
  public constructor(name: string) {
    super(Team.name, { name })
  }
}
