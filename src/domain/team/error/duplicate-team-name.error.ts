import { DuplicateEntityNameError } from '../../error/duplicate-entity-name.error.js'
import { Team } from '../team.js'

export class DuplicateTeamNameError extends DuplicateEntityNameError {
  public constructor(name: string) {
    super(Team.name, name)
  }
}
