import { DuplicateEntityError } from '../../error/duplicate-entity.error.js'
import { Team } from '../team.js'
import type { TeamID } from '../team-id.js'

export class DuplicateTeamIdError extends DuplicateEntityError<TeamID> {
  public constructor(id: TeamID) {
    super(Team.name, id)
  }
}
