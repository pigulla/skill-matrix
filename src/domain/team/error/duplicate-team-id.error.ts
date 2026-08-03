import { DuplicateEntityIdError } from '../../error/duplicate-entity-id.error.js'
import { Team } from '../team.js'
import type { TeamID } from '../team-id.js'

export class DuplicateTeamIdError extends DuplicateEntityIdError<TeamID> {
  public constructor(id: TeamID) {
    super(Team.name, id)
  }
}
