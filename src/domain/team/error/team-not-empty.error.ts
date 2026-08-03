import { EntityInUseError } from '../../error/entity-in-use.error.js'
import { Team } from '../team.js'
import type { TeamID } from '../team-id.js'

export class TeamNotEmptyError extends EntityInUseError<TeamID> {
  public constructor(id: TeamID) {
    super(Team.name, id)
  }
}
